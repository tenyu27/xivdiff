import './Logo.css'

interface Props {
  /** Rendered size in pixels. The mark is drawn on a 32-unit grid. */
  size?: number
}

/**
 * The product's mark: a crystal cut down its own axis, its two halves knocked
 * out of line.
 *
 * The crystal is the oldest shape the game has, and cutting one in half is what
 * this tool does to a pull. The halves carry the same two colours a row carries
 * — agreement green, divergence amber — so the mark is made of the same
 * vocabulary as the thing it stands for, and the stagger between them is the
 * finding rather than a decoration.
 *
 * Colours come from the theme tokens, so the mark follows the palette rather
 * than pinning its own; `public/favicon.svg` is the same geometry with the
 * values inlined, since a favicon has no document to inherit from.
 */
export function Logo({ size = 28 }: Props) {
  return (
    <svg
      className="logo"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
    >
      <g fillOpacity=".16" strokeWidth="2" strokeLinejoin="round">
        <path
          className="logo-match"
          d="M16 5 8 11v10l8 6z"
          transform="translate(0 -1.5)"
        />
        <path
          className="logo-diff"
          d="M16 5l8 6v10l-8 6z"
          transform="translate(0 1.5)"
        />
      </g>
    </svg>
  )
}
