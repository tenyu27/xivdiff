# Design System: xivdiff — FFXIV Rotation Diff Viewer

This document is the single source of truth for generating any xivdiff screen in
Google Stitch. Every screen must be described using the vocabulary, values, and
prohibitions below. Where a rule and a generated screen disagree, the rule wins.

---

## 1. Visual Theme & Atmosphere

xivdiff is an instrument, not a landing page. The atmosphere is a **precision
diff tool for combat logs** — closer to a version-control diff view or an audio
editor's waveform lane than to a SaaS marketing dashboard. Quiet, structural,
and dense with real data, it earns trust by looking like it was built by someone
who reads logs for a living.

The interface is **cool-neutral graphite** with a single restrained accent used
only where the eye must go. Ability icons — the actual, colorful FFXIV game art —
are the only saturated elements on screen. Everything the product itself draws is
neutral, so the game art stays the loudest thing in the room. This is the
governing principle of the entire system: **the chrome recedes, the icons speak.**

Calibration:

- **Density: 8 — Cockpit Dense.** The comparison screen may show several hundred
  actions. Tight vertical rhythm, compact controls, no decorative breathing room
  inside the timeline. The landing page relaxes to roughly 5.
- **Variance: 4 — Structurally Symmetric.** Two tracks compared side by side must
  be mirror-symmetric or the comparison is a lie. Asymmetry is permitted *only*
  in the landing page's supporting content, never in the timeline or the
  comparison header.
- **Motion: 3 — Restrained.** Scroll position is meaning. Motion is limited to
  scroll-to-difference easing, hover state changes, and skeletal loading. There
  are no perpetual loops, no ambient float, no shimmer on live data. A pulsing
  element in a timeline would read as a data event and it is not one.

Two themes ship in V1 — **Graphite Dark** (default) and **Paper Light** — as full
first-class palettes, not an inverted filter. Both are specified below.

---

## 2. Color Palette & Roles

Every color is a semantic token. Screens reference the role name, never a raw
hex, so the same screen description renders correctly in both themes.

### Graphite Dark (default theme)

- **Deep Graphite** (`#131417`) — App canvas. The page background. Never
  `#000000`.
- **Raised Graphite** (`#191B1F`) — Panel and surface fill: selector cards, the
  sticky header, tooltip bodies.
- **Sunken Slate** (`#0F1013`) — Recessed wells: the timeline scroll body,
  input field interiors. Reads as *behind* the canvas.
- **Bone White** (`#E8E9EC`) — Primary text, active ability names, headings.
- **Muted Steel** (`#8A8F98`) — Secondary text: timestamps, job abbreviations,
  metadata, pull durations.
- **Dim Steel** (`#5A606B`) — Tertiary text and disabled states: placeholder
  copy, inactive tab labels, the disabled Analyze button's text.
- **Hairline** (`rgba(232,233,236,0.08)`) — 1px structural dividers, panel
  borders, track guide lines.
- **Hairline Strong** (`rgba(232,233,236,0.16)`) — Input borders, hovered card
  borders, the timeline's center spine.

### Paper Light

- **Bone Canvas** (`#F5F5F3`) — App canvas.
- **Pure Surface** (`#FFFFFF`) — Panel and surface fill.
- **Sunken Paper** (`#EDEDEA`) — Recessed wells: timeline body, input interiors.
- **Graphite Ink** (`#1B1D21`) — Primary text.
- **Slate Gray** (`#63686F`) — Secondary text.
- **Fog Gray** (`#9BA0A7`) — Tertiary and disabled text.
- **Hairline** (`rgba(27,29,33,0.10)`) — Structural dividers.
- **Hairline Strong** (`rgba(27,29,33,0.20)`) — Input borders, center spine.

### Shared semantic colors (identical role, tuned per theme)

- **Signal Amber** — the single accent. Dark: `#D9A441`. Light: `#B07C15`.
  Used for: the Analyze button fill, focus rings, the currently-selected
  difference, and the active pull/player selection. Saturation stays under 80%.
  It is warm against a cool-neutral field, so a single amber element is found
  instantly without any glow. **Never more than one amber element competes for
  attention in a viewport.**
- **Drift Teal** — Dark: `#5E9C9B`. Light: `#2F6D6C`. Timing-difference
  connectors and delta labels. Reads as *informational*, not wrong.
- **Absence Rose** — Dark: `#B4736F`. Light: `#9A4F4A`. Missing and additional
  actions — a desaturated clay red, deliberately muted. A rotation with fifty
  differences must remain readable, so this never approaches a pure alarm red.
- **Mismatch Ochre** — Dark: `#A08A4E`. Light: `#7A6220`. Wrong-action-at-this-
  position. Distinct from Absence Rose at a glance without adding a fifth hue.
- **Match Whisper** — Dark: `rgba(232,233,236,0.14)`. Light:
  `rgba(27,29,33,0.14)`. The connector line for identical actions. Matches are
  the majority case and must visually disappear so differences pop.

Palette rules:

- One palette for the whole product. No warm-gray panels next to cool-gray
  panels.
- Kill/wipe status uses **text and a 2px left border**, not colored pills:
  Drift Teal for a kill, Muted Steel for a wipe. Do not invent a green.
- Job and role colors from FFXIV are **not** reproduced in the chrome. Job
  identity is carried by the job icon only.
- Both themes are authored explicitly. Neither is generated by inverting the
  other.

---

## 3. Typography Rules

- **Display / UI:** `Geist` — track-tight (`-0.02em`) at heading sizes, hierarchy
  driven by weight (500/600) and color, never by size alone. Largest text on the
  comparison screen is ~20px; this is a tool, nothing shouts.
- **Body / Labels:** `Geist` at 400/500. Landing-page prose caps at 65 characters
  per line with relaxed leading (1.6). In-app labels use 1.35 leading.
- **Mono:** `Geist Mono` — **mandatory for every number in the product.**
  Density exceeds 7, so timestamps, deltas, pull durations, fight numbers, and
  boss percentages are all monospaced and tabular-figure aligned. A column of
  timestamps that jitters horizontally is a defect.
- **Delta values** (`+2.384s`) always carry an explicit sign and three decimals
  in mono. Timestamps use `M:SS.mmm`.
- **Job abbreviations** (BRD, PLD, SCH) are mono, uppercase, `0.04em` tracking.

Banned:

- `Inter` — banned outright.
- All serif faces — this is a software UI; no exceptions.
- System font stacks as the primary face.
- Text below 12px anywhere, including timeline timestamps.
- All-caps for anything longer than a job abbreviation or a short section label.

---

## 4. Component Stylings

**Buttons**
Flat fill, 6px radius, no outer glow, no gradient. Primary (Analyze) is Signal
Amber fill with Deep Graphite text. Secondary is transparent with a Hairline
Strong border. Active state translates down 1px for tactile feedback. Disabled
buttons keep their shape and drop to Dim Steel text on a Hairline border — never
a faded-out ghost that looks broken. Height 36px; 44px only for the landing
page's primary Analyze action.

**Inputs (FFLogs URL fields)**
Sunken well fill, Hairline Strong border, 6px radius, 40px tall. Label sits
above in Muted Steel at 12px. Helper text below in the same size. Focus draws a
2px Signal Amber ring, no border-color change and no glow. Validation state is a
line of text below the field, never a colored field fill. No floating labels.

**Cards**
Used only for pull rows and player rows, where each row is a selectable object
and elevation genuinely encodes "this is a discrete choice." Radius 8px, 1px
Hairline border, **no drop shadow in dark theme** — separation comes from the
Raised Graphite fill against Deep Graphite. In light theme, a single diffused
shadow tinted to the canvas hue (`0 1px 2px rgba(27,29,33,0.06)`). Selected
state: Signal Amber 2px left border plus a Raised surface — never a full amber
fill.

Everywhere else — the comparison header, the timeline, metadata blocks — cards
are **banned**. Density 8 means separation comes from Hairline top-borders and
negative space, not stacked boxes.

**Pull selector**
A vertical list of rows, not a grid of cards. Each row: fight number (mono),
encounter name, duration (mono), kill/wipe marker, boss percentage for wipes
(mono). Default selection is applied on load and visibly marked; the user can
change it at any time from the same control.

**Player selector**
Grouped by role — Tank, Healer, Melee DPS, Physical Ranged DPS, Magical Ranged
DPS — with role names as 11px Muted Steel section labels above a Hairline rule.
Each row shows the job icon (24px, 4px radius), character name, and mono job
abbreviation. When the opposite side has a selected job, a **Same Job** group
is hoisted to the top with matching entries, and the remaining roles follow under
an **Other Jobs** label. Cross-job selection is always permitted; it renders an
inline Muted Steel notice above the timeline, not a modal and not an error color.

**Timeline — GCD**
Ability icon at 42px, 6px radius, 1px Hairline border. Sits directly on the
track's vertical axis. Full opacity. This is the primary anchor of the entire
screen.

**Timeline — oGCD**
Ability icon at 28px, 4px radius, inset 20px from the GCD axis toward the center
spine, at 90% opacity. The size and inset together communicate the weave rhythm
without a single label. GCD and oGCD are distinguishable by silhouette alone at
a glance, with no legend required.

**Timeline — connectors**
A 1px horizontal rule between matched actions. Match Whisper for identical
actions. Drift Teal for timing differences, with the delta rendered inline in
mono at 11px, centered on the spine. Missing/additional actions draw a short
Absence Rose stub from the present icon toward the empty side, terminating in a
small caret and an 11px `missing` / `extra` label in Muted Steel. Mismatches
draw a Mismatch Ochre connector with both icons at full size.

**Timeline — time gutter**
The center column carries elapsed-time ticks every 5 seconds in mono Dim Steel,
with a 1px Hairline spine running the full height. Time is the shared axis and
must be legible without hovering.

**Tooltips**
Raised Graphite surface, 1px Hairline Strong border, 6px radius, 10px/12px
padding. Ability name in Bone White 13px; timestamp and GCD/oGCD classification
in mono Muted Steel 11px. For matched actions, add a two-column mono block —
`Your timing` / `Reference timing` — with the signed delta on its own line in
Drift Teal. Appears after ~120ms, no entrance animation beyond a 100ms opacity
fade. Never covers the icon it describes.

**Difference navigation**
Previous / Next controls live in the sticky header alongside a mono difference
count and the current position (`4 / 17`). Keyboard bindings are surfaced as
mono key hints in Dim Steel next to each control. Jumping scrolls the timeline
with a 240ms ease and marks the target with a Signal Amber 2px outline that
persists until the next jump — it does not pulse or fade.

**Loading states**
Skeletal placeholders matching exact final dimensions: 42px squares on the GCD
axis, 28px squares inset, hairline connectors between. Each side loads
independently and shows its own skeleton. No circular spinners anywhere.

**Empty states**
Composed, structural, and instructive — a faint hairline sketch of the two-track
timeline with a one-line directive naming the exact next action ("Select a
player for the reference log"). Never the words "No data."

**Error states**
Inline, specific, and local to the side that failed: the failing side's panel
shows the exact message ("Fight #28 does not exist in this report.") in Absence
Rose text on the normal surface, plus a retry or change-selection control. An
error on one side never clears the other side's loaded state. No toasts, no
modals, no full-page error screens.

---

## 5. Layout Principles

**Desktop only for V1.** The two-track comparison requires horizontal space and
degrades into uselessness when collapsed to one column, so it is not attempted.
Design against a minimum viewport of **1280px** and a target of 1440–1728px.

- **No responsive collapse, no mobile layout, no breakpoints below 1280px.**
  Below the minimum, the app shows a single centered notice stating that xivdiff
  requires a desktop-width window. That notice is the entire mobile design.
  Do not add a hamburger menu, a mobile nav, or a stacked timeline.
- **Landing page:** left-aligned asymmetric composition. Product explanation
  occupies the left column; the two URL inputs sit side by side in the right
  column with the Analyze button below them, aligned to the inputs — not centered
  in the viewport. Max-width 1200px, left-anchored within the page, not
  dead-center. Centered hero layouts are banned.
- **Comparison page:** a strict three-column grid — `1fr` left track, a fixed
  `120px` center time gutter, `1fr` right track — with the two side columns
  exactly mirror-equal. Max-width 1600px, centered. This is the one place
  symmetry is mandatory.
- **Sticky header:** full-bleed, 64px, Raised Graphite with a Hairline bottom
  border. It carries both sides' player/fight identity, the difference count,
  prev/next controls, and the pull/player change affordances. Changing a
  selection never navigates away from `/compare`.
- **CSS Grid for all structure.** No flexbox percentage math, no `calc()`
  percentage hacks.
- Full-height regions use `min-h-[100dvh]`, never `h-screen`.
- **No overlapping elements.** Every element owns its own spatial zone. Nothing
  is absolutely positioned over anything else except tooltips, which are
  transient overlays by definition and are placed to avoid covering their anchor.
- The timeline body is the only scroll container; the header stays fixed and the
  page itself does not scroll.

---

## 6. Motion & Interaction

Motion serves comprehension, never decoration.

- **Spring physics** (`stiffness: 100, damping: 20`) for the scroll-to-difference
  jump and for panel transitions. No linear easing.
- **Hover** on any ability icon: 120ms opacity/border change only. No scale
  transform — a growing icon would displace neighbors and change perceived
  timing.
- **Staggered reveal** applies once, on initial timeline mount: actions cascade
  in top-to-bottom over ~300ms total. Re-renders and selection changes do not
  re-stagger.
- **No perpetual loops.** No pulse, no float, no shimmer on rendered data. The
  only exception is the loading skeleton's shimmer, which stops the instant real
  data arrives.
- Animate exclusively via `transform` and `opacity`. Never animate `top`,
  `left`, `width`, or `height`.
- Any grain or noise texture, if used at all, lives on a fixed pseudo-element and
  never on a scrolling container.
- **Theme switching is instantaneous** — no cross-fade. A transitioning palette
  under a dense timeline reads as data changing.

---

## 7. Anti-Patterns (Banned)

- No emojis, anywhere, in any state — including empty and error states.
- No `Inter`. No serif faces of any kind.
- No pure black (`#000000`) and no pure white (`#FFFFFF`) as a *canvas* — pure
  white is permitted only as the light theme's raised surface fill.
- No neon, no outer glows, no drop shadows on the accent color.
- No gradient text, no gradient buttons, no gradient backgrounds.
- No purple/blue "AI" aesthetic. No second accent color.
- No custom mouse cursors.
- No overlapping elements or absolutely-positioned content stacking.
- No three-equal-cards feature row on the landing page.
- No circular loading spinners.
- No modal dialogs — every selection and every error is inline.
- No toast notifications.
- No aggressive full-red error styling. A rotation with many differences must
  stay readable; Absence Rose is deliberately muted for this reason.
- No proportional-width digits. Every number is mono and tabular.
- No permanent text labels beside ability icons — the icon is the
  representation, and names live in the tooltip.
- No filler UI text: "Scroll to explore", "Swipe down", scroll arrows, bouncing
  chevrons.
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen",
  "Effortless", "Powerful". Landing copy states what the tool does in plain
  language.
- No generic placeholder identities. Use plausible FFXIV character names and
  real encounter names (e.g. "AAC Cruiserweight M4 Savage"), never "John Doe",
  "Acme", or "Nexus".
- No fake round statistics (`99.99% accurate`, `50% faster`). If a number is
  shown it comes from real data.
- No broken image links. Placeholder art uses `picsum.photos` or inline SVG;
  ability and job icons come from XIVAPI.
- No centered hero. No mobile layout. No breakpoints below 1280px.
- No dark theme produced by inverting the light theme, or vice versa.
