import { ApiError, graphql } from './client.ts'
import type { Actor, Fight, ReportData } from '../types.ts'

const REPORT_QUERY = `
query Report($code: String!) {
  reportData {
    report(code: $code) {
      code
      title
      fights(translate: true) {
        id
        name
        kill
        startTime
        endTime
        bossPercentage
        friendlyPlayers
      }
      masterData(translate: true) {
        actors(type: "Player") {
          id
          name
          subType
          server
        }
      }
    }
  }
}`

const EVENTS_QUERY = `
query Casts(
  $code: String!
  $fightID: Int!
  $sourceID: Int!
  $startTime: Float!
  $endTime: Float!
) {
  reportData {
    report(code: $code) {
      events(
        fightIDs: [$fightID]
        sourceID: $sourceID
        dataType: Casts
        startTime: $startTime
        endTime: $endTime
        limit: 10000
        useAbilityIDs: true
      ) {
        data
        nextPageTimestamp
      }
    }
  }
}`

interface ReportResponse {
  reportData: {
    report: {
      code: string
      title: string
      fights: (Omit<Fight, 'friendlyPlayers'> & {
        friendlyPlayers: number[] | null
      })[]
      masterData: { actors: Actor[] | null } | null
    } | null
  }
}

interface EventsResponse {
  reportData: {
    report: {
      events: { data: RawCastEvent[]; nextPageTimestamp: number | null } | null
    } | null
  }
}

/**
 * The shape FFLogs returns with `useAbilityIDs: true`. With it set to false the
 * events carry a nested `ability { guid }` object instead and no
 * `abilityGameID` at all, so the flag and this type must stay in step.
 */
export interface RawCastEvent {
  timestamp: number
  type: string
  sourceID: number
  abilityGameID: number
  targetID?: number
}

export async function fetchReport(
  code: string,
  signal?: AbortSignal,
): Promise<ReportData> {
  const data = await graphql<ReportResponse>(REPORT_QUERY, { code }, signal)
  const report = data.reportData.report

  if (!report) {
    throw new ApiError('Report could not be found.')
  }

  const fights = (report.fights ?? []).map((fight) => ({
    ...fight,
    friendlyPlayers: fight.friendlyPlayers ?? [],
  }))

  if (fights.length === 0) {
    throw new ApiError('This report contains no fights.')
  }

  return {
    code: report.code,
    title: report.title,
    fights,
    actors: report.masterData?.actors ?? [],
  }
}

/**
 * FFLogs paginates events by timestamp. Follow `nextPageTimestamp` until it
 * runs out so long fights come back complete.
 */
export async function fetchCasts(
  code: string,
  fight: Fight,
  sourceID: number,
  signal?: AbortSignal,
): Promise<RawCastEvent[]> {
  const events: RawCastEvent[] = []
  let startTime = fight.startTime

  // Bounded so a malformed cursor can never spin forever.
  for (let page = 0; page < 20; page++) {
    const data = await graphql<EventsResponse>(
      EVENTS_QUERY,
      {
        code,
        fightID: fight.id,
        sourceID,
        startTime,
        endTime: fight.endTime,
      },
      signal,
    )

    const result = data.reportData.report?.events
    if (!result) break

    events.push(...result.data)

    if (result.nextPageTimestamp == null) break
    startTime = result.nextPageTimestamp
  }

  return events.filter((event) => event.type === 'cast')
}

/** Prefer a kill; otherwise the latest pull. */
export function defaultFight(fights: Fight[]): Fight | null {
  if (fights.length === 0) return null

  const kills = fights.filter((fight) => fight.kill)
  const pool = kills.length > 0 ? kills : fights

  return pool.reduce((latest, fight) =>
    fight.id > latest.id ? fight : latest,
  )
}
