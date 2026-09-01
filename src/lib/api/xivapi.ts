import type { AbilityMeta, ActionType } from '../types.ts'

const BASE = 'https://v2.xivapi.com/api'
const FIELDS = 'Name,Icon,ActionCategory.Name,ClassJob.Abbreviation'

/**
 * Action rows are static per patch, so one process-lifetime cache is enough to
 * keep a timeline render from ever touching the network twice for an ability.
 */
const cache = new Map<number, AbilityMeta>()
const inFlight = new Map<number, Promise<void>>()

interface ActionRow {
  row_id: number
  fields: {
    Name: string
    Icon: { path: string } | null
    ActionCategory: { fields: { Name: string } } | null
    ClassJob: { fields: { Abbreviation: string } } | null
  }
}

/**
 * XIVAPI's `ActionCategory` is a reliable GCD/oGCD discriminator: Weaponskill
 * and Spell share the global cooldown, Ability does not. This is why no
 * curated per-job override list is needed.
 */
function classify(category: string | undefined): ActionType {
  return category === 'Weaponskill' || category === 'Spell' ? 'gcd' : 'ogcd'
}

export function assetUrl(path: string): string {
  return `${BASE}/asset?path=${encodeURIComponent(path)}&format=png`
}

/** Framed colour job icons live at 062100 + ClassJob row id. */
export function jobIconUrl(classJobId: number): string | null {
  if (classJobId <= 0) return null
  const index = String(62100 + classJobId).padStart(6, '0')
  return assetUrl(`ui/icon/062000/${index}.tex`)
}

function placeholder(id: number): AbilityMeta {
  return { id, name: `Action #${id}`, icon: '', type: 'ogcd', job: null }
}

/**
 * Resolves metadata for every id, batching uncached ones into chunked
 * requests. Unknown or failed ids degrade to a placeholder rather than
 * failing the whole timeline.
 */
export async function loadAbilities(
  ids: Iterable<number>,
): Promise<Map<number, AbilityMeta>> {
  const wanted = [...new Set(ids)].filter((id) => id > 0)
  const missing = wanted.filter((id) => !cache.has(id) && !inFlight.has(id))

  const CHUNK = 100
  const requests: Promise<void>[] = []

  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK)
    const request = fetchChunk(chunk)
    for (const id of chunk) inFlight.set(id, request)
    requests.push(request)
  }

  // Wait on in-flight requests started by an earlier concurrent call too.
  await Promise.all([
    ...requests,
    ...wanted.map((id) => inFlight.get(id)).filter(Boolean),
  ])

  const result = new Map<number, AbilityMeta>()
  for (const id of wanted) {
    result.set(id, cache.get(id) ?? placeholder(id))
  }
  return result
}

async function fetchChunk(ids: number[]): Promise<void> {
  try {
    const url = `${BASE}/sheet/Action?rows=${ids.join(',')}&fields=${FIELDS}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(String(response.status))

    const payload = (await response.json()) as { rows?: ActionRow[] }

    for (const row of payload.rows ?? []) {
      const fields = row.fields
      const iconPath = fields.Icon?.path
      cache.set(row.row_id, {
        id: row.row_id,
        name: fields.Name || `Action #${row.row_id}`,
        icon: iconPath ? assetUrl(iconPath) : '',
        type: classify(fields.ActionCategory?.fields.Name),
        job: fields.ClassJob?.fields.Abbreviation || null,
      })
    }

    // Ids XIVAPI did not return (removed or synthetic) get a stable placeholder
    // so they are never re-requested.
    for (const id of ids) {
      if (!cache.has(id)) cache.set(id, placeholder(id))
    }
  } catch {
    for (const id of ids) {
      if (!cache.has(id)) cache.set(id, placeholder(id))
    }
  } finally {
    for (const id of ids) inFlight.delete(id)
  }
}
