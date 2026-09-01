export type SideId = 'left' | 'right'

export type RoleKey =
  | 'tank'
  | 'healer'
  | 'melee'
  | 'ranged'
  | 'caster'
  | 'other'

export interface JobInfo {
  /** XIVAPI ClassJob row id, also used to build the job icon path. */
  id: number
  abbreviation: string
  /** Display name as FFLogs reports it, e.g. "Bard". */
  name: string
  role: RoleKey
}

/** A parsed FFLogs URL. */
export interface ReportRef {
  code: string
  fightId?: number
}

/** One phase boundary, in the same report-relative milliseconds as a Fight. */
export interface PhaseTransition {
  id: number
  startTime: number
}

export interface Fight {
  id: number
  name: string
  kill: boolean | null
  /** Milliseconds into the report. */
  startTime: number
  endTime: number
  /** Remaining boss HP percentage for wipes, when FFLogs provides it. */
  bossPercentage: number | null
  friendlyPlayers: number[]
  /** Ascending; empty for encounters FFLogs does not phase. */
  phaseTransitions: PhaseTransition[]
}

export interface Actor {
  id: number
  name: string
  /** FFLogs `subType`, e.g. "Bard". Maps to a JobInfo. */
  subType: string
  server: string | null
}

export interface ReportData {
  code: string
  title: string
  fights: Fight[]
  actors: Actor[]
}

export type ActionType = 'gcd' | 'ogcd'

/** XIVAPI-sourced metadata for one action, cached per ability id. */
export interface AbilityMeta {
  id: number
  name: string
  icon: string
  type: ActionType
  job: string | null
  /**
   * No Action row stands behind this id. Either FFLogs invented it — it emits
   * synthetic ability ids the game does not have — or XIVAPI could not be
   * reached. The fields above are a placeholder in that case, so a consumer
   * that shows actions to a player should drop these rather than draw a
   * nameless, iconless press that never happened.
   */
  unresolved?: boolean
}

/**
 * The normalized shape the whole visualisation layer works on. Nothing
 * downstream of the loaders knows that FFLogs exists.
 */
export interface TimelineAction {
  timestamp: number
  /** Seconds since fight start. */
  relativeTimestamp: number
  /**
   * 1-based phase this action was cast in. Comparison and placement are both
   * phase-relative, so a pull that reaches phase 2 early does not push every
   * later action out of alignment with the other side.
   */
  phase: number
  /** Seconds since the start of `phase`. */
  phaseTime: number
  abilityId: number
  abilityName: string
  abilityIcon: string
  actorId: number
  job: string
  actionType: ActionType
}

export type DiffType =
  | 'match'
  | 'timing-difference'
  | 'left-only'
  | 'right-only'
  | 'mismatch'

export interface MatchedAction {
  left?: TimelineAction
  right?: TimelineAction
  type: DiffType
  /** left.relativeTimestamp - right.relativeTimestamp, in milliseconds. */
  deltaMs?: number
}

/**
 * How the comparison is drawn. `sequence` compares press order and is the
 * default; `timeline` is the original time-placed view, kept but unlisted.
 */
export type CompareView = 'sequence' | 'timeline'

/** Per-side selection, the unit of shareable state. */
export interface SideSelection {
  url: string
  code: string | null
  fightId: number | null
  actorId: number | null
}
