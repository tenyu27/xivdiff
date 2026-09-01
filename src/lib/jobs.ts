import type { JobInfo, RoleKey } from './types.ts'

/**
 * Job table keyed by the name FFLogs reports in `actor.subType`.
 * `id` is the XIVAPI ClassJob row id, which also yields the job icon path.
 * Only combat jobs appear here; base classes are folded into their job.
 */
const JOBS: JobInfo[] = [
  { id: 19, abbreviation: 'PLD', name: 'Paladin', role: 'tank' },
  { id: 21, abbreviation: 'WAR', name: 'Warrior', role: 'tank' },
  { id: 32, abbreviation: 'DRK', name: 'DarkKnight', role: 'tank' },
  { id: 37, abbreviation: 'GNB', name: 'Gunbreaker', role: 'tank' },

  { id: 24, abbreviation: 'WHM', name: 'WhiteMage', role: 'healer' },
  { id: 28, abbreviation: 'SCH', name: 'Scholar', role: 'healer' },
  { id: 33, abbreviation: 'AST', name: 'Astrologian', role: 'healer' },
  { id: 40, abbreviation: 'SGE', name: 'Sage', role: 'healer' },

  { id: 20, abbreviation: 'MNK', name: 'Monk', role: 'melee' },
  { id: 22, abbreviation: 'DRG', name: 'Dragoon', role: 'melee' },
  { id: 30, abbreviation: 'NIN', name: 'Ninja', role: 'melee' },
  { id: 34, abbreviation: 'SAM', name: 'Samurai', role: 'melee' },
  { id: 39, abbreviation: 'RPR', name: 'Reaper', role: 'melee' },
  { id: 41, abbreviation: 'VPR', name: 'Viper', role: 'melee' },

  { id: 23, abbreviation: 'BRD', name: 'Bard', role: 'ranged' },
  { id: 31, abbreviation: 'MCH', name: 'Machinist', role: 'ranged' },
  { id: 38, abbreviation: 'DNC', name: 'Dancer', role: 'ranged' },

  { id: 25, abbreviation: 'BLM', name: 'BlackMage', role: 'caster' },
  { id: 27, abbreviation: 'SMN', name: 'Summoner', role: 'caster' },
  { id: 35, abbreviation: 'RDM', name: 'RedMage', role: 'caster' },
  { id: 42, abbreviation: 'PCT', name: 'Pictomancer', role: 'caster' },
  { id: 36, abbreviation: 'BLU', name: 'BlueMage', role: 'caster' },
]

const BY_NAME = new Map<string, JobInfo>()
for (const job of JOBS) {
  BY_NAME.set(normalizeKey(job.name), job)
  BY_NAME.set(normalizeKey(job.abbreviation), job)
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

const UNKNOWN: JobInfo = {
  id: 0,
  abbreviation: '???',
  name: 'Unknown',
  role: 'other',
}

/** FFLogs writes job names without spaces ("DarkKnight"); tolerate both. */
export function jobFromName(name: string | null | undefined): JobInfo {
  if (!name) return UNKNOWN
  return BY_NAME.get(normalizeKey(name)) ?? { ...UNKNOWN, name }
}

export const ROLE_ORDER: RoleKey[] = [
  'tank',
  'healer',
  'melee',
  'ranged',
  'caster',
  'other',
]

export const ROLE_LABEL: Record<RoleKey, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee DPS',
  ranged: 'Physical Ranged DPS',
  caster: 'Magical Ranged DPS',
  other: 'Other',
}
