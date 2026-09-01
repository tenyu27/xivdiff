import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { formatTime } from '../lib/layout.ts'
import { GAP_THRESHOLD_S, layoutSequence } from '../lib/sequence.ts'
import type { SequenceRow } from '../lib/sequence.ts'
import type { MatchedAction, SideId, TimelineAction } from '../lib/types.ts'
import { Tooltip } from './Tooltip.tsx'
import type { TooltipState } from './Tooltip.tsx'
import './Sequence.css'

const TOOLTIP_DELAY = 120

/**
 * What to write beside an icon, on that icon's own outer side.
 *
 * Only absence is worth a word. A pair of different abilities at the same beat
 * needs no label — both icons are right there, side by side, and the ochre
 * border already says they disagree; naming it "swapped" only asserted an
 * intent the data does not carry.
 */
function noteFor(row: MatchedAction, side: SideId): string | null {
  if (row.type === 'left-only') return side === 'left' ? 'extra' : null
  if (row.type === 'right-only') return side === 'right' ? 'missing' : null
  return null
}

interface Props {
  rows: MatchedAction[]
}

/**
 * Press order, side by side.
 *
 * Every aligned pair is one row of equal weight, joined across the middle by a
 * single hairline; the middle column separates the two pulls and carries
 * nothing else. Because rows are evenly spaced rather than placed on a clock,
 * two pulls that pressed the same buttons in the same order line up exactly,
 * however far apart in real time they drifted.
 */
export function Sequence({ rows }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [staggering, setStaggering] = useState(true)

  const blocks = layoutSequence(rows)
  const phased = blocks.length > 1
  const total = rows.length

  // The cascade plays once, on mount.
  useEffect(() => {
    const timer = window.setTimeout(() => setStaggering(false), 500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="sequence">
      <div
        className={staggering ? 'sequence-inner staggering' : 'sequence-inner'}
      >
        <div className="sequence-spine" aria-hidden />

        {blocks.map((block) => (
          <div className="sequence-block" key={block.phase}>
            {phased && (
              <div className="sequence-phase">
                <span className="sequence-phase-label">
                  Phase {block.phase}
                </span>
              </div>
            )}

            {block.rows.map((entry) => (
              <Row
                key={entry.index}
                entry={entry}
                total={total}
                onHover={setTooltip}
              />
            ))}
          </div>
        ))}
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

/** Height of an idle break: proportional to the silence, capped so a two-minute
 *  downtime does not push the rest of the phase off the screen. */
function gapHeight(seconds: number): number {
  return Math.min(36 + (seconds - GAP_THRESHOLD_S) * 6, 120)
}

interface RowProps {
  entry: SequenceRow
  total: number
  onHover: (state: TooltipState | null) => void
}

function Row({ entry, total, onHover }: RowProps) {
  const { row } = entry
  const stagger = staggerStyle(entry.index, total)

  // A pair is joined right across the middle; a one-sided press runs its line
  // only as far as the separator, so the eye sees where the other pull stopped.
  const reach =
    row.left && row.right ? 'both' : row.left ? 'left' : 'right'

  const classes = [
    'seq-row',
    entry.isGcd ? 'seq-row-gcd' : 'seq-row-ogcd',
    `seq-row-${row.type}`,
  ]

  return (
    <>
      {entry.gapSeconds != null && (
        // The break grows with the silence it stands for, up to a cap: a
        // fixed-height break made a four-second clip and a wiped-and-waiting
        // half minute look like the same event.
        <div
          className="seq-gap"
          style={{ height: gapHeight(entry.gapSeconds), ...stagger }}
        >
          <span className="mono seq-gap-label">
            {Math.round(entry.gapSeconds)}s
          </span>
        </div>
      )}

      <div className={classes.join(' ')} style={stagger}>
        <Cell entry={entry} side="left" onHover={onHover} />
        <div className={`seq-link seq-link-${reach}`} aria-hidden>
          <span className="seq-link-line" />
        </div>
        <Cell entry={entry} side="right" onHover={onHover} />
      </div>
    </>
  )
}

interface CellProps {
  entry: SequenceRow
  side: SideId
  onHover: (state: TooltipState | null) => void
}

function Cell({ entry, side, onHover }: CellProps) {
  const action = side === 'left' ? entry.row.left : entry.row.right
  const note = action ? noteFor(entry.row, side) : null

  const icon = action && <Icon action={action} side={side} onHover={onHover} />
  const label = note && <span className="mono seq-note">{note}</span>
  // The note always sits outboard of its icon, on the outer edge of its own
  // track, so the middle stays a separator and nothing else.
  const content = side === 'left' ? [label, icon] : [icon, label]

  return (
    <div className={`seq-cell seq-cell-${side}`}>
      {content[0]}
      {content[1]}
    </div>
  )
}

interface IconProps {
  action: TimelineAction
  side: SideId
  onHover: (state: TooltipState | null) => void
}

function Icon({ action, side, onHover }: IconProps) {
  const timer = useRef<number | undefined>(undefined)

  const openTooltip = (element: HTMLElement) => {
    onHover({ action, side, anchor: element.getBoundingClientRect() })
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
      className={
        action.actionType === 'gcd' ? 'seq-icon seq-icon-gcd' : 'seq-icon seq-icon-ogcd'
      }
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
        <span className="seq-icon-blank" />
      )}
    </figure>
  )
}
