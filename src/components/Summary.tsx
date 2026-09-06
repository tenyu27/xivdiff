import { IconArrowRight } from '@tabler/icons-react'
import { formatRate, formatSignedRate } from '../lib/layout.ts'
import { summarise } from '../lib/summary.ts'
import type { SummaryRow } from '../lib/summary.ts'
import type { DamageTable, TimelineAction } from '../lib/types.ts'
import './Summary.css'

interface Props {
  left: TimelineAction[]
  right: TimelineAction[]
  leftDamage: DamageTable | null
  rightDamage: DamageTable | null
  /** The tables are still in flight; their columns stand as skeletons. */
  loadingDamage: boolean
  /** Leaves the totals for the press-by-press comparison. */
  onDetail: () => void
}

/**
 * Casts and rDPS, side by side.
 *
 * The question this view answers is "did we press the same buttons as often,
 * and was the raid paid the same for them" — the one worth asking before any
 * press-by-press alignment, because a missing Empyreal Arrow is a fact about
 * the pull and finding it should not require scrolling a six-hundred-row
 * timeline. Order is deliberately absent here; that is what the detailed views
 * are for.
 *
 * The columns are mirrored around the bar rather than run left to right, so the
 * bar sits on the same centre line as the spine in every other view and the two
 * pulls stay on the sides the whole product has given them.
 */
export function Summary({
  left,
  right,
  leftDamage,
  rightDamage,
  loadingDamage,
  onDetail,
}: Props) {
  const { rows, totals, peak, scale } = summarise(
    left,
    right,
    leftDamage,
    rightDamage,
  )

  if (rows.length === 0) {
    return (
      <div className="summary">
        <p className="summary-empty">
          Both rotations loaded, but no actions were found to compare.
        </p>
      </div>
    )
  }

  return (
    <div className="summary">
      <div className="summary-inner">
        <div className="summary-actions">
          <p className="summary-caption">
            {rows.length} abilities across both pulls, bars scaled to{' '}
            {scale === 'rdps' ? 'rDPS' : 'cast count'}.
          </p>
          <button type="button" className="btn btn-primary" onClick={onDetail}>
            Detailed comparison
            <IconArrowRight />
          </button>
        </div>

        <table className="summary-table">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="col-name">
                Ability
              </th>
              <th scope="colgroup" colSpan={2} className="col-group">
                Your pull
              </th>
              <th scope="col" rowSpan={2} className="col-bar">
                {scale === 'rdps' ? 'rDPS' : 'Casts'}
              </th>
              <th scope="colgroup" colSpan={2} className="col-group">
                Reference
              </th>
              <th scope="col" rowSpan={2} className="col-delta">
                Δ
              </th>
            </tr>
            <tr>
              <th scope="col" className="col-count">
                Casts
              </th>
              <th scope="col" className="col-damage">
                rDPS
              </th>
              <th scope="col" className="col-damage">
                rDPS
              </th>
              <th scope="col" className="col-count">
                Casts
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <Row
                key={row.abilityId}
                row={row}
                peak={peak}
                scale={scale}
                loadingDamage={loadingDamage}
              />
            ))}
          </tbody>

          <tfoot>
            <tr>
              <th scope="row" className="col-name">
                <span className="summary-name-cell">
                  Total
                  <span className="summary-breakdown mono">
                    {totals.leftGcd}/{totals.leftOgcd} vs {totals.rightGcd}/
                    {totals.rightOgcd} GCD/oGCD
                  </span>
                </span>
              </th>
              <td className="mono col-count">{totals.left.casts}</td>
              <td className="mono col-damage">
                <Rate value={totals.left.rdps} loading={loadingDamage} />
              </td>
              <td className="col-bar" />
              <td className="mono col-damage">
                <Rate value={totals.right.rdps} loading={loadingDamage} />
              </td>
              <td className="mono col-count">{totals.right.casts}</td>
              <Delta
                castDelta={totals.left.casts - totals.right.casts}
                rdpsDelta={totals.left.rdps - totals.right.rdps}
                leftCasts={totals.left.casts}
                rightCasts={totals.right.casts}
              />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

interface RowProps {
  row: SummaryRow
  peak: number
  scale: 'rdps' | 'casts'
  loadingDamage: boolean
}

function Row({ row, peak, scale, loadingDamage }: RowProps) {
  const verdict = verdictFor(row.castDelta, row.left.casts, row.right.casts)
  const measure = (side: 'left' | 'right') =>
    scale === 'rdps' ? row[side].rdps : row[side].casts

  return (
    <tr className={`summary-row ${verdict}`}>
      <th scope="row" className="col-name">
        {/* The flex row lives inside the cell, never on it: a cell told to be a
            flex container stops being a table cell and the fixed column widths
            go with it. */}
        <span className="summary-name-cell">
          <span className={`summary-icon summary-icon-${row.actionType}`}>
            {row.icon ? (
              <img src={row.icon} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="summary-icon-blank" />
            )}
          </span>
          <span className="summary-name">{row.name}</span>
        </span>
      </th>

      <td className="mono col-count">{row.left.casts || '—'}</td>
      <td className="mono col-damage">
        <Rate value={row.left.rdps} loading={loadingDamage} />
      </td>

      {/* Both bars take the same colour on purpose: this cell is a comparison
          of two lengths, and giving each side its own hue would turn it into a
          legend to memorise instead. */}
      <td className="col-bar">
        <span className="summary-bar" aria-hidden>
          <span className="summary-bar-half summary-bar-left">
            <span
              className="summary-bar-fill"
              style={{ width: `${share(measure('left'), peak)}%` }}
            />
          </span>
          <span className="summary-bar-half summary-bar-right">
            <span
              className="summary-bar-fill"
              style={{ width: `${share(measure('right'), peak)}%` }}
            />
          </span>
        </span>
      </td>

      <td className="mono col-damage">
        <Rate value={row.right.rdps} loading={loadingDamage} />
      </td>
      <td className="mono col-count">{row.right.casts || '—'}</td>

      <Delta
        castDelta={row.castDelta}
        rdpsDelta={row.rdpsDelta}
        leftCasts={row.left.casts}
        rightCasts={row.right.casts}
      />
    </tr>
  )
}

/** A rate, or the space one will occupy once FFLogs answers. */
function Rate({ value, loading }: { value: number; loading: boolean }) {
  if (loading && value === 0) {
    return <span className="skeleton summary-rate-skeleton" />
  }
  return <>{value > 0 ? formatRate(value) : '—'}</>
}

interface DeltaProps {
  castDelta: number
  rdpsDelta: number
  leftCasts: number
  rightCasts: number
}

/**
 * Both deltas in one column, casts above damage.
 *
 * The verdict colour comes from the cast difference alone: rDPS moves with
 * crits and with what the rest of the raid was doing, so colouring by it would
 * paint half the table as a divergence nobody pressed.
 */
function Delta({ castDelta, rdpsDelta, leftCasts, rightCasts }: DeltaProps) {
  const verdict = verdictFor(castDelta, leftCasts, rightCasts)

  return (
    <td className="col-delta">
      <span className={`mono summary-delta-casts ${verdict}`}>
        {formatCastDelta(castDelta)}
      </span>
      <span className="mono summary-delta-damage">
        {formatSignedRate(rdpsDelta)} rDPS
      </span>
    </td>
  )
}

function share(value: number, peak: number): number {
  return peak === 0 ? 0 : (value / peak) * 100
}

/**
 * Same three verdicts the timeline draws: agreement, a difference in degree,
 * and one side not pressing the button at all.
 */
function verdictFor(delta: number, left: number, right: number): string {
  if (delta === 0) return 'is-match'
  if (left === 0 || right === 0) return 'is-absent'
  return 'is-diff'
}

function formatCastDelta(delta: number): string {
  if (delta === 0) return '0'
  return delta > 0 ? `+${delta}` : String(delta)
}
