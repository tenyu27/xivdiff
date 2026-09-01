import { IconMoon, IconSun } from '@tabler/icons-react'
import './ThemeToggle.css'

interface Props {
  theme: 'dark' | 'light'
  onToggle: () => void
}

/**
 * Icon only. A word ("Light") has to be read to be understood and states the
 * destination rather than the current mode; the glyph is recognised without
 * reading, which is what a control this peripheral deserves.
 */
export function ThemeToggle({ theme, onToggle }: Props) {
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`

  return (
    <button
      type="button"
      className="btn btn-secondary theme-toggle"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  )
}
