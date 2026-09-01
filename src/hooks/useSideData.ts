import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api/client.ts'
import { fetchCasts, fetchReport } from '../lib/api/fflogs.ts'
import type { RawCastEvent } from '../lib/api/fflogs.ts'
import { loadAbilities } from '../lib/api/xivapi.ts'
import { isPlayableJob, jobFromName } from '../lib/jobs.ts'
import { phaseWindows, windowAt } from '../lib/phases.ts'
import type {
  AbilityMeta,
  Actor,
  Fight,
  ReportData,
  SideSelection,
  TimelineAction,
} from '../lib/types.ts'

/**
 * Removes presses that no Action row stands behind.
 *
 * FFLogs emits synthetic ability ids the game has no action for (34603667 and
 * friends). They are not buttons anyone pressed — they are FFLogs bookkeeping —
 * and drawn on a timeline they become a nameless, iconless oGCD that pairs
 * against a real press on the other side and reports a difference that did not
 * happen.
 *
 * The exception is an XIVAPI outage, where *everything* is unresolved: a
 * timeline of blank icons is poor, but it is honest, and better than claiming
 * the pull contained no actions.
 */
function dropUnresolved(
  actions: TimelineAction[],
  abilities: Map<number, AbilityMeta>,
): TimelineAction[] {
  const resolved = actions.filter(
    (action) => !abilities.get(action.abilityId)?.unresolved,
  )
  return resolved.length > 0 ? resolved : actions
}

export type SideStatus =
  | 'empty'
  | 'loading-report'
  | 'awaiting-pull'
  | 'awaiting-player'
  | 'loading-actions'
  | 'ready'
  | 'error'

export interface SideData {
  status: SideStatus
  report: ReportData | null
  fight: Fight | null
  actor: Actor | null
  actions: TimelineAction[] | null
  error: string | null
  /** Players present in the selected fight, ordered as FFLogs lists them. */
  participants: Actor[]
}

/**
 * Reports are frequently shared between the two sides (comparing two pulls
 * from one raid night), and are immutable once uploaded, so caching them for
 * the session avoids a duplicate round trip on every selection change.
 */
const reportCache = new Map<string, Promise<ReportData>>()

function loadReport(code: string): Promise<ReportData> {
  const cached = reportCache.get(code)
  if (cached) return cached

  const request = fetchReport(code).catch((error: unknown) => {
    // Never cache a failure; the user may fix a transient problem and retry.
    reportCache.delete(code)
    throw error
  })

  reportCache.set(code, request)
  return request
}

/**
 * Cast events are immutable for a given report/fight/player, and the two sides
 * routinely ask for the same one — the same player across two pulls, or
 * literally the same pull while the other side is still being chosen. Caching
 * the promise collapses those into a single FFLogs query, and also absorbs
 * StrictMode's double effect invocation in development.
 */
const castCache = new Map<string, Promise<RawCastEvent[]>>()

function loadCasts(
  code: string,
  fight: Fight,
  actorId: number,
): Promise<RawCastEvent[]> {
  const key = `${code}:${fight.id}:${actorId}`
  const cached = castCache.get(key)
  if (cached) return cached

  const request = fetchCasts(code, fight, actorId).catch((error: unknown) => {
    castCache.delete(key)
    throw error
  })

  castCache.set(key, request)
  return request
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong loading this log.'
}

export function useSideData(selection: SideSelection): SideData {
  const [report, setReport] = useState<ReportData | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const [actions, setActions] = useState<TimelineAction[] | null>(null)
  const [actionsError, setActionsError] = useState<string | null>(null)
  const [loadingActions, setLoadingActions] = useState(false)

  const code = selection.code

  useEffect(() => {
    if (!code) {
      setReport(null)
      setReportError(null)
      return
    }

    let cancelled = false
    setLoadingReport(true)
    setReportError(null)

    loadReport(code).then(
      (data) => {
        if (cancelled) return
        setReport(data)
        setLoadingReport(false)
      },
      (error: unknown) => {
        if (cancelled) return
        setReport(null)
        setReportError(messageFor(error))
        setLoadingReport(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [code])

  const fight =
    report && selection.fightId != null
      ? (report.fights.find((entry) => entry.id === selection.fightId) ?? null)
      : null

  const missingFight =
    report != null && selection.fightId != null && fight == null

  // FFLogs lists the Limit Break pseudo-actor and untyped participants under
  // `type: "Player"`. Neither has a rotation to compare, so neither is offered.
  const participants = fight
    ? fight.friendlyPlayers
        .map((id) => report?.actors.find((actor) => actor.id === id))
        .filter((actor): actor is Actor => actor != null)
        .filter((actor) => isPlayableJob(actor.subType))
    : []

  const actor =
    selection.actorId != null
      ? (participants.find((entry) => entry.id === selection.actorId) ?? null)
      : null

  const fightId = fight?.id ?? null
  const actorId = actor?.id ?? null

  useEffect(() => {
    if (!code || !fight || actorId == null) {
      setActions(null)
      setActionsError(null)
      return
    }

    let cancelled = false
    setLoadingActions(true)
    setActionsError(null)

    void (async () => {
      try {
        // Deliberately not abortable: the request is shared through the cache,
        // so cancelling this consumer must not cancel it for the other side.
        const casts = await loadCasts(code, fight, actorId)
        if (cancelled) return

        if (casts.length === 0) {
          throw new ApiError('No supported player actions were found.')
        }

        const abilities = await loadAbilities(
          casts.map((event) => event.abilityGameID),
        )
        if (cancelled) return

        const job = jobFromName(
          participants.find((entry) => entry.id === actorId)?.subType,
        )

        const windows = phaseWindows(fight)

        const normalized: TimelineAction[] = casts.map((event) => {
          const meta = abilities.get(event.abilityGameID)
          const window = windowAt(windows, event.timestamp)
          return {
            timestamp: event.timestamp,
            relativeTimestamp: (event.timestamp - fight.startTime) / 1000,
            phase: window.phase,
            phaseTime: (event.timestamp - window.startTime) / 1000,
            abilityId: event.abilityGameID,
            abilityName: meta?.name ?? `Action #${event.abilityGameID}`,
            abilityIcon: meta?.icon ?? '',
            actorId,
            job: job.abbreviation,
            actionType: meta?.type ?? 'ogcd',
          }
        })

        normalized.sort((a, b) => a.timestamp - b.timestamp)
        setActions(dropUnresolved(normalized, abilities))
        setLoadingActions(false)
      } catch (error) {
        if (cancelled || (error as Error).name === 'AbortError') return
        setActions(null)
        setActionsError(messageFor(error))
        setLoadingActions(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // `participants` is derived from these same inputs, so listing the ids is
    // both sufficient and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, fightId, actorId, fight?.startTime, fight?.endTime])

  const error =
    reportError ??
    (missingFight
      ? `Fight #${selection.fightId} does not exist in this report.`
      : actionsError)

  return {
    status: resolveStatus({
      code,
      loadingReport,
      report,
      error,
      fight,
      actorId,
      loadingActions,
      actions,
    }),
    report,
    fight,
    actor,
    actions,
    error,
    participants,
  }
}

function resolveStatus(input: {
  code: string | null
  loadingReport: boolean
  report: ReportData | null
  error: string | null
  fight: Fight | null
  actorId: number | null
  loadingActions: boolean
  actions: TimelineAction[] | null
}): SideStatus {
  if (!input.code) return 'empty'
  if (input.error) return 'error'
  if (input.loadingReport || !input.report) return 'loading-report'
  if (!input.fight) return 'awaiting-pull'
  if (input.actorId == null) return 'awaiting-player'
  if (input.loadingActions || !input.actions) return 'loading-actions'
  return 'ready'
}
