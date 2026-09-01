import { useState } from 'react'
import { parseFFLogsUrl } from '../lib/fflogsUrl.ts'
import { jobFromName } from '../lib/jobs.ts'
import { PullFacts, PullSelector } from './PullSelector.tsx'
import { PlayerSelector } from './PlayerSelector.tsx'
import type { SideData } from '../hooks/useSideData.ts'
import type { SideId, SideSelection } from '../lib/types.ts'
import './SidePanel.css'

interface Props {
  side: SideId
  data: SideData
  selection: SideSelection
  /** Job chosen on the opposite side, used to hoist matching jobs. */
  counterpartJob: string | null
  onChange: (next: Partial<SideSelection>) => void
}

const TITLE: Record<SideId, string> = {
  left: 'Your log',
  right: 'Reference log',
}

export function SidePanel({
  side,
  data,
  selection,
  counterpartJob,
  onChange,
}: Props) {
  const [draft, setDraft] = useState(selection.url)
  const [touched, setTouched] = useState(false)
  // The pull list only earns its vertical space while there is a choice to
  // make; once a pull is settled it collapses to the one line that matters.
  const [browsingPulls, setBrowsingPulls] = useState(false)
  const pullsOpen = browsingPulls || data.fight == null

  const parsed = parseFFLogsUrl(draft)
  const invalid = touched && draft.trim() !== '' && !parsed

  const submit = () => {
    setTouched(true)
    if (!parsed) return
    // A new report invalidates the fight and player chosen under the old one.
    onChange({
      url: draft,
      code: parsed.code,
      fightId: parsed.fightId ?? null,
      actorId: null,
    })
  }

  return (
    <section className="side-panel">
      <h2 className="side-title">{TITLE[side]}</h2>

      <div className="side-url">
        <label className="label" htmlFor={`${side}-report`}>
          Report URL
        </label>
        <div className="side-url-row">
          <input
            id={`${side}-report`}
            className="input"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="https://www.fflogs.com/reports/…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            aria-invalid={invalid}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={submit}
            disabled={!parsed || parsed.code === selection.code}
          >
            Load
          </button>
        </div>
        {invalid && <p className="helper helper-error">Invalid FFLogs URL.</p>}
      </div>

      {data.error && (
        <div className="side-error">
          <p className="side-error-text">{data.error}</p>
          <p className="helper">
            Change the report or pull above, then load it again.
          </p>
        </div>
      )}

      {data.status === 'loading-report' && <SelectorSkeleton />}

      {data.report && !data.error && (
        <>
          <div className="side-block">
            <h3 className="section-label side-block-head">
              <span>Pull — {data.report.title}</span>
              {data.fight && (
                <button
                  type="button"
                  className="linkish"
                  aria-expanded={pullsOpen}
                  onClick={() => setBrowsingPulls((open) => !open)}
                >
                  {pullsOpen ? 'Done' : 'Change pull'}
                </button>
              )}
            </h3>

            {pullsOpen ? (
              <div className="side-scroll">
                <PullSelector
                  fights={data.report.fights}
                  selectedId={data.fight?.id ?? null}
                  onSelect={(fightId) => {
                    setBrowsingPulls(false)
                    onChange({ fightId, actorId: null })
                  }}
                />
              </div>
            ) : (
              data.fight && (
                <div className="row-card row-card-selected pull-summary">
                  <PullFacts fight={data.fight} />
                </div>
              )
            )}
          </div>

          {data.fight && (
            <div className="side-block">
              <h3 className="section-label">Player</h3>
              {/* No inner scroll: a full party fits, and a second scroll
                  container hid the last two roles behind a hidden overflow. */}
              <div>
                {data.participants.length > 0 ? (
                  <PlayerSelector
                    players={data.participants}
                    selectedId={data.actor?.id ?? null}
                    counterpartJob={counterpartJob}
                    onSelect={(actorId) => onChange({ actorId })}
                  />
                ) : (
                  <p className="helper">
                    This pull lists no players. Select a different pull.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {data.status === 'loading-actions' && (
        <p className="helper side-status">
          Loading actions for {data.actor?.name}…
        </p>
      )}

      {data.status === 'ready' && data.actor && (
        <p className="helper side-status">
          {data.actions?.length} actions loaded for {data.actor.name} —{' '}
          <span className="mono">
            {jobFromName(data.actor.subType).abbreviation}
          </span>
          .
        </p>
      )}
    </section>
  )
}

/** Skeletons match the final dimensions rather than spinning. */
function SelectorSkeleton() {
  return (
    <div className="side-block" aria-hidden>
      <div className="skeleton skeleton-label" />
      <div className="row-list">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton skeleton-row" key={index} />
        ))}
      </div>
    </div>
  )
}
