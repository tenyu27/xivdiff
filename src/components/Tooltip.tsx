import { formatTime } from '../lib/layout.ts'
import type { SideId, TimelineAction } from '../lib/types.ts'
import './Tooltip.css'

export interface TooltipState {
  action: TimelineAction
  side: SideId
  /** Bounding rect of the anchoring icon, in viewport coordinates. */
  anchor: { top: number; left: number; right: number; bottom: number }
}

const WIDTH = 240
const MARGIN = 10

/**
 * What this action is and when it was cast — nothing more. The verdict on the
 * row is already stated by the icon's border and its outboard note, so
 * restating it here only made the same finding twice.
 */
export function Tooltip({ state }: { state: TooltipState }) {
  const { action, side, anchor } = state

  // Placed on the outer side of the track so it can never cover its own anchor.
  const left =
    side === 'left'
      ? Math.max(MARGIN, anchor.left - WIDTH - MARGIN)
      : Math.min(window.innerWidth - WIDTH - MARGIN, anchor.right + MARGIN)

  const centred = (anchor.top + anchor.bottom) / 2
  const top = Math.min(Math.max(MARGIN, centred - 30), window.innerHeight - 80)

  return (
    <div className="tooltip" style={{ left, top, width: WIDTH }} role="tooltip">
      <p className="tooltip-name">{action.abilityName}</p>
      {/* Times are phase-relative throughout, matching how the rows are both
          aligned and placed; the phase tag says which clock is being read. */}
      <p className="mono tooltip-meta">
        <span>
          {formatTime(action.phaseTime)}
          {action.phase > 1 && (
            <span className="tooltip-phase"> P{action.phase}</span>
          )}
        </span>
        <span className="tooltip-kind">
          {action.actionType === 'gcd' ? 'GCD' : 'oGCD'}
        </span>
      </p>
    </div>
  )
}
