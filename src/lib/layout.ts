import { rowPhase, rowTime } from './diff.ts'
import type { MatchedAction } from './types.ts'

export const GCD_SIZE = 42
export const OGCD_SIZE = 28
/** oGCD icons sit inset from the GCD axis, toward the centre spine. */
export const OGCD_INSET = 20

/** Baseline scale. Rows are pushed apart from this only to avoid collision. */
const PX_PER_SECOND = 26
const ROW_PADDING = 6
const TOP_PADDING = 28
const BOTTOM_PADDING = 80
/** Vertical break between phases, wide enough to read as a hard boundary. */
const PHASE_GAP = 64

export interface LaidOutRow {
  row: MatchedAction
  index: number
  /** Vertical centre of the row, in pixels from the top of the track. */
  y: number
  /** Seconds since the start of this row's phase. */
  time: number
  phase: number
  isGcd: boolean
  size: number
}

export interface PhaseMarker {
  phase: number
  /** Vertical centre of the divider rule. */
  y: number
}

export interface TimelineLayout {
  rows: LaidOutRow[]
  height: number
  /** Phase-elapsed ticks. `major` lands on every half minute. */
  ticks: { key: string; time: number; y: number; major: boolean }[]
  /** Empty for an unphased encounter — one phase needs no divider. */
  phases: PhaseMarker[]
}

function isGcdRow(row: MatchedAction): boolean {
  return row.left?.actionType === 'gcd' || row.right?.actionType === 'gcd'
}

/**
 * Places rows on a shared time axis so accumulated drift stays visible, while
 * guaranteeing that consecutive icons never overlap. Weave windows compress
 * several oGCDs into well under a second of real time, so pure time-scaling
 * alone would stack them on top of each other.
 */
export function layoutTimeline(rows: MatchedAction[]): TimelineLayout {
  const laidOut: LaidOutRow[] = []
  const ticks: TimelineLayout['ticks'] = []
  const phases: PhaseMarker[] = []

  // Each phase is placed as its own segment starting from zero, which is what
  // makes both sides re-level at every phase boundary.
  const segments = splitByPhase(rows)
  const phased = segments.length > 1

  let cursor = TOP_PADDING

  for (const segment of segments) {
    // The first phase opens the same way every later one does. Starting it flush
    // at the top padding instead put its divider half a gap *above* the content
    // — off the canvas — and left the opener crowded against the top edge, while
    // phases two onward each got room to breathe.
    const base =
      laidOut.length === 0 && !phased ? TOP_PADDING : cursor + PHASE_GAP
    if (phased) phases.push({ phase: segment.phase, y: base - PHASE_GAP / 2 })

    const start = laidOut.length

    for (const row of segment.rows) {
      const isGcd = isGcdRow(row)
      const size = isGcd ? GCD_SIZE : OGCD_SIZE
      const time = rowTime(row)

      const previous = laidOut[laidOut.length - 1]
      const minimum =
        laidOut.length > start
          ? previous.y + (previous.size + size) / 2 + ROW_PADDING
          : base + size / 2

      const y = Math.max(minimum, base + time * PX_PER_SECOND)

      laidOut.push({
        row,
        index: laidOut.length,
        y,
        time,
        phase: segment.phase,
        isGcd,
        size,
      })
    }

    const placed = laidOut.slice(start)
    cursor = placed.length ? placed[placed.length - 1].y : base

    const timeToY = buildTimeMapping(placed, base)
    const lastTime = placed.length ? placed[placed.length - 1].time : 0
    // Ticks stop at the last row rather than extrapolating past it: an
    // extrapolated tick lands inside the next phase's band and misdates it.
    // With a phase divider present it already marks the zero, so the 0:00 tick
    // would only double the same rule.
    const firstTick = phased ? 5 : 0
    for (let time = firstTick; time <= lastTime; time += 5) {
      ticks.push({
        key: `${segment.phase}-${time}`,
        time,
        y: timeToY(time),
        major: time % 30 === 0,
      })
    }
  }

  const height = laidOut.length ? cursor + BOTTOM_PADDING : 240

  return { rows: laidOut, height, ticks, phases }
}

interface PhaseSegment {
  phase: number
  rows: MatchedAction[]
}

/** Rows arrive in phase order, so a single pass is enough to cut them apart. */
function splitByPhase(rows: MatchedAction[]): PhaseSegment[] {
  const segments: PhaseSegment[] = []

  for (const row of rows) {
    const phase = rowPhase(row)
    const current = segments[segments.length - 1]
    if (current && current.phase === phase) current.rows.push(row)
    else segments.push({ phase, rows: [row] })
  }

  return segments
}

/**
 * Piecewise-linear interpolation across the laid-out rows, so a tick at 0:45
 * lands between the actions that actually happened at 0:45 — even in stretches
 * where collision avoidance pushed rows off the pure time scale.
 */
function buildTimeMapping(
  rows: LaidOutRow[],
  base: number,
): (time: number) => number {
  if (rows.length === 0) {
    return (time) => base + time * PX_PER_SECOND
  }

  // The mapping must be monotonic to be interpolatable; rows are already in
  // timeline order, but equal timestamps would create a zero-width segment.
  const points: { time: number; y: number }[] = []
  for (const row of rows) {
    const last = points[points.length - 1]
    if (last && row.time <= last.time) {
      last.y = row.y
      continue
    }
    points.push({ time: row.time, y: row.y })
  }

  const first = points[0]
  const last = points[points.length - 1]

  return (time: number): number => {
    if (time <= first.time) {
      return first.y - (first.time - time) * PX_PER_SECOND
    }
    if (time >= last.time) {
      return last.y + (time - last.time) * PX_PER_SECOND
    }

    let low = 0
    let high = points.length - 1
    while (high - low > 1) {
      const mid = (low + high) >> 1
      if (points[mid].time <= time) low = mid
      else high = mid
    }

    const a = points[low]
    const b = points[high]
    const ratio = (time - a.time) / (b.time - a.time)
    return a.y + (b.y - a.y) * ratio
  }
}

/** `M:SS.mmm` — the timestamp format used everywhere in the product. */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const minutes = Math.floor(clamped / 60)
  const rest = clamped - minutes * 60
  const whole = Math.floor(rest)
  const millis = Math.round((rest - whole) * 1000)
  return `${minutes}:${String(whole).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

/** `M:SS` — for pull durations, where milliseconds are noise. */
export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(clamped / 60)
  return `${minutes}:${String(clamped % 60).padStart(2, '0')}`
}

/**
 * Deltas always carry an explicit sign and three decimals. Currently unused —
 * drift is signalled by the icon border alone, with no number rendered — kept
 * because `deltaMs` is still computed and the format is settled.
 */
export function formatDelta(deltaMs: number): string {
  const sign = deltaMs >= 0 ? '+' : '−'
  return `${sign}${(Math.abs(deltaMs) / 1000).toFixed(3)}s`
}
