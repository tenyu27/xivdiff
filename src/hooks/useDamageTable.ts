import { useEffect, useState } from 'react'
import { fetchDamageTable } from '../lib/api/fflogs.ts'
import { phaseWindows } from '../lib/phases.ts'
import type { DamageTable, Fight } from '../lib/types.ts'
import type { SideData } from './useSideData.ts'

/**
 * Report-relative bounds of one phase, or of the whole pull when no phase is
 * filtered. The end of a phase is the start of the next one — FFLogs' phase
 * transitions are already a complete partition of the fight.
 */
function windowFor(
  fight: Fight,
  phase: number | null,
): { startTime: number; endTime: number } {
  if (phase == null) {
    return { startTime: fight.startTime, endTime: fight.endTime }
  }

  const windows = phaseWindows(fight)
  const index = windows.findIndex((entry) => entry.phase === phase)
  if (index === -1) {
    return { startTime: fight.startTime, endTime: fight.endTime }
  }

  return {
    startTime: windows[index].startTime,
    endTime: windows[index + 1]?.startTime ?? fight.endTime,
  }
}

/**
 * FFLogs is billed by points, and the two sides routinely ask for the same
 * window — the same player across two pulls, or the same pull while the other
 * side is still being chosen. Caching the promise per window collapses those
 * into one query, and re-selecting a phase already looked at costs nothing.
 */
const tableCache = new Map<string, Promise<DamageTable>>()

function loadTable(
  code: string,
  fight: Fight,
  actorId: number,
  window: { startTime: number; endTime: number },
): Promise<DamageTable> {
  const key = `${code}:${fight.id}:${actorId}:${window.startTime}:${window.endTime}`
  const cached = tableCache.get(key)
  if (cached) return cached

  const request = fetchDamageTable(code, fight, actorId, window).catch(
    (error: unknown) => {
      tableCache.delete(key)
      throw error
    },
  )

  tableCache.set(key, request)
  return request
}

export interface DamageTableState {
  table: DamageTable | null
  loading: boolean
}

/**
 * Damage and rDPS for one side over the filtered window.
 *
 * Deliberately separate from `useSideData`: the rotation does not depend on the
 * phase filter and this does, so folding it in would refetch every cast the
 * moment someone changed the phase select. It is also enrichment rather than
 * the product — a side stays `ready` on its casts, and a table that fails
 * leaves the summary without its damage columns instead of without a rotation.
 */
export function useDamageTable(
  data: SideData,
  phase: number | null,
): DamageTableState {
  const [table, setTable] = useState<DamageTable | null>(null)
  const [loading, setLoading] = useState(false)

  const code = data.report?.code ?? null
  const fight = data.fight
  const actorId = data.actor?.id ?? null
  const window = fight ? windowFor(fight, phase) : null

  const start = window?.startTime ?? null
  const end = window?.endTime ?? null

  useEffect(() => {
    if (!code || !fight || actorId == null || start == null || end == null) {
      setTable(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    loadTable(code, fight, actorId, { startTime: start, endTime: end }).then(
      (result) => {
        if (cancelled) return
        setTable(result)
        setLoading(false)
      },
      () => {
        if (cancelled) return
        setTable(null)
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
    // The fight object is identified by the ids and bounds already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, fight?.id, actorId, start, end])

  return { table, loading }
}
