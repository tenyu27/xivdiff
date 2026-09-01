import type { Fight } from './types.ts'

/** A resolved phase window, in report-relative milliseconds. */
export interface PhaseWindow {
  /** FFLogs phase id, 1-based. Unphased encounters get a single phase 1. */
  phase: number
  startTime: number
}

/**
 * FFLogs reports phase 1 as starting at the pull, so the transitions are
 * already a complete partition of the fight. An unphased encounter comes back
 * with no transitions at all and is treated as one phase, which is what makes
 * every phase-relative calculation downstream safe to run unconditionally.
 */
export function phaseWindows(fight: Fight): PhaseWindow[] {
  if (fight.phaseTransitions.length === 0) {
    return [{ phase: 1, startTime: fight.startTime }]
  }

  const windows = fight.phaseTransitions.map((transition) => ({
    phase: transition.id,
    startTime: transition.startTime,
  }))

  // Actions logged fractionally before the first transition (pre-pull casts)
  // belong to the opening phase rather than to no phase at all.
  windows[0].startTime = Math.min(windows[0].startTime, fight.startTime)

  return windows
}

/** The window containing `timestamp`; the opening phase for anything earlier. */
export function windowAt(
  windows: PhaseWindow[],
  timestamp: number,
): PhaseWindow {
  let found = windows[0]
  for (const window of windows) {
    if (window.startTime > timestamp) break
    found = window
  }
  return found
}
