import './TooSmall.css'

/**
 * The entire small-viewport design. The two-track comparison needs horizontal
 * space and degrades into uselessness in one column, so it is not attempted.
 */
export function TooSmall() {
  return (
    <div className="too-small">
      <p className="too-small-title">xivdiff needs a wider window.</p>
      <p className="too-small-body">
        The two-track comparison is laid out against a minimum width of{' '}
        <span className="mono">1280px</span>. Open this on a desktop display.
      </p>
    </div>
  )
}
