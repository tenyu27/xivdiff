import { ApiError, graphql } from './client.ts'
import { gameIconUrl } from './xivapi.ts'
import type {
  Actor,
  DamageTable,
  Fight,
  PhaseTransition,
  ReportData,
} from '../types.ts'

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
        phaseTransitions {
          id
          startTime
        }
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

const DAMAGE_TABLE_QUERY = `
query DamageTable(
  $code: String!
  $fightID: Int!
  $sourceID: Int!
  $startTime: Float!
  $endTime: Float!
) {
  reportData {
    report(code: $code) {
      table(
        fightIDs: [$fightID]
        sourceID: $sourceID
        dataType: DamageDone
        viewBy: Ability
        startTime: $startTime
        endTime: $endTime
      )
    }
  }
}`

interface ReportResponse {
  reportData: {
    report: {
      code: string
      title: string
      fights: (Omit<Fight, 'friendlyPlayers' | 'phaseTransitions'> & {
        friendlyPlayers: number[] | null
        phaseTransitions: PhaseTransition[] | null
      })[]
      masterData: { actors: Actor[] | null } | null
    } | null
  }
}

interface EventsResponse<T> {
  reportData: {
    report: {
      events: { data: T[]; nextPageTimestamp: number | null } | null
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

/** The shape of one row of FFLogs' own damage-done table, viewed by ability. */
interface RawTableEntry {
  guid: number
  name: string
  abilityIcon?: string
  total?: number
  totalRDPS?: number
  uses?: number
}

interface TableResponse {
  reportData: {
    report: {
      table: {
        data?: {
          entries?: RawTableEntry[]
          totalTime?: number
          damageDowntime?: number
        }
      } | null
    } | null
  }
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
    // Sorted defensively: every downstream phase lookup assumes ascending.
    phaseTransitions: [...(fight.phaseTransitions ?? [])].sort(
      (a, b) => a.startTime - b.startTime,
    ),
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
async function fetchEvents<T>(
  query: string,
  code: string,
  fight: Fight,
  sourceID: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const events: T[] = []
  let startTime = fight.startTime

  // Bounded so a malformed cursor can never spin forever.
  for (let page = 0; page < 20; page++) {
    const data = await graphql<EventsResponse<T>>(
      query,
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

  return events
}

export async function fetchCasts(
  code: string,
  fight: Fight,
  sourceID: number,
  signal?: AbortSignal,
): Promise<RawCastEvent[]> {
  const events = await fetchEvents<RawCastEvent>(
    EVENTS_QUERY,
    code,
    fight,
    sourceID,
    signal,
  )
  return events.filter((event) => event.type === 'cast')
}

/**
 * Damage per ability over one window, from FFLogs' own damage-done table.
 *
 * The table rather than the raw events, because rDPS is not in the events at
 * all: it is FFLogs' redistribution of each hit across the raid buffs that
 * inflated it, computed server-side. The window is passed through so a phase
 * filter is answered by asking FFLogs about that phase, which is the only way
 * a rate stays honest — a phase's damage over the whole pull's clock is not a
 * number anyone can use.
 */
export async function fetchDamageTable(
  code: string,
  fight: Fight,
  sourceID: number,
  window: { startTime: number; endTime: number },
  signal?: AbortSignal,
): Promise<DamageTable> {
  const response = await graphql<TableResponse>(
    DAMAGE_TABLE_QUERY,
    {
      code,
      fightID: fight.id,
      sourceID,
      startTime: window.startTime,
      endTime: window.endTime,
    },
    signal,
  )

  const data = response.reportData.report?.table?.data
  const entries = data?.entries ?? []

  // FFLogs divides by time the player could actually have been hitting
  // something, not by wall clock: rates computed against the raw window run
  // ~9% below the ones on the site for a fight with any downtime in it.
  const totalTime = data?.totalTime ?? window.endTime - window.startTime
  const active = Math.max(totalTime - (data?.damageDowntime ?? 0), 1)

  return {
    activeSeconds: active / 1000,
    abilities: entries.map((entry) => ({
      abilityId: entry.guid,
      name: entry.name,
      icon: entry.abilityIcon ? gameIconUrl(entry.abilityIcon) : '',
      damage: entry.total ?? 0,
      rdps: entry.totalRDPS ?? 0,
      uses: entry.uses ?? 0,
    })),
  }
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
