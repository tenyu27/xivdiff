import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import {
  GCD_SIZE,
  OGCD_INSET,
  OGCD_SIZE,
  formatDelta,
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
const TOOLTIP_DELAY = 120

/** Horizontal gap between an icon's inner edge and the gutter. */
function reach(action: TimelineAction): number {
  return action.actionType === 'gcd'
    ? AXIS - GCD_SIZE / 2
    : AXIS - OGCD_INSET - OGCD_SIZE / 2
}

/** Distance from the track's inner edge to the icon's own inner edge. */
function inset(action: TimelineAction): number {
  return reach(action)
}

interface Props {
  rows: MatchedAction[]
  /** Row index the difference navigation is currently parked on. */
  activeIndex: number | null
  /** Incremented by the header to request a scroll to `activeIndex`. */
  scrollNonce: number
}

export function Timeline({ rows, activeIndex, scrollNonce }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    const container = scrollRef.current
    if (!container || activeIndex == null) return

    const target = layout.rows[activeIndex]
    if (!target) return

    smoothScrollTo(container, target.y - container.clientHeight / 2)
    // Driven by the nonce so that re-selecting the same row still scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollNonce, activeIndex])

  return (
    <div className="timeline" ref={scrollRef}>
      <div
        className={staggering ? 'timeline-inner staggering' : 'timeline-inner'}
        style={{ height: layout.height }}
      >
        <div className="track track-left">
          {layout.rows.map((entry) =>
            entry.row.left ? (
              <Icon
                key={entry.index}
                entry={entry}
                total={total}
                action={entry.row.left}
                side="left"
                active={entry.index === activeIndex}
                onHover={setTooltip}
              />
            ) : null,
          )}
        </div>

        <div className="gutter">
          <div className="spine" />
          {layout.ticks.map((tick) => (
            <div className="mono tick" key={tick.time} style={{ top: tick.y }}>
              {formatTime(tick.time).slice(0, -4)}
            </div>
          ))}
          {layout.rows.map((entry) => (
            <Connector key={entry.index} entry={entry} total={total} />
          ))}
        </div>

        <div className="track track-right">
          {layout.rows.map((entry) =>
            entry.row.right ? (
              <Icon
                key={entry.index}
                entry={entry}
                total={total}
                action={entry.row.right}
                side="right"
                active={entry.index === activeIndex}
                onHover={setTooltip}
              />
            ) : null,
          )}
        </div>
      </div>

      {tooltip && <Tooltip state={tooltip} />}
    </div>
  )
}

/** Cascade top-to-bottom over ~300ms however many actions there are. */
function staggerStyle(index: number, total: number): CSSProperties {
  return {
    animationDelay: `${Math.round((index / Math.max(total, 1)) * 300)}ms`,
  }
}

function Connector({ entry, total }: { entry: LaidOutRow; total: number }) {
  const { row, y, index } = entry
  const style = { top: y, ...staggerStyle(index, total) }

  if (row.left && row.right) {
    return (
      <div
        className={`connector connector-${row.type}`}
        style={{ ...style, left: -reach(row.left), right: -reach(row.right) }}
      >
        <span className="connector-line" />
        {row.type === 'timing-difference' && row.deltaMs != null && (
          <span className="mono connector-delta">
            {formatDelta(row.deltaMs)}
          </span>
        )}
      </div>
    )
  }

  // A one-sided action draws a stub from the icon it has toward the gap, so the
  // eye lands on the empty side without filling the row with colour.
  const present: SideId = row.left ? 'left' : 'right'
  const action = (row.left ?? row.right)!

  return (
    <div
      className={`connector connector-stub stub-${present}`}
      style={{
        ...style,
        ...(present === 'left'
          ? { left: -reach(action), right: 34 }
          : { right: -reach(action), left: 34 }),
      }}
    >
      <span className="connector-line" />
      <span className="stub-caret" />
      <span className="stub-label">
        {present === 'left' ? 'extra' : 'missing'}
      </span>
    </div>
  )
}

interface IconProps {
  entry: LaidOutRow
  total: number
  action: TimelineAction
  side: SideId
  active: boolean
  onHover: (state: TooltipState | null) => void
}

function Icon({ entry, total, action, side, active, onHover }: IconProps) {
  const timer = useRef<number | undefined>(undefined)

  const isGcd = action.actionType === 'gcd'
  const size = isGcd ? GCD_SIZE : OGCD_SIZE
  const edge = side === 'left' ? 'right' : 'left'

  const classes = ['action', isGcd ? 'action-gcd' : 'action-ogcd']
  if (active) classes.push('action-active')
  if (entry.row.type !== 'match') classes.push(`action-${entry.row.type}`)

  const openTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    onHover({ action, row: entry.row, side, anchor: rect })
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
      aria-label={`${action.abilityName} at ${formatTime(action.relativeTimestamp)}`}
    >
      {action.abilityIcon ? (
        <img src={action.abilityIcon} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="action-blank" />
      )}
    </figure>
  )
}

/**
 * A hand-rolled tween rather than `scroll-behavior: smooth`, because the design
 * calls for a specific 240ms ease and the native behaviour offers no duration
 * control.
 */
function smoothScrollTo(container: HTMLElement, target: number): void {
  const clamped = Math.max(
    0,
    Math.min(target, container.scrollHeight - container.clientHeight),
  )

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const start = container.scrollTop
  const distance = clamped - start

  if (reduced || Math.abs(distance) < 2) {
    container.scrollTop = clamped
    return
  }

  const began = performance.now()
  const DURATION = 240

  const step = (now: number) => {
    const progress = Math.min((now - began) / DURATION, 1)
    // Ease-out cubic: quick departure, settled arrival.
    container.scrollTop = start + distance * (1 - Math.pow(1 - progress, 3))
    if (progress < 1) requestAnimationFrame(step)
  }

  requestAnimationFrame(step)
}
