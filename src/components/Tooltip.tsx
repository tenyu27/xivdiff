import { formatDelta, formatTime } from '../lib/layout.ts'
import type { MatchedAction, SideId, TimelineAction } from '../lib/types.ts'
import './Tooltip.css'

export interface TooltipState {
  action: TimelineAction
  row: MatchedAction
  side: SideId
  /** Bounding rect of the anchoring icon, in viewport coordinates. */
  anchor: { top: number; left: number; right: number; bottom: number }
}

const WIDTH = 240
const MARGIN = 10

export function Tooltip({ state }: { state: TooltipState }) {
  const { action, row, side, anchor } = state

  // Placed on the outer side of the track so it can never cover its own anchor.
  const left =
    side === 'left'
      ? Math.max(MARGIN, anchor.left - WIDTH - MARGIN)
      : Math.min(window.innerWidth - WIDTH - MARGIN, anchor.right + MARGIN)

  const centred = (anchor.top + anchor.bottom) / 2
  const top = Math.min(
    Math.max(MARGIN, centred - 40),
    window.innerHeight - 150,
  )

  const paired = row.left && row.right

  return (
    <div className="tooltip" style={{ left, top, width: WIDTH }} role="tooltip">
      <p className="tooltip-name">{action.abilityName}</p>
      <p className="mono tooltip-meta">
        {formatTime(action.relativeTimestamp)}
        <span className="tooltip-kind">
          {action.actionType === 'gcd' ? 'GCD' : 'oGCD'}
        </span>
      </p>

      {paired && row.deltaMs != null && (
        <div className="tooltip-compare">
          <dl className="mono tooltip-grid">
            <dt>Your timing</dt>
            <dd>{formatTime(row.left!.relativeTimestamp)}</dd>
            <dt>Reference timing</dt>
            <dd>{formatTime(row.right!.relativeTimestamp)}</dd>
          </dl>
          <p className="mono tooltip-delta">{formatDelta(row.deltaMs)}</p>
        </div>
      )}

      {row.type === 'left-only' && (
        <p className="tooltip-note">Not present in the reference rotation.</p>
      )}
      {row.type === 'right-only' && (
        <p className="tooltip-note">Not present in your rotation.</p>
      )}
      {row.type === 'mismatch' && (
        <p className="tooltip-note">
          Substituted for{' '}
          {side === 'left' ? row.right?.abilityName : row.left?.abilityName}.
        </p>
      )}
    </div>
  )
}
