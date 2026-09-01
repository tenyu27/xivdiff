import { rowPhase } from './diff.ts'
import type { MatchedAction } from './types.ts'

/**
 * Idle time, in seconds, before a break is drawn between two consecutive rows.
 *
 * The sequence view is about press order, not the clock, so the ordinary
 * variation between a weave window and a clipped GCD must not open a hole in
 * the list. Only a stretch long enough to read as "this side stopped playing"
 * earns a break — more than a GCD's worth of nothing after the GCD that should
 * have followed, which is the point where a break stops being a slow cast and
 * starts being an absence.
 */
export const GAP_THRESHOLD_S = 3

export interface SequenceRow {
  row: MatchedAction
  /** Position within the whole sequence, for the mount cascade. */
  index: number
  isGcd: boolean
  /**
   * Idle seconds immediately before this row, present only when it exceeded
   * `GAP_THRESHOLD_S` on at least one side.
   */
  gapSeconds?: number
}

export interface SequenceBlock {
  phase: number
  rows: SequenceRow[]
}

function isGcdRow(row: MatchedAction): boolean {
  return row.left?.actionType === 'gcd' || row.right?.actionType === 'gcd'
}

/**
 * Turns aligned rows into a flat, evenly spaced list of presses.
 *
 * Deliberately no time axis: two pulls that press the same buttons in the same
 * order read as identical here even when one is a second slower throughout,
 * which is the whole point of this view. Time re-enters only as a break, and
 * only when one side genuinely stopped pressing buttons.
 */
export function layoutSequence(rows: MatchedAction[]): SequenceBlock[] {
  const blocks: SequenceBlock[] = []

  // Per side, the phase-relative time of that side's previous action. Tracked
  // per side because a gap belongs to whoever was idle: if only the reference
  // pull paused, that is still a break worth seeing.
  let lastLeft: number | null = null
  let lastRight: number | null = null
  let index = 0

  for (const row of rows) {
    const phase = rowPhase(row)
    let block = blocks[blocks.length - 1]

    // A phase boundary is its own break, so times restart and no gap is drawn
    // across it.
    if (!block || block.phase !== phase) {
      block = { phase, rows: [] }
      blocks.push(block)
      lastLeft = null
      lastRight = null
    }

    const gaps: number[] = []
    if (row.left && lastLeft != null) gaps.push(row.left.phaseTime - lastLeft)
    if (row.right && lastRight != null) {
      gaps.push(row.right.phaseTime - lastRight)
    }

    const gap = gaps.length ? Math.max(...gaps) : 0

    block.rows.push({
      row,
      index: index++,
      isGcd: isGcdRow(row),
      gapSeconds: gap > GAP_THRESHOLD_S ? gap : undefined,
    })

    if (row.left) lastLeft = row.left.phaseTime
    if (row.right) lastRight = row.right.phaseTime
  }

  return blocks
}
