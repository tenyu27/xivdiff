import type { MatchedAction, TimelineAction } from './types.ts'

/**
 * The shortest global cooldown a real player reaches, in seconds. Skill speed
 * and haste move the recast between roughly 1.9s and the 2.5s base, so 1.9s is
 * the tightest spacing two consecutive GCD slots can ever have.
 *
 * Every tolerance below is expressed in terms of this rather than in round
 * numbers, because the GCD is the only unit the game actually keeps time in.
 */
const SHORTEST_GCD_S = 1.9

/**
 * A matched pair drifting further apart than this counts as a difference.
 *
 * Half a GCD: past that point a press has slipped closer to its neighbouring
 * slot than to its own, which is the moment "slightly late" becomes "a
 * different beat".
 */
export const TIMING_THRESHOLD_MS = Math.round((SHORTEST_GCD_S / 2) * 1000)

/**
 * The furthest apart two presses may be and still be considered the same beat.
 *
 * One full GCD, because two presses more than a whole slot apart are at best
 * adjacent slots and never the same one. This is only the outer bound — within
 * it, pairing is settled by `bestAvailable`, which prefers whichever candidate
 * is genuinely closest. That ordering matters: a fixed window alone cannot tell
 * a drifted partner from the next press along, and any window wide enough to
 * tolerate real drift is also wide enough to reach a neighbouring GCD.
 *
 * One window for GCDs and oGCDs alike. A narrower oGCD window only looked
 * stricter; what it did was refuse to pair two weaves a beat apart, splitting
 * one moment into an `extra` row, a paired row and a `missing` row.
 */
const PAIR_WINDOW_S = SHORTEST_GCD_S

/**
 * Aligns one phase's worth of actions. The two views differ only in this step —
 * everything around it, phase splitting included, is shared.
 */
type Aligner = (
  left: TimelineAction[],
  right: TimelineAction[],
) => MatchedAction[]

/**
 * Aligns the two rotations phase by phase.
 *
 * Phases are hard resynchronisation points: the boss becomes untargetable, both
 * pulls stop and restart, and how long one side spent in the previous phase says
 * nothing about the next. Aligning across the whole fight lets a single
 * phase-one divergence cascade through every later phase; aligning per phase
 * keeps each phase's comparison independent, which is what a player actually
 * reads. An unphased encounter is one phase, so this reduces to a single
 * whole-fight alignment.
 */
export function compareRotations(
  left: TimelineAction[],
  right: TimelineAction[],
  align: Aligner = alignPhase,
): MatchedAction[] {
  const phases = [
    ...new Set([...left, ...right].map((action) => action.phase)),
  ].sort((a, b) => a - b)

  const rows: MatchedAction[] = []
  for (const phase of phases) {
    rows.push(
      ...align(
        left.filter((action) => action.phase === phase),
        right.filter((action) => action.phase === phase),
      ),
    )
  }

  return rows
}

/**
 * Alignment within a single phase, by phase-relative time.
 *
 * Two pointers over sequences that are already sorted, pairing whichever heads
 * are within a window of each other and otherwise emitting the earlier one
 * alone. Matching by ability id instead — the previous approach — was the
 * source of a real misreading: two presses at the same instant, of different
 * abilities, were reported as one side's "extra" stacked above the other side's
 * "missing" rather than as the substitution they are. Time decides the pairing;
 * the abilities only decide the verdict on it.
 */
function alignPhase(
  left: TimelineAction[],
  right: TimelineAction[],
): MatchedAction[] {
  const rows: MatchedAction[] = []

  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    const a = left[i]
    const b = right[j]

    if (pairable(a, b) && bestAvailable(a, b, left[i + 1], right[j + 1])) {
      rows.push(pairFor(a, b))
      i++
      j++
      continue
    }

    // Neither head can pair with the other, so the earlier press stands alone
    // and its side advances. Ties break toward the left so a phase's output is
    // deterministic.
    if (a.phaseTime <= b.phaseTime) {
      rows.push({ left: a, type: 'left-only' })
      i++
    } else {
      rows.push({ right: b, type: 'right-only' })
      j++
    }
  }

  for (; i < left.length; i++) rows.push({ left: left[i], type: 'left-only' })
  for (; j < right.length; j++) rows.push({ right: right[j], type: 'right-only' })

  return rows
}

/**
 * Order-based alignment, for the cast-order view.
 *
 * Here the GCD chain is the skeleton and the clock is not consulted at all: the
 * nth GCD of the phase is the nth GCD of the phase on both sides, however far
 * apart in time the two pulls have drifted by then. That is the question this
 * view exists to answer — did we press the same buttons in the same order — and
 * a time window cannot answer it, because a pull that is a full GCD behind by
 * the third minute is still pressing the same rotation.
 *
 * oGCDs hang off the GCD they were woven after, and are paired within that slot
 * by their own order. So a weave window with two oGCDs on one side and one on
 * the other reports exactly one extra press, in the slot it happened in, rather
 * than shifting every later weave out of step.
 */
export function compareByOrder(
  left: TimelineAction[],
  right: TimelineAction[],
): MatchedAction[] {
  return compareRotations(left, right, alignPhaseByOrder)
}

/** One GCD and the oGCDs woven after it. A slot with no GCD is the opener's. */
interface Slot {
  gcd?: TimelineAction
  ogcds: TimelineAction[]
}

/**
 * Cuts a phase into slots at each GCD. Anything before the first GCD — a
 * prepull oGCD, a potion — becomes a leading slot with no GCD of its own, so it
 * still lines up against the other side's prepull rather than being folded into
 * the first GCD's weave window.
 */
function toSlots(actions: TimelineAction[]): Slot[] {
  const slots: Slot[] = [{ ogcds: [] }]

  for (const action of actions) {
    if (action.actionType === 'gcd') slots.push({ gcd: action, ogcds: [] })
    else slots[slots.length - 1].ogcds.push(action)
  }

  // The leading slot is kept only when something was actually pressed there.
  if (!slots[0].gcd && slots[0].ogcds.length === 0) slots.shift()

  return slots
}

function alignPhaseByOrder(
  left: TimelineAction[],
  right: TimelineAction[],
): MatchedAction[] {
  const leftSlots = toSlots(left)
  const rightSlots = toSlots(right)
  const rows: MatchedAction[] = []

  for (let i = 0; i < Math.max(leftSlots.length, rightSlots.length); i++) {
    const a = leftSlots[i]
    const b = rightSlots[i]

    const gcd = orderedPair(a?.gcd, b?.gcd)
    if (gcd) rows.push(gcd)

    const ogcds = Math.max(a?.ogcds.length ?? 0, b?.ogcds.length ?? 0)
    for (let k = 0; k < ogcds; k++) {
      const row = orderedPair(a?.ogcds[k], b?.ogcds[k])
      if (row) rows.push(row)
    }
  }

  return rows
}

/**
 * The verdict on two presses that position has already decided belong together.
 * Timing plays no part — this view deliberately does not report drift — so the
 * only question left is whether the same button was pressed.
 */
function orderedPair(
  left: TimelineAction | undefined,
  right: TimelineAction | undefined,
): MatchedAction | null {
  if (left && right) {
    return {
      left,
      right,
      deltaMs: Math.round((left.phaseTime - right.phaseTime) * 1000),
      type: left.abilityId === right.abilityId ? 'match' : 'mismatch',
    }
  }
  if (left) return { left, type: 'left-only' }
  if (right) return { right, type: 'right-only' }
  return null
}

/** Same kind of press, close enough in the phase to be the same beat. */
function pairable(a: TimelineAction, b: TimelineAction): boolean {
  // A GCD and an oGCD are never the same beat however close they land: they are
  // pressed on different clocks and pairing them would report every weave as a
  // substitution.
  if (a.actionType !== b.actionType) return false
  return Math.abs(a.phaseTime - b.phaseTime) <= PAIR_WINDOW_S
}

/**
 * Greedy pairing goes wrong in one case: when the head of one side is a better
 * partner for the *next* press on the other side than for the current one, and
 * that next press has nothing else to pair with. Taking the closer of the two
 * candidates keeps a burst of presses from being shifted one row out of step.
 */
function bestAvailable(
  a: TimelineAction,
  b: TimelineAction,
  nextLeft: TimelineAction | undefined,
  nextRight: TimelineAction | undefined,
): boolean {
  const distance = Math.abs(a.phaseTime - b.phaseTime)

  if (nextLeft && pairable(nextLeft, b)) {
    if (Math.abs(nextLeft.phaseTime - b.phaseTime) < distance) return false
  }
  if (nextRight && pairable(a, nextRight)) {
    if (Math.abs(a.phaseTime - nextRight.phaseTime) < distance) return false
  }

  return true
}

/**
 * The verdict on a pair that time has already decided belongs together: same
 * ability is agreement, a different ability at the same beat is a substitution,
 * and the same ability drifting past the threshold is a timing difference.
 */
function pairFor(left: TimelineAction, right: TimelineAction): MatchedAction {
  // Phase-relative, so a side that entered the phase earlier is not reported as
  // being seconds ahead on every action within it.
  const deltaMs = Math.round((left.phaseTime - right.phaseTime) * 1000)

  if (left.abilityId !== right.abilityId) {
    return { left, right, deltaMs, type: 'mismatch' }
  }

  return {
    left,
    right,
    deltaMs,
    type:
      Math.abs(deltaMs) > TIMING_THRESHOLD_MS ? 'timing-difference' : 'match',
  }
}

/**
 * Earliest phase-relative timestamp on a row. Placement is phase-relative for
 * the same reason alignment is: each phase starts level for both sides.
 */
export function rowTime(row: MatchedAction): number {
  const left = row.left?.phaseTime
  const right = row.right?.phaseTime
  if (left != null && right != null) return Math.min(left, right)
  return left ?? right ?? 0
}

/** The phase a row belongs to; both sides of a pair are always in the same one. */
export function rowPhase(row: MatchedAction): number {
  return row.left?.phase ?? row.right?.phase ?? 1
}
