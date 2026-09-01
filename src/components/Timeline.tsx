import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import {
  GCD_SIZE,
  OGCD_INSET,
  OGCD_SIZE,
  formatTime,
  layoutTimeline,
} from '../lib/layout.ts'
import type { LaidOutRow } from '../lib/layout.ts'
import type { MatchedAction, SideId, TimelineAction } from '../lib/types.ts'
import { Tooltip } from './Tooltip.tsx'
import type { TooltipState } from './Tooltip.tsx'
import './Timeline.css'

/** Distance from a track column's inner edge to the GCD axis. */
const AXIS = 120
/** Half the centre gutter, which `grid-template-columns` fixes at 120px. */
const HALF_GUTTER = 60
const TOOLTIP_DELAY = 120
/** Gap between an icon's outer edge and the note that annotates it. */
const NOTE_GAP = 10

function sizeOf(action: TimelineAction): number {
  return action.actionType === 'gcd' ? GCD_SIZE : OGCD_SIZE
}

/** Distance from the track's inner edge to the icon's own inner edge. */
function inset(action: TimelineAction): number {
  return action.actionType === 'gcd'
    ? AXIS - GCD_SIZE / 2
    : AXIS - OGCD_INSET - OGCD_SIZE / 2
}

interface Note {
  text: string
  tone: 'absence'
}

/**
 * What to write beside an icon, on that icon's own outer side.
 *
 * Everything used to be stated in the centre: a rule crossing both tracks and a
 * label parked on the spine. At a few hundred rows that produced a thicket of
 * lines converging on the middle, which buried the one thing the centre is for
 * — the time axis. The state now lives on the icon's outline, the words live
 * outboard in space that was empty, and the middle carries time alone.
 */
function noteFor(entry: LaidOutRow, side: SideId): Note | null {
  const { row } = entry

  if (row.type === 'left-only') {
    return side === 'left' ? { text: 'extra', tone: 'absence' } : null
  }
  if (row.type === 'right-only') {
    return side === 'right' ? { text: 'missing', tone: 'absence' } : null
  }
  // A pair of different abilities at the same beat carries no note: both icons
  // are on screen and the ochre border already states the disagreement.
  return null
}

interface Props {
  rows: MatchedAction[]
}

export function Timeline({ rows }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [staggering, setStaggering] = useState(true)

  const layout = layoutTimeline(rows)
  const total = layout.rows.length

  // The cascade plays once, on mount. Selection changes re-render this same
  // instance, so they do not re-trigger it.
  useEffect(() => {
    const timer = window.setTimeout(() => setStaggering(false), 500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="timeline">
      <div
        className={staggering ? 'timeline-inner staggering' : 'timeline-inner'}
        style={{ height: layout.height }}
      >
        {/* Time rules and phase dividers are painted before the tracks, so no
            icon is ever obscured by them. */}
        {layout.ticks.map((tick) => (
          <div
            className={tick.major ? 'tick tick-major' : 'tick'}
            key={tick.key}
            style={{ top: tick.y }}
          >
            <span className="tick-line" />
            <span className="mono tick-label">
              {formatTime(tick.time).slice(0, -4)}
            </span>
          </div>
        ))}

        {layout.phases.map((marker) => (
          <div
            className="phase-divider"
            key={marker.phase}
            style={{ top: marker.y }}
          >
            <span className="phase-label">Phase {marker.phase}</span>
          </div>
        ))}

        {/* Painted under the icons, over the rules: a row's two halves belong
            to each other, and the eye should not have to hold a y-position
            across two hundred pixels of empty gutter to believe it. */}
        {layout.rows.map((entry) => (
          <Connector key={entry.index} entry={entry} total={total} />
        ))}

        <Track
          side="left"
          rows={layout.rows}
          total={total}
          onHover={setTooltip}
        />

        {/* Time and nothing else. */}
        <div className="gutter">
          <div className="spine" />
        </div>

        <Track
          side="right"
          rows={layout.rows}
          total={total}
          onHover={setTooltip}
        />
      </div>

      {tooltip && <Tooltip state={tooltip} />}
    </div>
  )
}

/**
 * The hairline joining a row's two icons across the gutter.
 *
 * Offsets are measured from the centre because the track columns are fluid and
 * the gutter is not: an icon's inner edge sits `HALF_GUTTER + inset` from the
 * middle whatever the window is doing. A one-sided press runs its line only as
 * far as the spine, so the eye sees exactly where the other pull has nothing.
 */
function Connector({ entry, total }: { entry: LaidOutRow; total: number }) {
  const { left, right } = entry.row
  if (!left && !right) return null

  const edge = (action: TimelineAction): string =>
    `calc(50% - ${HALF_GUTTER + inset(action)}px)`

  return (
    <span
      className={`connector connector-${entry.row.type}`}
      style={{
        top: entry.y,
        left: left ? edge(left) : '50%',
        right: right ? edge(right) : '50%',
        ...staggerStyle(entry.index, total),
      }}
      aria-hidden
    />
  )
}

/** Cascade top-to-bottom over ~300ms however many actions there are. */
function staggerStyle(index: number, total: number): CSSProperties {
  return {
    animationDelay: `${Math.round((index / Math.max(total, 1)) * 300)}ms`,
  }
}

interface TrackProps {
  side: SideId
  rows: LaidOutRow[]
  total: number
  onHover: (state: TooltipState | null) => void
}

function Track({ side, rows, total, onHover }: TrackProps) {
  return (
    <div className={`track track-${side}`}>
      {rows.map((entry) => {
        const action = side === 'left' ? entry.row.left : entry.row.right
        if (!action) return null

        const note = noteFor(entry, side)

        return (
          <Fragment key={entry.index}>
            <Icon
              entry={entry}
              total={total}
              action={action}
              side={side}
              onHover={onHover}
            />
            {note && (
              <span
                className={`mono note note-${note.tone}`}
                style={{
                  top: entry.y,
                  // Outboard of the icon: the side of the track that was empty.
                  [side === 'left' ? 'right' : 'left']:
                    inset(action) + sizeOf(action) + NOTE_GAP,
                  ...staggerStyle(entry.index, total),
                }}
              >
                {note.text}
              </span>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

interface IconProps {
  entry: LaidOutRow
  total: number
  action: TimelineAction
  side: SideId
  onHover: (state: TooltipState | null) => void
}

function Icon({ entry, total, action, side, onHover }: IconProps) {
  const timer = useRef<number | undefined>(undefined)

  const isGcd = action.actionType === 'gcd'
  const size = sizeOf(action)
  const edge = side === 'left' ? 'right' : 'left'

  // The outline is now the whole verdict — including agreement, which used to
  // be stated by a connector. Green reads as "nothing to look at here", so the
  // eye is free to stop only on the yellow and rose rows.
  const classes = [
    'action',
    isGcd ? 'action-gcd' : 'action-ogcd',
    `action-${entry.row.type}`,
  ]

  const openTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    onHover({ action, side, anchor: rect })
  }

  const onEnter = (event: ReactMouseEvent<HTMLElement>) => {
    const element = event.currentTarget
    timer.current = window.setTimeout(() => openTooltip(element), TOOLTIP_DELAY)
  }

  const onLeave = () => {
    window.clearTimeout(timer.current)
    onHover(null)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <figure
      className={classes.join(' ')}
      style={{
        top: entry.y - size / 2,
        [edge]: inset(action),
        width: size,
        height: size,
        ...staggerStyle(entry.index, total),
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={(event) => openTooltip(event.currentTarget)}
      onBlur={onLeave}
      tabIndex={0}
      aria-label={`${action.abilityName} at ${formatTime(action.phaseTime)} in phase ${action.phase}`}
    >
      {action.abilityIcon ? (
        <img src={action.abilityIcon} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="action-blank" />
      )}
    </figure>
  )
}
