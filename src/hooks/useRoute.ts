import { useSyncExternalStore } from 'react'

export interface Route {
  path: string
  search: string
}

/**
 * Hash routing, deliberately. GitHub Pages serves no rewrite rules, so a real
 * path route would 404 on refresh or on an incoming shared link.
 *
 * The location is the single source of truth for comparison state, so this
 * store notifies on programmatic replacements too — `history.replaceState`
 * fires no `hashchange` of its own.
 */
function readHash(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = hash.split('?')
  return { path: path || '/', search }
}

let snapshot = readHash()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function sync(): void {
  const next = readHash()
  // useSyncExternalStore compares snapshots by identity, so only replace the
  // object when something actually changed.
  if (next.path !== snapshot.path || next.search !== snapshot.search) {
    snapshot = next
    emit()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', sync)
  window.addEventListener('popstate', sync)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

export function navigate(path: string, search = ''): void {
  const target = search ? `#${path}?${search}` : `#${path}`
  if (window.location.hash === target) return
  window.location.hash = target
  sync()
}

/**
 * Updates the route without pushing a history entry — used for selection
 * changes, which would otherwise bury the back button under every click.
 */
export function replaceSearch(path: string, search: string): void {
  const target = search ? `#${path}?${search}` : `#${path}`
  if (window.location.hash === target) return

  const url = `${window.location.pathname}${window.location.search}${target}`
  window.history.replaceState(null, '', url)
  sync()
}
