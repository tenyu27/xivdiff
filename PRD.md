# Product Requirements Document

# FFXIV Log Compare

**Working Name:** xivdiff  
**Platform:** Web  
**Version:** V1  
**Primary Data Source:** FFLogs API (combat events)  
**Game Data Source:** XIVAPI v2 — `https://v2.xivapi.com/` (ability icons, job icons, action metadata)  
**Product Type:** FFXIV rotation comparison / visual action diff tool

---

# 1. Product Overview

FFXIV Log Compare is a web tool for visually comparing the actions performed by two players across two FFLogs pulls.

Users paste two FFLogs URLs, select the desired pull and player/job for each side, and receive a synchronized two-track timeline showing every GCD and oGCD performed by both players.

The primary question the product answers is:

> What exactly did I do differently from this other pull?

The product is not intended to replace FFLogs or xivanalysis.

FFLogs provides detailed combat data.

xivanalysis analyzes a player's rotation and provides recommendations.

FFXIV Log Compare instead focuses on one specific task:

> Visually diff two rotations.

The experience should make differences in action choice, action order, missing actions, additional actions, and timing immediately visible.

---

# 2. Product Principles

The product should be:

- Extremely focused.
- Fast to use.
- Visual rather than text-heavy.
- Useful without requiring an account.
- Objective rather than opinionated.
- Familiar to experienced FFXIV players.
- Designed primarily for desktop.

Every major feature should support the question:

> Where did these two rotations start behaving differently?

The ideal workflow is:

Paste logs → Select pulls → Select players → Compare → Jump through differences.

---

# 3. Primary User Flow

## Step 1 — Enter Logs

The landing page contains two FFLogs inputs displayed side-by-side.

Example:

    YOUR LOG                         REFERENCE LOG

    [ Paste FFLogs URL ]             [ Paste FFLogs URL ]

                     [ Analyze ]

The Analyze button remains disabled until both inputs contain valid-looking FFLogs URLs.

The user may provide:

- A report URL without a specific fight.
- A report URL containing a specific fight/pull.

The application should normalize supported FFLogs URL formats internally.

Examples include URLs conceptually equivalent to:

    /reports/ABC123
    /reports/ABC123?fight=28
    /reports/ABC123#fight=28

If a valid fight is already specified, that fight should automatically be selected.

If no fight is specified, the user proceeds to pull selection.

Each side operates independently.

---

# 4. Report and Pull Selection

When the supplied URL represents an entire FFLogs report rather than a specific pull, fetch the fights contained in that report.

Display a pull selector for that side.

Example:

    YOUR LOG

    AAC Cruiserweight M4 Savage

    ✓ Pull #18 — 8:32 — Kill
      Pull #17 — 4:13 — Wipe
      Pull #16 — 7:58 — Wipe
      Pull #15 — 2:41 — Wipe

Useful metadata may include:

- Encounter name.
- Fight number.
- Duration.
- Kill/wipe status.
- Boss percentage for wipes, if easily available.
- Start timestamp if useful.

Default selection behavior:

1. Prefer a kill when one exists.
2. Otherwise select the latest pull.

The user must be able to override the selection.

Each side can use a completely different report and fight.

The application must also support comparing two fights from the same FFLogs report.

Example:

    Report A / Fight 18

            vs

    Report A / Fight 12

If a URL already specifies a valid fight, skip the initial pull-selection requirement and automatically select that fight.

The user should still be able to change the selected pull later.

---

# 5. Player and Job Selection

After selecting a fight, retrieve its participants.

Players should be grouped by role.

Example:

    Tank

    PLD  Player One
    DRK  Player Two

    Healer

    WHM  Player Three
    SCH  Player Four

    Melee DPS

    DRG  Player Five
    NIN  Player Six

    Physical Ranged DPS

    BRD  Player Seven

    Magical Ranged DPS

    PCT  Player Eight

Each player entry should display:

- Job icon.
- Character name.
- Job abbreviation or job name.

The grouping can follow the general pattern used by xivanalysis:

- Tank
- Healer
- Melee DPS
- Physical Ranged DPS
- Magical Ranged DPS

Each side has its own player selection.

---

# 6. Same-Job Prioritization

The normal use case is comparing two players playing the same job.

Once a player is selected on one side, matching jobs should be prioritized on the opposite side.

Example:

If the left side selects:

    Snow Artorius — BRD

The right player selector should prioritize:

    Bard

    Player Two — BRD

    Other Jobs

    Player Three — MCH
    Player Four — DRG
    ...

Do not prevent users from selecting different jobs.

If different jobs are selected, display a warning such as:

> Comparing BRD with MCH. Direct action matching may not be meaningful.

---

# 7. Comparison Screen

The primary product experience is one synchronized vertical timeline containing two tracks.

Conceptually:

    YOUR PULL                  TIME                  REFERENCE

    Player A — BRD                                  Player B — BRD
    Fight #28                                        Fight #14
    8:32                                             8:29

                               0:00

        [GCD] ───────────────────────────────── [GCD]

           [oGCD] ─────────────────────────── [oGCD]
           [oGCD] ─────────────────────────── [oGCD]

        [GCD] ───────────────────────────────── [GCD]

                               0:05

        [GCD] ───────────────────────────────── [GCD]

The UI should be thought of as:

> One timeline with two synchronized tracks.

It should not feel like two completely independent log viewers placed next to each other.

The center provides a shared temporal reference and space for comparison information.

---

# 8. Timeline Positioning

Elapsed **phase** time is the fundamental timeline coordinate.

Conceptually:

    position = action.timestamp - phase.startTime

The start of each phase represents:

    0:00

A phase boundary is a hard resynchronisation point — the boss goes
untargetable, both pulls stop and restart — so how long one side spent in the
previous phase says nothing about the next. Anchoring to fight start instead
would report a pull that reached phase 2 thirty seconds early as thirty seconds
ahead on every remaining action, which is noise rather than a difference.

An encounter FFLogs does not phase has exactly one phase, which starts at the
pull; there, this reduces to elapsed encounter time.

Both tracks use the same vertical time scale.

For example:

    Left action:  63.42 seconds
    Right action: 63.81 seconds

These actions should appear nearly horizontally aligned.

If one player's rotation gradually drifts relative to another, the UI should visually expose that drift.

Timeline positioning and action matching are separate concepts.

The timeline determines where an action occurred.

The comparison engine determines which actions correspond to each other.

---

# 9. GCD Presentation

GCDs are the primary visual anchors of the timeline.

They should receive significantly more visual prominence than oGCDs.

Initial design target:

- Ability icon approximately 40–44px.
- Strong visual weight.
- Positioned directly on the player's primary track.
- Optional subtle timestamp nearby.

Example:

    [ Burst Shot icon ] ───────────── [ Burst Shot icon ]

Action names should not remain permanently visible beside every icon.

The ability icon itself should be the primary representation.

Experienced FFXIV players recognize abilities visually, and this greatly reduces timeline clutter.

---

# 10. oGCD Presentation

oGCDs must be visually distinguishable from GCDs.

Initial design target:

- Ability icon approximately 26–30px.
- Less visual prominence than GCDs.
- Positioned between GCD anchors.
- Slightly inset from the primary GCD track if useful.

Conceptually:

           [Bloodletter]
           [Empyreal Arrow]

    [GCD]                  [GCD]

This should visually communicate the natural FFXIV rotation rhythm:

    GCD
     ↓
    weave
     ↓
    weave
     ↓
    GCD

without requiring permanent text labels.

---

# 11. Ability Icons

Every action displayed on the timeline should use its actual FFXIV ability icon.

Maintain an independent ability metadata layer containing information such as:

    {
      id: 16495,
      name: "Burst Shot",
      icon: "...",
      type: "gcd",
      job: "BRD"
    }

At minimum, ability metadata must provide:

- Ability ID.
- Ability name.
- Ability icon.
- GCD/oGCD classification.
- Associated job when applicable.

Do not depend on xivanalysis as a runtime dependency for this metadata.

xivanalysis may be studied as a reference implementation when useful.

## Data source: XIVAPI v2

Use XIVAPI v2 (`https://v2.xivapi.com/`) as the source for game data:

- Action names and icons — `/api/sheet/Action`, `/api/sheet/Action/{id}`.
- Job icons and metadata — `/api/sheet/ClassJob`.
- Icon assets — served under `/api/asset/...` (XIVAPI resolves the game icon
  path for a given sheet row; request the resized/`format=png` variant).

Notes:

- No API key required for read access; still cache aggressively.
- Ability icons are largely static per patch — snapshot the needed
  action/job rows into a local metadata layer (build-time JSON or a small
  cache) rather than hitting XIVAPI per timeline render.
- FFLogs event `abilityGameID` maps to the XIVAPI `Action` row ID.
- GCD vs oGCD classification is not reliably given by XIVAPI; derive it
  from action recast/cooldown data plus a curated per-job override list.

---

# 12. Ability Hover Tooltips

Hovering over any ability icon should display its details.

Minimum tooltip:

    Battle Voice

    02:01.384
    oGCD

For matched actions, the tooltip may additionally display comparison information:

    Battle Voice

    Your timing        02:03.742
    Reference timing   02:01.384

    Difference         +2.358s

The user should be able to identify every icon without requiring action names to permanently occupy timeline space.

---

# 13. Action Matching

The comparison engine must intelligently determine which actions correspond between the two timelines.

Do not simply compare:

    leftActions[0] vs rightActions[0]
    leftActions[1] vs rightActions[1]
    leftActions[2] vs rightActions[2]

A single missing or additional action would cause every subsequent action to appear mismatched.

Example:

    LEFT                        RIGHT

    Burst Shot                  Burst Shot
    Bloodletter                 Bloodletter
                                Empyreal Arrow
    Burst Shot                  Burst Shot
    Battle Voice                Battle Voice

The engine should correctly identify Empyreal Arrow as an additional action while continuing to match the subsequent actions.

Matching should primarily consider:

- Ability ID.
- Relative sequence/order.
- Timestamp proximity.

Potential implementation approaches include:

- Longest Common Subsequence.
- Myers diff.
- Dynamic-programming sequence alignment.

V1 does not require a sophisticated FFXIV rotation analysis engine.

---

# 14. Comparison Result Types

A normalized comparison result should support at least:

    match
    timing-difference
    left-only
    right-only
    mismatch

Conceptual model:

    type MatchedAction = {
      left?: TimelineAction
      right?: TimelineAction

      type:
        | "match"
        | "timing-difference"
        | "left-only"
        | "right-only"
        | "mismatch"

      deltaMs?: number
    }

---

# 15. Difference Visualization

Matched actions should visually connect across the two tracks.

Example:

    [icon] ─────────────────── [icon]

A small timing difference may display:

    [icon] ───── +0.3s ───── [icon]

A significant timing difference may display more prominently:

    [icon] ───── +2.8s ───── [icon]

Missing action:

                              [icon]
                     ← missing

Additional action:

    [icon]
                     extra →

Different action sequences should create a clearly visible break in the comparison.

Avoid excessive use of aggressive error colors.

A rotation with many differences should remain readable rather than turning the entire interface red.

---

# 16. Timing Differences

For matched actions:

    delta = left.timestamp - right.timestamp

Example:

    Battle Voice

    Left:       123.421s
    Right:      121.037s

    Difference: +2.384s

The comparison should expose accumulated drift naturally.

For example, if one player's rotation slowly becomes two seconds behind the reference rotation, the timeline should make that visible.

---

# 17. Difference Navigation

Navigating between differences is a core V1 feature.

Provide:

    ↑ Previous Difference
    ↓ Next Difference

Selecting one scrolls the timeline directly to the previous or next meaningful difference.

A meaningful difference can include:

- Missing action.
- Additional action.
- Different action.
- Timing delta exceeding a threshold.

An initial timing threshold can be approximately:

    > 1 second

This can become configurable later.

The purpose is to allow users to quickly ignore identical portions of a rotation.

Instead of manually examining hundreds of actions, the workflow becomes:

    Next Difference
         ↓
    0:42 — action mismatch
         ↓
    Next Difference
         ↓
    2:01 — Battle Voice +2.4s
         ↓
    Next Difference
         ↓
    4:03 — missing action

---

# 18. Comparison Header

The comparison page should contain a persistent or sticky header summarizing the active comparison.

Example:

    Player A — BRD                       Player B — BRD
    Fight #28                            Fight #14

                   17 Differences

              ↑ Previous   Next ↓

The user should be able to:

- Change the left pull.
- Change the right pull.
- Change the left player.
- Change the right player.
- Jump to previous difference.
- Jump to next difference.
- Reset the comparison.

Changing a pull or player should not require returning to the landing page.

---

# 19. Normalized Timeline Data

FFLogs events should be converted into a simple internal representation before reaching the UI.

Example:

    type TimelineAction = {
      timestamp: number
      relativeTimestamp: number

      abilityId: number
      abilityName: string
      abilityIcon: string

      actorId: number
      job: Job

      actionType: "gcd" | "ogcd"

      targetId?: number
    }

The frontend comparison system should operate primarily on this normalized format rather than raw FFLogs events.

This keeps FFLogs-specific implementation details isolated from the visualization layer.

---

# 20. FFLogs Integration

Use the official FFLogs API.

Basic architecture:

    FFLogs URL
        ↓
    Parse report ID + optional fight ID
        ↓
    Backend
        ↓
    FFLogs GraphQL API
        ↓
    Report / fight metadata
        ↓
    Participants
        ↓
    Events for selected player
        ↓
    Normalize events
        ↓
    TimelineAction[]
        ↓
    Comparison engine
        ↓
    Two-track timeline

FFLogs credentials must remain server-side.

Do not expose API credentials in frontend code.

---

# 21. Public Reports Only

V1 should support public/accessibly shared FFLogs reports only.

Do not implement:

- FFLogs user login.
- Private report authorization.
- User FFLogs account connections.

Private reports can be considered after the core comparison experience is proven useful.

---

# 22. URL Handling

The URL parser should extract:

- Report ID.
- Fight ID when present.

If both URLs contain explicit fights:

    Paste
      ↓
    Fetch fights
      ↓
    Validate selected fights
      ↓
    Player selection

If one URL contains a fight and one does not:

    Left → use specified fight

    Right → request pull selection

If neither contains a fight:

    Left → pull selection

    Right → pull selection

The two sides should not block each other unnecessarily while loading.

---

# 23. Loading and Error States

Each side should load independently.

Potential states include:

- Empty.
- Validating URL.
- Loading report.
- Awaiting pull selection.
- Loading fight.
- Awaiting player selection.
- Loading actions.
- Ready.
- Error.

Errors should be specific.

Examples:

> Invalid FFLogs URL.

> Report could not be found.

> Fight #28 does not exist in this report.

> This report cannot be accessed.

> No supported player actions were found.

An error on one side should not erase the successfully loaded state of the other side.

---

# 24. Encounter Alignment

For V1:

    Fight start = 0:00

Do not attempt sophisticated automatic phase synchronization.

If one player begins their opener two seconds later than another player, that difference should remain visible.

Potential future alignment modes:

    Align by encounter start
    Align by first GCD
    Align by selected ability
    Align by encounter phase

These are explicitly outside V1.

---

# 25. Pages

Keep the application structure extremely small.

## `/`

Landing page.

Contains:

- Product explanation.
- Left FFLogs URL input.
- Right FFLogs URL input.
- Analyze button.

No dashboard is required.

---

## `/compare`

Contains:

- Report information.
- Pull selectors.
- Player selectors.
- Comparison header.
- Two-track timeline.
- Difference navigation.

Selection and comparison can exist on the same page.

---

# 26. Shareable Comparisons

If inexpensive to implement, comparison state should be representable through the URL.

The URL should contain enough information to reconstruct:

- Left report.
- Left fight.
- Left player.
- Right report.
- Right fight.
- Right player.

A user should be able to send another player a comparison link and have them open the same comparison.

Avoid requiring a database merely to support sharing if the necessary state can safely be represented in URL parameters.

This feature is desirable for community sharing through Discord and similar platforms, but should not delay the core comparison experience.

---

# 27. Desktop First

V1 is desktop-first.

The two-track visualization benefits substantially from horizontal space.

The application should remain functional at smaller widths where practical, but a sophisticated mobile comparison experience is not required for V1.

Do not compromise the desktop timeline merely to accommodate mobile.

---

# 28. V1 Scope

V1 includes:

- Two FFLogs URL inputs.
- Analyze button.
- FFLogs URL parsing.
- Report loading.
- Explicit fight URL support.
- Report-level URL support.
- Pull selection.
- Kill/wipe identification where available.
- Player selection.
- Role grouping.
- Job icons.
- Same-job prioritization.
- Public FFLogs support.
- Player action event fetching.
- Normalized timeline data.
- FFXIV ability metadata.
- Ability icons.
- GCD/oGCD classification.
- Visually distinct GCD and oGCD presentation.
- Synchronized vertical two-track timeline.
- Ability hover tooltips.
- Sequence-aware action matching.
- Timing deltas.
- Missing actions.
- Additional actions.
- Action mismatches.
- Previous difference.
- Next difference.
- Desktop-first responsive interface.
- Shareable comparison state if inexpensive.

---

# 29. Explicitly Out of Scope for V1

Do not implement:

- DPS comparison.
- Damage-number analysis.
- Parse percentile comparison.
- xivanalysis-style recommendations.
- Rotation scoring.
- AI analysis.
- AI coaching.
- Buff timelines.
- Debuff timelines.
- Resource gauges.
- Raid-buff analysis.
- Potency calculations.
- Gear comparison.
- Private FFLogs authentication.
- User accounts.
- Saved comparisons.
- Comparison history.
- Social features.
- Encounter-specific recommendations.
- Automatic phase synchronization.
- Sophisticated mobile timeline.
- Full FFLogs replacement functionality.

The product should remain an action-diff viewer.

---

# 30. Technical Priorities

Implementation should proceed in roughly this order.

## Phase 1 — FFLogs Ingestion

Implement:

1. FFLogs URL parser.
2. FFLogs API authentication.
3. Report retrieval.
4. Fight retrieval.
5. Participant retrieval.
6. Player event retrieval.

Goal:

Given:

    reportId
    fightId
    playerId

return a reliable normalized action list.

---

## Phase 2 — Ability Metadata

Implement:

1. Ability ID lookup (FFLogs `abilityGameID` → XIVAPI `Action` row).
2. Ability names (XIVAPI v2 `Action` sheet).
3. Ability icons (XIVAPI v2 asset endpoint; snapshot to local metadata layer).
4. GCD/oGCD classification (derive from recast data + per-job overrides).
5. Job association where useful (XIVAPI v2 `ClassJob` sheet, incl. job icons).

Goal:

Transform raw player actions into UI-ready TimelineAction objects.

---

## Phase 3 — Timeline Prototype

Before implementing sophisticated comparison logic, render two real rotations using the normalized data.

Implement:

1. Shared vertical time scale.
2. Left track.
3. Right track.
4. GCD icons.
5. Smaller oGCD icons.
6. Tooltips.
7. Scrolling.

Goal:

Verify that real FFLogs data produces a useful visual timeline.

---

## Phase 4 — Comparison Engine

Implement:

1. Sequence alignment.
2. Matched actions.
3. Missing actions.
4. Additional actions.
5. Mismatched actions.
6. Timing deltas.

Goal:

Correctly maintain alignment even when one rotation contains additional or missing actions.

---

## Phase 5 — Difference UX

Implement:

1. Difference indicators.
2. Timing-difference threshold.
3. Previous Difference.
4. Next Difference.
5. Smooth scrolling/highlighting of selected differences.

Goal:

Allow users to inspect a fight primarily by jumping between meaningful differences.

---

## Phase 6 — Polish

Implement:

1. Pull-selection UX.
2. Player-selection UX.
3. Same-job prioritization.
4. Loading states.
5. Error handling.
6. Sticky comparison controls.
7. URL-based sharing if appropriate.
8. General visual polish.

---

# 31. V1 Success Criteria

V1 is successful if a user can:

1. Paste two FFLogs URLs.
2. Select the desired pull on each side when necessary.
3. Select a player/job on each side.
4. Load both rotations.
5. Recognize abilities through their icons.
6. Immediately distinguish GCDs from oGCDs.
7. See when equivalent actions occurred.
8. Identify missing or additional actions.
9. Identify meaningful timing differences.
10. Jump quickly between differences.

Most importantly:

> A player should be able to understand where their rotation diverged from another player's rotation substantially faster than by manually comparing two FFLogs timelines.

---

# 32. Core Product Definition

FFXIV Log Compare is not:

> Analyze my rotation.

It is:

> Show me exactly how these two rotations differ.

That distinction should remain the product's primary scope and design principle throughout V1.