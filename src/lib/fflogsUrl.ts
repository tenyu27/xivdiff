import type { ReportRef } from './types.ts'

/** FFLogs report codes are alphanumeric, typically 16 characters. */
const CODE_PATTERN = /^[a-zA-Z0-9]{8,32}$/
const REPORT_PATH = /\/reports\/([a-zA-Z0-9]{8,32})/

/**
 * Accepts anything a user is likely to paste: a full report URL, a URL with
 * `?fight=` or `#fight=`, a localised host (`fr.fflogs.com`), or a bare report
 * code. Returns null when nothing report-shaped is found.
 *
 * `fight=last` is treated as "no explicit fight" so the caller falls back to
 * its normal default-selection rules rather than inventing a fight id.
 */
export function parseFFLogsUrl(input: string): ReportRef | null {
  const raw = input.trim()
  if (!raw) return null

  if (CODE_PATTERN.test(raw) && !raw.includes('/')) {
    return { code: raw }
  }

  const pathMatch = REPORT_PATH.exec(raw)
  if (!pathMatch) return null

  return { code: pathMatch[1], fightId: extractFightId(raw) }
}

function extractFightId(raw: string): number | undefined {
  // The fight can live in the query string or the fragment, and FFLogs uses
  // both depending on where the link was copied from.
  const match = /[?#&]fight=([^&\s]+)/.exec(raw)
  if (!match) return undefined

  const value = match[1]
  if (value === 'last') return undefined

  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function isProbablyValid(input: string): boolean {
  return parseFFLogsUrl(input) !== null
}
