import { useState } from 'react'
import { formatDuration } from '../lib/layout.ts'
import type { Fight } from '../lib/types.ts'
import './Selectors.css'

interface Props {
  fights: Fight[]
  selectedId: number | null
  onSelect: (fightId: number) => void
}

/** Shared by the list rows and the collapsed summary so both read identically. */
export function PullFacts({ fight }: { fight: Fight }) {
  const duration = (fight.endTime - fight.startTime) / 1000

  return (
    <>
      <span className="mono pull-number">#{fight.id}</span>
      <span className="pull-name">{fight.name}</span>
      <span className="mono pull-duration">{formatDuration(duration)}</span>
      <span
        className={fight.kill ? 'pull-status pull-status-kill' : 'pull-status'}
      >
        {fight.kill ? 'Kill' : 'Wipe'}
        {/* FFLogs v2 reports this as a plain percentage (7.85), not
            hundredths, so it is rendered as-is. */}
        {!fight.kill && fight.bossPercentage != null && (
          <span className="mono pull-percent">
            {fight.bossPercentage.toFixed(1)}%
          </span>
        )}
      </span>
    </>
  )
}

export function PullSelector({ fights, selectedId, onSelect }: Props) {
  // Kills are what a rotation is normally read from, so they are the default
  // view. A report with none falls back to every pull rather than to nothing.
  const [killsOnly, setKillsOnly] = useState(true)

  const kills = fights.filter((fight) => fight.kill)
  // With no kills to show the filter is not in effect, so the switch must not
  // sit in its on position claiming otherwise.
  const filtering = killsOnly && kills.length > 0
  const filtered = filtering ? kills : fights

  // Latest pull first — the one a player almost always wants to look at.
  const ordered = [...filtered].sort((a, b) => b.id - a.id)

  return (
    <div className="pull-region">
      <div className="pull-filter">
        {/* A switch, not a chip: an unlabelled on/off state has to read as on
            or off at a glance, and a chip only reads as "on" by its colour. */}
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={filtering}
          disabled={kills.length === 0}
          onClick={() => setKillsOnly((on) => !on)}
        >
          <span className="switch-track">
            <span className="switch-knob" />
          </span>
          <span className="switch-label">Kills only</span>
        </button>
        <span className="mono pull-filter-count">
          {kills.length === 0
            ? `No kills · ${fights.length} pulls`
            : `${ordered.length} of ${fights.length}`}
        </span>
      </div>

      <ul className="row-list" aria-label="Pull">
        {ordered.map((fight) => {
          const selected = fight.id === selectedId

          return (
            <li key={fight.id}>
              <button
                type="button"
                className={selected ? 'row-card row-card-selected' : 'row-card'}
                aria-pressed={selected}
                onClick={() => onSelect(fight.id)}
              >
                <PullFacts fight={fight} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
