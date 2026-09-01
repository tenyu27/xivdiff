import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api/client.ts'
import { fetchCasts, fetchReport } from '../lib/api/fflogs.ts'
import { loadAbilities } from '../lib/api/xivapi.ts'
import { jobFromName } from '../lib/jobs.ts'
import type {
  Actor,
  Fight,
  ReportData,
  SideSelection,
  TimelineAction,
} from '../lib/types.ts'

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

  const participants = fight
    ? fight.friendlyPlayers
        .map((id) => report?.actors.find((actor) => actor.id === id))
        .filter((actor): actor is Actor => actor != null)
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
    const controller = new AbortController()
    setLoadingActions(true)
    setActionsError(null)

    void (async () => {
      try {
        const casts = await fetchCasts(code, fight, actorId, controller.signal)
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

        const normalized: TimelineAction[] = casts.map((event) => {
          const meta = abilities.get(event.abilityGameID)
          return {
            timestamp: event.timestamp,
            relativeTimestamp: (event.timestamp - fight.startTime) / 1000,
            abilityId: event.abilityGameID,
            abilityName: meta?.name ?? `Action #${event.abilityGameID}`,
            abilityIcon: meta?.icon ?? '',
            actorId,
            job: job.abbreviation,
            actionType: meta?.type ?? 'ogcd',
          }
        })

        normalized.sort((a, b) => a.timestamp - b.timestamp)
        setActions(normalized)
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
      controller.abort()
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
