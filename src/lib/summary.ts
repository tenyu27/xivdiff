import type {
  ActionType,
  DamageTable,
  TimelineAction,
} from './types.ts'

export interface SummarySide {
  casts: number
  damage: number
  /** Raid-contributed damage per second over the window. */
  rdps: number
}

export interface SummaryRow {
  abilityId: number
  name: string
  icon: string
  actionType: ActionType
  left: SummarySide
  right: SummarySide
  /** left - right, per measure. Zero means the two pulls agree on it. */
  castDelta: number
  rdpsDelta: number
}

export interface SummaryTotals {
  left: SummarySide
  right: SummarySide
  leftGcd: number
  rightGcd: number
  leftOgcd: number
  rightOgcd: number
}

export interface Summary {
  rows: SummaryRow[]
  totals: SummaryTotals
  /**
   * The largest single-side figure in the table, and what the bars measure.
   * rDPS is the scale whenever there is any, because that is what a rotation is
   * finally judged on; a window with no damage in it at all falls back to cast
   * counts so the column is never a row of empty cells.
   */
  peak: number
  scale: 'rdps' | 'casts'
}

const EMPTY: SummarySide = { casts: 0, damage: 0, rdps: 0 }

/**
 * Casts and rDPS per ability, both sides, ordered by what each ability was
 * worth to the raid.
 *
 * Two sources meet here and neither subsumes the other. Casts come from the
 * cast events, which are what the detailed views align and what the phase
 * filter has already been applied to. Damage comes from FFLogs' own table,
 * which is the only place rDPS exists — and which carries rows the cast list
 * cannot: a DoT ticking in a phase it was not pressed in, and a song, whose
 * whole contribution is the rDPS it hands the rest of the raid.
 *
 * Where a table row has no cast behind it, FFLogs' own `uses` stands in. Those
 * are the buff rows, keyed by status id rather than action id, so no cast will
 * ever match them.
 */
export function summarise(
  left: TimelineAction[],
  right: TimelineAction[],
  leftTable: DamageTable | null,
  rightTable: DamageTable | null,
): Summary {
  const rows = new Map<number, SummaryRow>()

  const rowFor = (
    abilityId: number,
    name: string,
    icon: string,
    actionType: ActionType,
  ): SummaryRow => {
    let row = rows.get(abilityId)
    if (!row) {
      row = {
        abilityId,
        name,
        icon,
        actionType,
        left: { ...EMPTY },
        right: { ...EMPTY },
        castDelta: 0,
        rdpsDelta: 0,
      }
      rows.set(abilityId, row)
    }
    return row
  }

  const tallyCasts = (actions: TimelineAction[], side: 'left' | 'right') => {
    for (const action of actions) {
      const row = rowFor(
        action.abilityId,
        action.abilityName,
        action.abilityIcon,
        action.actionType,
      )
      row[side].casts += 1
    }
  }

  const tallyDamage = (table: DamageTable | null, side: 'left' | 'right') => {
    if (!table) return
    for (const ability of table.abilities) {
      const row = rowFor(
        ability.abilityId,
        ability.name,
        ability.icon,
        // A row FFLogs knows and the cast list does not is a tick or a buff,
        // neither of which occupies the GCD.
        'ogcd',
      )
      // The cast list is the authority wherever it has the ability at all: it
      // is the same set of presses the detailed views align, already narrowed
      // to the filtered phase.
      if (row[side].casts === 0) row[side].casts = ability.uses
      row[side].damage = ability.damage
      row[side].rdps = ability.rdps / table.activeSeconds
      if (!row.icon) row.icon = ability.icon
    }
  }

  tallyCasts(left, 'left')
  tallyCasts(right, 'right')
  tallyDamage(leftTable, 'left')
  tallyDamage(rightTable, 'right')

  const ordered = [...rows.values()]
  for (const row of ordered) {
    row.castDelta = row.left.casts - row.right.casts
    row.rdpsDelta = row.left.rdps - row.right.rdps
  }

  // rDPS first, casts as the tiebreak: the table is read top-down looking for
  // where the pulls diverged on something that mattered, and a utility press is
  // not that.
  ordered.sort((a, b) => {
    const byRdps =
      Math.max(b.left.rdps, b.right.rdps) - Math.max(a.left.rdps, a.right.rdps)
    if (byRdps !== 0) return byRdps
    const byCasts =
      Math.max(b.left.casts, b.right.casts) -
      Math.max(a.left.casts, a.right.casts)
    if (byCasts !== 0) return byCasts
    return a.name.localeCompare(b.name)
  })

  const sideTotals = (
    actions: TimelineAction[],
    table: DamageTable | null,
  ): SummarySide => ({
    casts: actions.length,
    damage: (table?.abilities ?? []).reduce(
      (total, ability) => total + ability.damage,
      0,
    ),
    rdps: table
      ? table.abilities.reduce((total, ability) => total + ability.rdps, 0) /
        table.activeSeconds
      : 0,
  })

  const totals: SummaryTotals = {
    left: sideTotals(left, leftTable),
    right: sideTotals(right, rightTable),
    leftGcd: left.filter((action) => action.actionType === 'gcd').length,
    rightGcd: right.filter((action) => action.actionType === 'gcd').length,
    leftOgcd: left.filter((action) => action.actionType === 'ogcd').length,
    rightOgcd: right.filter((action) => action.actionType === 'ogcd').length,
  }

  const peakRdps = ordered.reduce(
    (highest, row) => Math.max(highest, row.left.rdps, row.right.rdps),
    0,
  )
  const peakCasts = ordered.reduce(
    (highest, row) => Math.max(highest, row.left.casts, row.right.casts),
    0,
  )

  return {
    rows: ordered,
    totals,
    peak: peakRdps > 0 ? peakRdps : peakCasts,
    scale: peakRdps > 0 ? 'rdps' : 'casts',
  }
}
