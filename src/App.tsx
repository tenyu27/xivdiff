import { useSyncExternalStore } from 'react'
import { Compare } from './components/Compare.tsx'
import { Landing } from './components/Landing.tsx'
import { TooSmall } from './components/TooSmall.tsx'
import { useRoute } from './hooks/useRoute.ts'
import { useTheme } from './hooks/useTheme.ts'
import './App.css'

/** Below this the comparison cannot be laid out honestly, so it is not shown. */
const MIN_WIDTH = 1280
const query = `(min-width: ${MIN_WIDTH}px)`

function subscribeToWidth(callback: () => void): () => void {
  const list = window.matchMedia(query)
  list.addEventListener('change', callback)
  return () => list.removeEventListener('change', callback)
}

function useWideEnough(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(query).matches,
    () => true,
  )
}

export default function App() {
  const route = useRoute()
  const [theme, toggleTheme] = useTheme()
  const wideEnough = useWideEnough()

  if (!wideEnough) return <TooSmall />

  if (route.path === '/compare') {
    return <Compare theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <>
      <nav className="top-bar">
        <span className="wordmark">xivdiff</span>
        <span className="top-bar-actions">
          <button
            type="button"
            className="btn btn-secondary top-bar-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </span>
      </nav>
      <Landing />
    </>
  )
}
