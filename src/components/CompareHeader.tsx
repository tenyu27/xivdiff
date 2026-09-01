import { useEffect, useState } from 'react'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { jobFromName } from '../lib/jobs.ts'
import { formatDuration } from '../lib/layout.ts'
import type { SideData } from '../hooks/useSideData.ts'
import type { CompareView, SideId } from '../lib/types.ts'
import { JobIcon } from './JobIcon.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import './CompareHeader.css'

interface Props {
  left: SideData
  right: SideData
  /** Phases present in the comparison, ascending. */
  phases: number[]
  /** The phase being shown, or `null` for all of them. */
  phase: number | null
  onPhaseChange: (phase: number | null) => void
  view: CompareView
  onViewChange: (view: CompareView) => void
  onEdit: (side: SideId) => void
  onReset: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

function SideIdentity({
  data,
  side,
  onEdit,
}: {
  data: SideData
  side: SideId
  onEdit: (side: SideId) => void
}) {
  const job = data.actor ? jobFromName(data.actor.subType) : null
  const duration = data.fight
    ? (data.fight.endTime - data.fight.startTime) / 1000
    : null

  return (
    <div className={`identity identity-${side}`}>
      {/* Job identity is the icon, never the abbreviation repeated as text. */}
      {job && <JobIcon job={job} size={28} />}
      <div className="identity-text">
        <p className="identity-label">
          {side === 'left' ? 'Your pull' : 'Reference'}
        </p>
        <p className="identity-name">
          {data.actor?.name ?? 'No player selected'}
        </p>
        <p className="mono identity-meta">
          {data.fight ? `Fight #${data.fight.id}` : '—'}
          {duration != null && ` · ${formatDuration(duration)}`}
        </p>
      </div>
      <button
        type="button"
        className="btn btn-secondary identity-edit"
        onClick={() => onEdit(side)}
      >
        Change
      </button>
    </div>
  )
}

export function CompareHeader({
  left,
  right,
  phases,
  phase,
  onPhaseChange,
  view,
  onViewChange,
  onEdit,
  onReset,
  theme,
  onToggleTheme,
}: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard access can be denied; the URL is in the address bar anyway.
    }
  }

  return (
    <header className="compare-header">
      <SideIdentity data={left} side="left" onEdit={onEdit} />

      <div className="header-center">
        {/* Named for what each view lets you read, not for how it is drawn:
            one answers "did we press the same buttons in the same order", the
            other "when did each press land". */}
        <label className="header-select">
          <span className="label header-select-label">View</span>
          <select
            className="select"
            value={view}
            onChange={(event) =>
              onViewChange(event.target.value as CompareView)
            }
          >
            <option value="sequence">Cast order</option>
            <option value="timeline">Cast timing</option>
          </select>
        </label>

        {/* Only offered when there is more than one phase to choose between. */}
        {phases.length > 1 && (
          <label className="header-select">
            <span className="label header-select-label">Phase</span>
            <select
              className="select"
              value={phase ?? 'all'}
              onChange={(event) =>
                onPhaseChange(
                  event.target.value === 'all'
                    ? null
                    : Number(event.target.value),
                )
              }
            >
              <option value="all">All phases</option>
              {phases.map((entry) => (
                <option key={entry} value={entry}>
                  Phase {entry}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="header-utilities">
          {/* "Share" names an intention and leaves the mechanism to be guessed
              — a dialog? a service? What the button does is put this URL on the
              clipboard, so it says that and carries the clipboard glyph, and
              the confirmation swaps only the glyph and the verb's tense. */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={share}
            title="Copy a link to this comparison"
          >
            {copied ? <IconCheck /> : <IconCopy />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <SideIdentity data={right} side="right" onEdit={onEdit} />
    </header>
  )
}
