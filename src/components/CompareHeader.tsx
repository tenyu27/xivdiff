import { useEffect, useState } from 'react'
import { jobFromName } from '../lib/jobs.ts'
import { formatDuration } from '../lib/layout.ts'
import type { SideData } from '../hooks/useSideData.ts'
import type { SideId } from '../lib/types.ts'
import './CompareHeader.css'

interface Props {
  left: SideData
  right: SideData
  differenceCount: number
  /** 1-based position within the difference list, or 0 when parked nowhere. */
  position: number
  onPrevious: () => void
  onNext: () => void
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
      <div className="identity-text">
        <p className="identity-label">
          {side === 'left' ? 'Your pull' : 'Reference'}
        </p>
        <p className="identity-name">
          {data.actor?.name ?? 'No player selected'}
          {job && <span className="mono identity-job">{job.abbreviation}</span>}
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
  differenceCount,
  position,
  onPrevious,
  onNext,
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

  const navigable = differenceCount > 0

  return (
    <header className="compare-header">
      <SideIdentity data={left} side="left" onEdit={onEdit} />

      <div className="header-center">
        <div className="header-diffs">
          <p className="mono header-count">
            {differenceCount}
            <span className="header-count-label">
              {differenceCount === 1 ? 'difference' : 'differences'}
            </span>
          </p>

          <div className="header-nav">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onPrevious}
              disabled={!navigable}
            >
              Previous <span className="kbd">K</span>
            </button>
            <p className="mono header-position">
              {/* Position 0 would be meaningless: nothing is selected yet. */}
              {navigable && position > 0
                ? `${position} / ${differenceCount}`
                : '—'}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onNext}
              disabled={!navigable}
            >
              Next <span className="kbd">J</span>
            </button>
          </div>
        </div>

        <div className="header-utilities">
          <button type="button" className="btn btn-secondary" onClick={share}>
            {copied ? 'Link copied' : 'Share'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <SideIdentity data={right} side="right" onEdit={onEdit} />
    </header>
  )
}
