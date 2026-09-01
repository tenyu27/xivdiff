import type { MatchedAction, TimelineAction } from './types.ts'

/** A matched pair drifting further apart than this counts as a difference. */
export const TIMING_THRESHOLD_MS = 1000

/**
 * Longest Common Subsequence over ability ids.
 *
 * Plain index-by-index comparison is unusable here: one extra weave early in a
 * fight would mark every later action as mismatched. LCS keeps the two
 * rotations aligned across insertions and deletions, which is the whole point.
 *
 * Timestamps deliberately play no part in alignment — they are compared only
 * after the pairing is decided, so drift is reported rather than resolved.
 */
function lcsTable(left: TimelineAction[], right: TimelineAction[]): Int32Array {
  const rows = left.length + 1
  const cols = right.length + 1
  const table = new Int32Array(rows * cols)

  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const index = i * cols + j
      table[index] =
        left[i].abilityId === right[j].abilityId
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[index + 1])
    }
  }

  return table
}

export function compareRotations(
  left: TimelineAction[],
  right: TimelineAction[],
): MatchedAction[] {
  const cols = right.length + 1
  const table = lcsTable(left, right)
  const rows: MatchedAction[] = []

  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    if (left[i].abilityId === right[j].abilityId) {
      rows.push(pairFor(left[i], right[j]))
      i++
      j++
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      rows.push({ left: left[i], type: 'left-only' })
      i++
    } else {
      rows.push({ right: right[j], type: 'right-only' })
      j++
    }
  }

  for (; i < left.length; i++) rows.push({ left: left[i], type: 'left-only' })
  for (; j < right.length; j++) rows.push({ right: right[j], type: 'right-only' })

  return collapseMismatches(rows)
}

function pairFor(
  left: TimelineAction,
  right: TimelineAction,
): MatchedAction {
  const deltaMs = Math.round(
    (left.relativeTimestamp - right.relativeTimestamp) * 1000,
  )
  return {
    left,
    right,
    deltaMs,
    type:
      Math.abs(deltaMs) > TIMING_THRESHOLD_MS ? 'timing-difference' : 'match',
  }
}

/**
 * A `left-only` immediately beside a `right-only` is not two independent
 * events — it is one action substituted for another. Collapsing the pair into
 * a single `mismatch` row keeps the two tracks visually level and reports the
 * difference once instead of twice.
 */
function collapseMismatches(rows: MatchedAction[]): MatchedAction[] {
  const output: MatchedAction[] = []

  for (let i = 0; i < rows.length; i++) {
    const current = rows[i]
    const next = rows[i + 1]

    const isSubstitution =
      next &&
      ((current.type === 'left-only' && next.type === 'right-only') ||
        (current.type === 'right-only' && next.type === 'left-only'))

    if (isSubstitution) {
      const left = current.left ?? next.left
      const right = current.right ?? next.right
      output.push({
        left,
        right,
        type: 'mismatch',
        deltaMs:
          left && right
            ? Math.round(
                (left.relativeTimestamp - right.relativeTimestamp) * 1000,
              )
            : undefined,
      })
      i++
      continue
    }

    output.push(current)
  }

  return output
}

export function isDifference(row: MatchedAction): boolean {
  return row.type !== 'match'
}

/** Row indices of every meaningful difference, in timeline order. */
export function differenceIndices(rows: MatchedAction[]): number[] {
  const indices: number[] = []
  rows.forEach((row, index) => {
    if (isDifference(row)) indices.push(index)
  })
  return indices
}

/** Earliest relative timestamp present on a row, used for time placement. */
export function rowTime(row: MatchedAction): number {
  const left = row.left?.relativeTimestamp
  const right = row.right?.relativeTimestamp
  if (left != null && right != null) return Math.min(left, right)
  return left ?? right ?? 0
}
