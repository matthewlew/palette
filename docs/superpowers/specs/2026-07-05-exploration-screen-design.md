# Exploration Screen — Design Spec

## Context

This is the first sub-project of the larger "Palette" system (see full PRD below for
reference). Palette is a mobile-first web app for generating perceptual (OKLCH-based)
color systems and geometric gradients. The full PRD describes four major subsystems:
color engine, main exploration screen, edit mode, and export/handoff. These are too
large to design and build as one unit, so they're being decomposed into sequential
specs. This spec covers **only the main exploration screen** (PRD section 3.1) plus
the minimal slice of color math needed to drive it.

Deferred to later specs: full OKLCH ramp generation (100–900 lightness steps), P3
gamut mapping, Edit Mode's drag-and-drop block stack and swatch carousel, the
micro-variation gallery, and all three export methods (image copy, shareable URL,
JSON payload).

## Goals

- A full-screen, swipeable feed of algorithmically generated gradients.
- Gradients are perceptually generated in OKLCH, not naive RGB/HSL random.
- Double-tap saves a gradient to a persistent horizontal drawer.
- Tapping a gradient transitions into a (stubbed) Edit Mode shell.

## Non-goals

- Real Edit Mode functionality (block editing, swatch carousel, reordering).
- Export of any kind.
- Ramp/token generation, semantic role mapping.
- Backend/server component — this is a client-only SPA.

## Architecture

- **Stack**: Vite + React + TypeScript, mobile-first responsive layout.
- **State**: Zustand store with two slices:
  - `explorationSlice` — current gradient, generation history/seed.
  - `savedSlice` — saved drawer contents, synced to `localStorage`.
- **Routing**: none. Edit Mode is a view-state transition (`mode: 'explore' | 'edit'`
  in the store), not a URL route, since later specs will animate the same gradient
  object shrinking into place rather than navigating.

## Color engine (minimal slice)

- `lib/oklch.ts` — Björn Ottosson's OKLCH↔sRGB conversion matrices, implemented
  directly (no external color library), per the PRD's technical directive.
- `lib/palette.ts` — palette generator:
  - Ships with a small set of curated seed palettes (a BKLYN CLAY-inspired seed
    among a few modern UI/branding-oriented seeds), each defined as a handful of
    OKLCH seed colors.
  - On each swipe, jitters hue/chroma/lightness in OKLCH space around a chosen
    seed palette to produce a fresh set of colors.
  - Selects 3–6 stops from the generated set per gradient.
  - This module is intentionally narrow — it does not do full 100–900 ramp
    generation or gamut mapping. Those belong to the color-engine sub-project.

## Gradient geometry

All four types from the PRD are generated in this build:

1. Linear (`linear-gradient()`)
2. Radial (`radial-gradient()`)
3. Angular (`conic-gradient()`)
4. Square/Turrell-style (nested `conic-gradient()`s with hard 90° stops)

Stops are distributed equally by default (no weighting logic yet — weighting via
stacked duplicate stops is an Edit Mode concern).

## Interaction model

- **Feed**: full-viewport gradient container using CSS scroll-snap, one gradient per
  "page." Crossing a snap boundary triggers generation of the next gradient
  on-demand (not pre-generating an unbounded list).
- **Double-tap to save**: detected via `pointerup` events (two within ~300ms on the
  same target), not `dblclick`, for touch reliability. `touch-action: manipulation`
  is set on the feed container to suppress native double-tap zoom. On save: dedupe
  by gradient signature (type + stop colors + positions), push to `savedSlice`,
  flash a geometric heart icon via CSS animation.
- **Drawer**: fixed horizontal scroll strip pinned to the bottom of the viewport,
  showing gradient thumbnails from `savedSlice`, persisted to `localStorage`.
  Tapping a thumbnail loads that gradient into the main feed view (non-destructive —
  stays in the drawer).
- **Tap-to-edit transition**: a single tap on the current full-screen gradient
  (debounced/disambiguated from the double-tap-save gesture) triggers an animation
  shrinking it into the upper portion of the viewport and sets `mode: 'edit'`.
  Edit Mode itself is a **stub** in this spec — just the shrunk preview and an empty
  placeholder region below it, proving the transition and layout shell.

## Testing

- Unit tests for `lib/oklch.ts` conversions (round-trip OKLCH→sRGB→OKLCH within
  tolerance) and `lib/palette.ts` generation (stop count in range, valid hex/OKLCH
  output).
- Component/interaction tests for double-tap detection, scroll-snap generation
  trigger, and the edit-mode transition state change.

---

## Reference: Full Palette PRD (for context on future sub-projects)

Summary, gradient geometries, edit mode, export/handoff, and technical directives
as originally specified — kept here for continuity across the multi-spec
decomposition. See conversation history for full text; key points not covered by
this spec:

- Full OKLCH ramp (100–900) generation for the Full View.
- Edit Mode: draggable color-block stack, swatch carousel with add/remove-by-tap,
  haptic feedback on reorder, dynamic contrast/border rules (L > 0.6 → dark UI
  elements, L < 0.6 → light UI elements; 1px 10%-opacity borders; text color flips
  at the same threshold), swatch selection indicator (2px offset + 2px border,
  checkmark badge).
- Below-the-fold micro-variation gallery in Edit Mode.
- Export: offscreen-canvas image-to-clipboard, serialized shareable read-only URL,
  structured JSON token payload decoupling raw values from CSS geometry.
