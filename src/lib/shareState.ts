import type { SideSelection } from './types.ts'

export interface CompareState {
  left: SideSelection
  right: SideSelection
}

export function emptySide(url = ''): SideSelection {
  return { url, code: null, fightId: null, actorId: null }
}

const PREFIX: Record<'left' | 'right', string> = { left: 'l', right: 'r' }

/**
 * Comparison state lives entirely in the URL, so a link pasted into Discord
 * reconstructs the same view with no database behind it.
 */
export function encodeCompareState(state: CompareState): string {
  const params = new URLSearchParams()

  for (const side of ['left', 'right'] as const) {
    const selection = state[side]
    const key = PREFIX[side]
    if (selection.code) params.set(`${key}r`, selection.code)
    if (selection.fightId != null) params.set(`${key}f`, String(selection.fightId))
    if (selection.actorId != null) params.set(`${key}p`, String(selection.actorId))
  }

  return params.toString()
}

export function decodeCompareState(search: string): CompareState {
  const params = new URLSearchParams(search)

  const read = (side: 'left' | 'right'): SideSelection => {
    const key = PREFIX[side]
    const code = params.get(`${key}r`)
    return {
      url: code ? `https://www.fflogs.com/reports/${code}` : '',
      code,
      fightId: toId(params.get(`${key}f`)),
      actorId: toId(params.get(`${key}p`)),
    }
  }

  return { left: read('left'), right: read('right') }
}

function toId(value: string | null): number | null {
  if (value == null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) ? parsed : null
}
