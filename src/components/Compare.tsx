import { useCallback, useEffect, useState } from 'react'
import { defaultFight } from '../lib/api/fflogs.ts'
import { compareRotations, differenceIndices } from '../lib/diff.ts'
import { jobFromName } from '../lib/jobs.ts'
import { decodeCompareState, encodeCompareState } from '../lib/shareState.ts'
import { navigate, replaceSearch, useRoute } from '../hooks/useRoute.ts'
import { useSideData } from '../hooks/useSideData.ts'
import type { SideData } from '../hooks/useSideData.ts'
import type { SideId, SideSelection, TimelineAction } from '../lib/types.ts'
import { CompareHeader } from './CompareHeader.tsx'
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

  const rows =
    left.actions && right.actions
      ? compareRotations(left.actions, right.actions)
      : []
  const differences = differenceIndices(rows)

  const [cursor, setCursor] = useState(-1)
  const [scrollNonce, setScrollNonce] = useState(0)
  const [comparedActions, setComparedActions] = useState<
    [TimelineAction[] | null, TimelineAction[] | null]
  >([left.actions, right.actions])

  // A new comparison invalidates any parked position. Resetting during render
  // rather than in an effect avoids a frame pointing at a stale difference.
  if (
    comparedActions[0] !== left.actions ||
    comparedActions[1] !== right.actions
  ) {
    setComparedActions([left.actions, right.actions])
    setCursor(-1)
  }

  const step = useCallback(
    (delta: number) => {
      if (differences.length === 0) return
      setCursor((current) => {
        if (current === -1) return delta > 0 ? 0 : differences.length - 1
        const next = current + delta
        if (next < 0) return differences.length - 1
        if (next >= differences.length) return 0
        return next
      })
      setScrollNonce((nonce) => nonce + 1)
    },
    [differences.length],
  )

  useEffect(() => {
    if (!bothReady || showSelection) return

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.isContentEditable) return

      if (event.key === 'j' || event.key === 'J') step(1)
      else if (event.key === 'k' || event.key === 'K') step(-1)
      else return

      event.preventDefault()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bothReady, showSelection, step])

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
        differenceCount={differences.length}
        position={cursor + 1}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
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

      {showSelection ? (
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
        </div>
      ) : rows.length > 0 ? (
        <Timeline
          rows={rows}
          activeIndex={cursor === -1 ? null : differences[cursor]}
          scrollNonce={scrollNonce}
        />
      ) : (
        <EmptyTimeline />
      )}
    </div>
  )
}

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
