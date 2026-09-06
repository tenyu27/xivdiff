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

/**
 * What one ability did over a window, as FFLogs accounts for it.
 *
 * `rdps` is raid-contributed damage: the hit's own number after FFLogs has
 * moved the share the raid's buffs are responsible for onto the players who
 * pressed them. It is the figure a rotation is judged on, and it exists only in
 * FFLogs' aggregate — no cast or damage event carries it.
 *
 * Rows appear here that no cast list has: a DoT that ticks in a phase it was
 * not pressed in, and a song or a buff, which deals nothing itself and still
 * carries rDPS given to the raid.
 */
export interface AbilityDamage {
  abilityId: number
  name: string
  icon: string
  /** Raw damage dealt. */
  damage: number
  /** Raid-contributed damage over the window, not yet divided by its length. */
  rdps: number
  /** Casts as FFLogs counts them, for abilities the cast list does not carry. */
  uses: number
}

export interface DamageTable {
  abilities: AbilityDamage[]
  /**
   * The denominator behind every rate: the window's length less the time the
   * player had nothing to hit. Dividing by wall clock instead puts every number
   * about 9% under the ones on FFLogs' own page.
   */
  activeSeconds: number
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
 * How the comparison is drawn. `summary` counts casts per ability and is the
 * default — the cheapest question to answer, and the one that decides whether
 * a press-by-press read is even needed; `sequence` compares press order;
 * `timeline` places presses on a phase-relative clock.
 */
export type CompareView = 'summary' | 'sequence' | 'timeline'

/** Per-side selection, the unit of shareable state. */
export interface SideSelection {
  url: string
  code: string | null
  fightId: number | null
  actorId: number | null
}
