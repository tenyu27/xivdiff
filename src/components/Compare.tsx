import { useCallback, useEffect, useState } from 'react'
import { defaultFight } from '../lib/api/fflogs.ts'
import { compareByOrder, compareRotations, rowPhase } from '../lib/diff.ts'
import { jobFromName } from '../lib/jobs.ts'
import { decodeCompareState, encodeCompareState } from '../lib/shareState.ts'
import { navigate, replaceSearch, useRoute } from '../hooks/useRoute.ts'
import { useSideData } from '../hooks/useSideData.ts'
import type { SideData } from '../hooks/useSideData.ts'
import type {
  CompareView,
  SideId,
  SideSelection,
  TimelineAction,
} from '../lib/types.ts'
import { CompareHeader } from './CompareHeader.tsx'
import { Sequence } from './Sequence.tsx'
import { SidePanel } from './SidePanel.tsx'
import { Timeline } from './Timeline.tsx'
import './Compare.css'

interface Props {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function Compare({ theme, onToggleTheme }: Props) {
  const route = useRoute()
  // The URL is the only home for comparison state, which is what makes a
  // pasted link reconstruct the same view with no storage behind it.
  const state = decodeCompareState(route.search)

  const left = useSideData(state.left)
  const right = useSideData(state.right)

  const update = useCallback(
    (side: SideId, patch: Partial<SideSelection>) => {
      const current = decodeCompareState(
        window.location.hash.split('?')[1] ?? '',
      )
      replaceSearch(
        '/compare',
        encodeCompareState({ ...current, [side]: { ...current[side], ...patch } }),
      )
    },
    [],
  )

  // The view is comparison state like any other, so it rides in the URL and a
  // shared link opens on the view its author was reading.
  const setView = useCallback((view: CompareView) => {
    const current = decodeCompareState(window.location.hash.split('?')[1] ?? '')
    replaceSearch('/compare', encodeCompareState({ ...current, view }))
  }, [])

  // Apply the default pull as soon as a report lands, so the common case is one
  // click away rather than two.
  useApplyDefaultFight('left', left, state.left, update)
  useApplyDefaultFight('right', right, state.right, update)

  const [editing, setEditing] = useState<SideId | null>(null)

  const changeSide = (side: SideId, patch: Partial<SideSelection>) => {
    update(side, patch)
    // Picking a player is the last step for a side, so an edit opened from the
    // header closes itself rather than stranding the user on the selectors.
    if (patch.actorId != null && editing === side) setEditing(null)
  }

  const bothReady = left.status === 'ready' && right.status === 'ready'
  const showSelection = !bothReady || editing !== null

  // Both players are chosen and only the casts are still in flight. Leaving the
  // selectors up through that made the last click land on the panel it was
  // already looking at and then jump-cut to a full timeline; standing the shape
  // of the comparison up first turns that into one continuous move.
  const settling = !bothReady && editing === null && isSettling(left) &&
    isSettling(right)

  // Each view aligns on the thing it is about: cast order pins the GCD chain
  // position by position, cast timing pairs on the clock. Sharing one alignment
  // would make one of the two views answer the other's question.
  const compare = state.view === 'timeline' ? compareRotations : compareByOrder

  const allRows =
    left.actions && right.actions ? compare(left.actions, right.actions) : []

  const phases = [...new Set(allRows.map(rowPhase))].sort((a, b) => a - b)

  const [phase, setPhase] = useState<number | null>(null)
  const [comparedActions, setComparedActions] = useState<
    [TimelineAction[] | null, TimelineAction[] | null]
  >([left.actions, right.actions])

  // A new comparison invalidates the phase filter — phase 3 of the old pull is
  // not phase 3 of the new one. Resetting during render rather than in an
  // effect avoids a frame showing rows filtered by a stale phase.
  if (
    comparedActions[0] !== left.actions ||
    comparedActions[1] !== right.actions
  ) {
    setComparedActions([left.actions, right.actions])
    setPhase(null)
  }

  // `null` is every phase, which is also what a phase the new comparison does
  // not have falls back to.
  const active = phase != null && phases.includes(phase) ? phase : null
  const rows =
    active == null ? allRows : allRows.filter((row) => rowPhase(row) === active)

  const jobOf = (data: SideData): string | null =>
    data.actor ? jobFromName(data.actor.subType).abbreviation : null

  const leftJob = jobOf(left)
  const rightJob = jobOf(right)
  const crossJob = leftJob != null && rightJob != null && leftJob !== rightJob

  return (
    <div className="compare">
      <CompareHeader
        left={left}
        right={right}
        phases={phases}
        phase={active}
        onPhaseChange={setPhase}
        view={state.view}
        onViewChange={setView}
        onEdit={(side) =>
          setEditing((current) => (current === side ? null : side))
        }
        onReset={() => navigate('/')}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {crossJob && (
        <p className="cross-job">
          Comparing <span className="mono">{leftJob}</span> with{' '}
          <span className="mono">{rightJob}</span>. Direct action matching may
          not be meaningful.
        </p>
      )}

      {settling ? (
        <ComparisonSkeleton />
      ) : showSelection ? (
        // The action bar is a sibling of the scrolling panels, not a child of
        // them: as a child it rode over the last rows of the player list.
        <>
          <div className="selection-region">
            <SidePanel
              side="left"
              data={left}
              selection={state.left}
              counterpartJob={rightJob}
              onChange={(patch) => changeSide('left', patch)}
            />
            <SidePanel
              side="right"
              data={right}
              selection={state.right}
              counterpartJob={leftJob}
              onChange={(patch) => changeSide('right', patch)}
            />
          </div>

          {bothReady && (
            <div className="selection-done">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditing(null)}
              >
                Show comparison
              </button>
            </div>
          )}
        </>
      ) : rows.length > 0 ? (
        state.view === 'timeline' ? (
          <Timeline rows={rows} />
        ) : (
          <Sequence rows={rows} />
        )
      ) : (
        <EmptyTimeline />
      )}
    </div>
  )
}

/** A side that has everything chosen and is only waiting on its casts. */
function isSettling(data: SideData): boolean {
  return data.status === 'loading-actions' || data.status === 'ready'
}

/**
 * The comparison's own shape, drawn before its data arrives.
 *
 * Not a spinner and not a slab: the rhythm of a rotation — a GCD, the weave
 * after it, the next GCD — either side of the same separator the real view
 * uses, at the dimensions the real rows will have. The eye settles on the
 * layout during the wait, so when the icons land they only have to fill it in.
 */
function ComparisonSkeleton() {
  return (
    <div
      className="compare-skeleton"
      role="status"
      aria-label="Loading comparison"
    >
      <div className="compare-skeleton-inner">
        <span className="compare-skeleton-spine" aria-hidden />

        {SKELETON_RHYTHM.map((kind, index) => (
          <div className={`skel-row skel-row-${kind}`} key={index}>
            {/* Filling top to bottom rather than pulsing in unison: the same
                direction the real cascade runs when it replaces this. */}
            <span
              className={`skeleton skel-icon skel-icon-${kind}`}
              style={{ animationDelay: `${index * 60}ms` }}
            />
            <span
              className={`skeleton skel-icon skel-icon-${kind}`}
              style={{ animationDelay: `${index * 60}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Roughly a double-weave opener: enough variation to read as a rotation. */
const SKELETON_RHYTHM = [
  'gcd',
  'ogcd',
  'ogcd',
  'gcd',
  'gcd',
  'ogcd',
  'gcd',
  'gcd',
  'ogcd',
  'ogcd',
  'gcd',
  'gcd',
  'ogcd',
  'gcd',
]

/**
 * Prefer a kill, otherwise the latest pull — applied once per report, and only
 * when the URL did not already name a fight.
 */
function useApplyDefaultFight(
  side: SideId,
  data: SideData,
  selection: SideSelection,
  update: (side: SideId, patch: Partial<SideSelection>) => void,
): void {
  const reportCode = data.report?.code ?? null
  const hasFight = selection.fightId != null
  const fights = data.report?.fights

  useEffect(() => {
    if (!fights || hasFight) return
    const fight = defaultFight(fights)
    if (fight) update(side, { fightId: fight.id })
  }, [reportCode, hasFight, side, update, fights])
}

/** Structural and instructive rather than the words "No data". */
function EmptyTimeline() {
  return (
    <div className="empty-timeline">
      <div className="empty-sketch" aria-hidden>
        <span className="empty-track" />
        <span className="empty-spine" />
        <span className="empty-track" />
      </div>
      <p className="empty-directive">
        Both rotations loaded, but no actions were found to compare.
      </p>
    </div>
  )
}
