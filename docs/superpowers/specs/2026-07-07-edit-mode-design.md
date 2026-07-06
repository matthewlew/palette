# Edit Mode — Design Spec

## Context

This is the second sub-project of the "Palette" system (see the exploration-screen spec and
the full PRD for background). The exploration screen (scrub-driven rolodex feed, double-tap
save, drawer, tap-to-edit transition) is complete and ships to a stubbed `EditModeStub`. This
spec replaces that stub with the real Edit Mode: draggable, reorderable color-stack blocks,
a swatch carousel for adding colors, and geometry controls for switching/transforming the
gradient's shape.

Reference material: `docs/superpowers/specs/reference-edit-mode-mockup-notes.md` (a shared
mockup screenshot, captured earlier) informed the block-stack and geometry-tab visual design
questions resolved during brainstorming.

Deferred to later work: swap-to-adjacent-hue gesture (swiping a block to cycle to a nearby
hue), the below-the-fold micro-variation gallery, and all export methods (image copy,
shareable URL, JSON payload).

## Goals

- Replace `EditModeStub` with a real editing surface for the current gradient.
- Support 6 gradient geometry types via tabs: Linear, Radial, Angular, Square, Mirror, Repeat.
- Draggable, reorderable color blocks with haptic feedback, add-via-drag from a swatch
  carousel, and remove via a per-block button.
- Live 2-way binding: every edit updates the gradient preview immediately, no separate
  save/cancel step.

## Non-goals

- Swap-to-adjacent-hue swipe gesture (explicitly deferred).
- Micro-variation gallery below the fold.
- Export (image copy, shareable URL, JSON token payload).
- Full ramp/token generation — this operates only on the gradient's existing stop colors.

## Data model changes

`Gradient` (currently `{ id, type, stops }` in `src/store/types.ts`) gains two fields:

- `seedName: string` — which `SEED_PALETTES` entry generated this gradient's colors. Set by
  `Feed`'s `makeGradient()` whenever a new gradient is generated (both the initial mount
  gradient and forward-scrub-generated ones), so Edit Mode can look up the correct swatch set.
  Existing `Gradient` objects saved to the drawer before this change won't have a `seedName`;
  Edit Mode falls back to a default seed (`SEED_PALETTES[0]`) if it's missing, rather than
  crashing.
- `reversed: boolean` — whether the stop order is flipped for CSS generation. Defaults to
  `false`. Toggled by tapping the already-active geometry tab. This does NOT mutate the
  underlying `stops` array order — `buildGradientCss` reads `reversed` and reverses the stop
  array only at render time, so the "canonical" stop order (and drag-reorder positions) stays
  stable regardless of the reversed flag's state.

`GradientType` (currently `'linear' | 'radial' | 'angular' | 'square'` in `src/lib/gradient.ts`)
expands to include `'mirror' | 'repeat'`.

Each stop retains its existing `{ hex, position }` shape, but `position` becomes purely
derived/computed (always auto-equalized across the current stop count) rather than a
user-adjustable value — no UI in this spec allows setting an arbitrary position.

## Geometry CSS generation (`buildGradientCss` extensions)

- **Mirror**: given stops `[A, B, C]`, render as `[A, B, C, C, B, A]` positions spread evenly
  across 0-100% as a `linear-gradient`. Seamless by construction — the color at the mirror
  midpoint is identical on both sides.
- **Repeat**: given stops `[A, B, C]`, render as `[A, B, C, A, B, C]` as a `linear-gradient`,
  with one additional blend stop inserted at the 50% seam so the last color (C) transitions
  smoothly into the first repeated color (A) instead of a hard cut. The inserted stop's color
  is the midpoint between C and A in OKLCH space (reuse `oklch.ts`'s conversion, blend at
  `l`/`c`/`h` component level, convert back to hex).
- **Reversed flag**: for any of the 6 types, if `gradient.reversed` is `true`, the stop array
  passed into the geometry-specific builder is reversed before rendering. Mirror/Repeat's
  seam-smoothing logic operates on the (possibly already reversed) stop order, so reversing a
  Mirror or Repeat gradient still produces a seamless result.

## Edit Mode layout

Replaces `EditModeStub` entirely (`src/components/EditModeStub.tsx` becomes `EditMode.tsx`,
or is superseded by a new component — implementation plan decides the exact file boundary).

1. **Preview** (top, ~40% of viewport, matching the existing stub's proportions): renders
   `buildGradientCss(gradient.type, gradient.stops)` exactly as-is, unchanged from the
   exploration screen — smooth for Linear/Radial/Angular/Mirror/Repeat, intentionally
   hard-wedged for Square (per its existing Turrell-style design). The "hard edges" feedback
   from testing applies to the **block stack below**, not the preview: the preview is never
   modified to look different from what actually renders; only the editable block stack is
   deliberately flat/hard-edged for clarity while dragging.
2. **Geometry tabs**: 6 pill buttons — Linear, Radial, Angular, Square, Mirror, Repeat.
   Tapping a non-active tab remaps the same stops onto the new geometry (just changes
   `gradient.type`, no stop mutation needed since `buildGradientCss` already accepts any
   `GradientStop[]` for any geometry). Tapping the already-active tab toggles `reversed`.
3. **Block stack**: an ordered, draggable list of blocks, one per stop (always the base 1x
   set, even for Mirror/Repeat, since those are render-time transforms of the same data).
   - For Linear/Radial/Mirror/Repeat: a vertical stack of flat, hard-edged rectangular blocks
     (per the resolved "stack blocks are hard, preview is always blended" requirement).
   - For Angular/Square: the same ordered list, rendered as pie/wheel wedges instead of
     rectangles (matching the shared mockup). Both renderers operate on the same underlying
     ordered block-id list; only the layout/geometry of the rendered shapes differs.
   - Dragging a block to a new position immediately re-equalizes all positions (e.g. 4 blocks
     → 0%, 33%, 67%, 100%) and updates the live preview. Haptic feedback (`navigator.vibrate`,
     reusing the same guarded pattern from `Feed.tsx`) fires on a successful reorder drop.
   - Each block has a small remove (×) button. Removing re-equalizes remaining positions.
     A minimum of 2 blocks is enforced — the remove button is disabled/hidden when only 2
     blocks remain.
   - Per the existing design system rules (`design.md`): block background is the stop color;
     border is `rgba(0,0,0,0.1)` if the color's OKLCH `L > 0.6`, else `rgba(255,255,255,0.1)`;
     text color (color name/hex label) flips black/white at the same threshold.
4. **Swatch carousel** (bottom, horizontal scroll): populated from
   `SEED_PALETTES[gradient.seedName].colors` (falling back to `SEED_PALETTES[0]` if
   `seedName` is missing on an older saved gradient). Dragging a swatch onto the block stack
   appends a new block of that color at the bottom, re-equalizing positions. This is the only
   way to add a color in v1 — no tap-to-add.

## Interaction summary (drag mechanics)

Both drag-to-reorder (within the stack) and drag-to-add (from carousel to stack) use pointer
events (consistent with the app's existing pointer-based gesture patterns in `useDoubleTap`
and `Feed`'s wheel/touch handling), with a drag-start delay threshold to disambiguate from a
simple tap/scroll, per the original PRD's gesture-handling directive ("explicit delays for
drag initiation"). Implementation detail (exact delay value, drop-target highlighting) is left
to the implementation plan.

## Testing

- Unit tests for the two new `buildGradientCss` geometry types (mirror, repeat — including
  the inserted OKLCH-blended seam stop for repeat) and the `reversed` flag's effect on stop
  order for all 6 types.
- Unit tests for position re-equalization on add/remove/reorder.
- Component tests for: tapping a non-active tab changes type without mutating stops; tapping
  the active tab toggles `reversed`; drag-reorder updates block order and re-equalizes
  positions; remove button re-equalizes and is disabled at the 2-block floor; swatch carousel
  renders from the gradient's `seedName` (with fallback when absent).
