import { rowTime } from './diff.ts'
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

export interface LaidOutRow {
  row: MatchedAction
  index: number
  /** Vertical centre of the row, in pixels from the top of the track. */
  y: number
  time: number
  isGcd: boolean
  size: number
}

export interface TimelineLayout {
  rows: LaidOutRow[]
  height: number
  /** Elapsed-time ticks for the centre gutter. */
  ticks: { time: number; y: number }[]
  timeToY: (time: number) => number
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
  let cursor = TOP_PADDING

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const isGcd = isGcdRow(row)
    const size = isGcd ? GCD_SIZE : OGCD_SIZE
    const time = rowTime(row)

    const previous = laidOut[index - 1]
    const minimum = previous
      ? previous.y + (previous.size + size) / 2 + ROW_PADDING
      : cursor + size / 2

    const y = Math.max(minimum, TOP_PADDING + time * PX_PER_SECOND)

    laidOut.push({ row, index, y, time, isGcd, size })
    cursor = y
  }

  const height = laidOut.length
    ? laidOut[laidOut.length - 1].y + BOTTOM_PADDING
    : 240

  const timeToY = buildTimeMapping(laidOut)
  const lastTime = laidOut.length ? laidOut[laidOut.length - 1].time : 0

  const ticks: { time: number; y: number }[] = []
  for (let time = 0; time <= lastTime + 5; time += 5) {
    ticks.push({ time, y: timeToY(time) })
  }

  return { rows: laidOut, height, ticks, timeToY }
}

/**
 * Piecewise-linear interpolation across the laid-out rows, so a tick at 0:45
 * lands between the actions that actually happened at 0:45 — even in stretches
 * where collision avoidance pushed rows off the pure time scale.
 */
function buildTimeMapping(rows: LaidOutRow[]): (time: number) => number {
  if (rows.length === 0) {
    return (time) => TOP_PADDING + time * PX_PER_SECOND
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

/** Deltas always carry an explicit sign and three decimals. */
export function formatDelta(deltaMs: number): string {
  const sign = deltaMs >= 0 ? '+' : '−'
  return `${sign}${(Math.abs(deltaMs) / 1000).toFixed(3)}s`
}
