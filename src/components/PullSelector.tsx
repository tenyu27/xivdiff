import { formatDuration } from '../lib/layout.ts'
import type { Fight } from '../lib/types.ts'
import './Selectors.css'

interface Props {
  fights: Fight[]
  selectedId: number | null
  onSelect: (fightId: number) => void
}

export function PullSelector({ fights, selectedId, onSelect }: Props) {
  // Latest pull first — the one a player almost always wants to look at.
  const ordered = [...fights].sort((a, b) => b.id - a.id)

  return (
    <ul className="row-list" aria-label="Pull">
      {ordered.map((fight) => {
        const selected = fight.id === selectedId
        const duration = (fight.endTime - fight.startTime) / 1000

        return (
          <li key={fight.id}>
            <button
              type="button"
              className={selected ? 'row-card row-card-selected' : 'row-card'}
              aria-pressed={selected}
              onClick={() => onSelect(fight.id)}
            >
              <span className="mono pull-number">#{fight.id}</span>
              <span className="pull-name">{fight.name}</span>
              <span className="mono pull-duration">
                {formatDuration(duration)}
              </span>
              <span
                className={
                  fight.kill ? 'pull-status pull-status-kill' : 'pull-status'
                }
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
            </button>
          </li>
        )
      })}
    </ul>
  )
}
