# Edit Mode Fixes & Color Set — Design Spec

Date: 2026-07-07
Status: approved for planning
Follows: 2026-07-07-edit-mode-design.md (Edit Mode, PR #2, merged)

This is a fix/enhancement round on Edit Mode, plus the introduction of a
project-wide "color set" concept. Sub-projects 3 (export/handoff) and 4 remain
future work.

## Goals

1. Exit Edit Mode by tapping the gradient or an iOS-style back chevron (no Done button).
2. Double-tap on the gradient preview likes it (in edit mode as well as the feed).
3. Replace the small seed-palette carousel with a 36-color named swatch tray
   showing selected state (border + checkmark) for colors already in the gradient.
4. Introduce an `activeColorSet` store concept so a future "import your own
   colors" feature only swaps one value. Explore-feed generation reads from it.
5. Fix the Square geometry to a true James Turrell look: concentric squares
   with heavy blur, not flat conic wedges.
6. Fix the Angular geometry's harsh 360°→0° seam by blending last→first color.
7. Drag-and-drop swatches into the block stack with live reorder animation:
   blocks resize and move out of the way, showing the insertion gap.

## Non-Goals

- Import/save custom color set UI and persistence (architected for, not built).
- Export/handoff, micro-variation gallery, full OKLCH ramp view.
- Hex-code display anywhere in the tray (names only; user-defined values come later).

## 1. Navigation & Like

- Remove the `Done` button from `EditMode`.
- Add a back chevron button (‹, iOS-style) at the top-left of the edit screen.
  Tapping it calls `onExit()` immediately. `aria-label="Back"`.
- The gradient preview handles taps with double-tap disambiguation
  (reuse/extend `useDoubleTap`):
  - Single tap: after a ~250ms window with no second tap, exit to explore.
  - Double tap: like the current gradient (same store action + heart animation
    as the feed) and stay in edit mode.
- Edits are committed to the store continuously (existing behavior), so exiting
  by any path needs no save step.

## 2. Color Set Architecture

New `src/lib/colorSets.ts`:

```ts
export interface NamedColor { name: string; value: Oklch }
export interface ColorSet { name: string; colors: NamedColor[] } // colors.length === 36 for the default
export const DEFAULT_COLOR_SET: ColorSet
```

- The default set is BKLYN CLAY-inspired: 36 colors with studio/glaze-style
  names (e.g. Clay, Terracotta, Sand, Ash, Slate, Speckled White, Indigo,
  Moss…), organized as 6 hue families × 6 shades: earth reds, warm neutrals,
  cool neutrals, greens, blues, darks. Names must be unique.
- Store (`useAppStore`) gains `activeColorSet: ColorSet` (initialized to
  `DEFAULT_COLOR_SET`) and `setActiveColorSet(set)`. No persistence this round.
- `lib/palette.ts` generation samples from `activeColorSet.colors` instead of
  `SEED_PALETTES`. `SEED_PALETTES` is deleted and `gradient.seedName`
  is removed from the `Gradient` type — the tray reads `activeColorSet`
  directly and no longer receives a seed name prop.
- Equality between a gradient stop and a named color is by hex value after
  OKLCH→hex conversion (stops store hex).

## 3. Swatch Tray (replaces SwatchCarousel)

- Layout: 2 stacked rows × 18 columns in a single horizontally scrolling
  container; all 36 colors reachable by one horizontal scroll gesture.
- Each swatch shows its color name in a small label under the swatch
  (legibility per the PRD contrast rule doesn't apply below the swatch; use the
  app's standard muted label color).
- Selected state (color's hex currently present in the gradient stops):
  2px offset + 2px border ring, plus a small checkmark circle badge
  (per the original PRD treatment). Purpose: prevent accidentally adding a
  near-duplicate (e.g. two similar greys).
- Interactions:
  - Tap unselected swatch → append that color as a new stop (positions re-equalized).
  - Tap selected swatch → remove the most recently added instance of that hex
    (never below the 2-stop minimum; if removal would violate it, no-op).
  - Press-and-drag (150ms hold, existing gesture) → drag into the block area;
    always adds, even if the color already exists (intentional duplicates).
- The tray is generic over `activeColorSet` — no knowledge of seed palettes.

## 4. Drag-Drop with Live Reorder Animation

- While a swatch drag is over the block container, compute the insertion index
  from pointer position (vertical position for BlockStack; angular position for
  BlockWheel).
- BlockStack: render an insertion gap at that index — existing blocks
  FLIP-animate (transform transitions) shrinking/shifting to make room; the gap
  closes if the pointer leaves the container.
- Drop inserts the new stop at the computed index (not appended at the end),
  then positions re-equalize.
- BlockWheel: minimum viable version — highlight the wedge boundary nearest the
  pointer and insert there on drop; full wedge-resize animation is a
  nice-to-have, not required.
- Haptics: reuse the existing reorder haptic on successful insert.

## 5. Gradient Rendering Fixes

### Angular seam blend

In `buildGradientCss`, the `angular` case appends the first color again at the
end: `conic-gradient(c1 p1, …, cn pn, c1 360deg)` with positions re-scaled so
the final segment blends `cn → c1`. No harsh line at 0°/360°.

### Turrell square

- New `TurrellSquare` component renders the `square` type: one nested,
  absolutely-positioned square layer per stop, outermost color first (stop 1 is
  the outer field), each inner square proportionally smaller and centered, with
  a heavy blur / soft edge (CSS `filter: blur(...)` or large soft
  `box-shadow`), producing the glowing concentric-square Turrell look.
- Used everywhere the square type renders: the explore feed page and the edit
  preview. Reversed flag reverses layer order.
- `buildGradientCss('square', …)` keeps returning the existing conic
  approximation as a non-DOM fallback (future export path); UI components
  branch to `TurrellSquare` instead.
- Overflow hidden on the container; blur must not bleed past the card edge.

## 6. Testing

- `colorSets`: exactly 36 colors, unique names, valid OKLCH ranges.
- `buildGradientCss` angular: output ends with a repeated first color / blends
  the seam; existing cases unchanged.
- `TurrellSquare`: renders one layer per stop, outermost = first stop, reversed
  flips order.
- Preview tap handling: single tap exits after the delay; double tap likes and
  does not exit.
- Tray: checkmark shows exactly for hexes present in stops; tap-add appends;
  tap-remove removes the last-added instance and respects the 2-stop minimum;
  drag-add allows duplicates.
- Insertion index math: pure function tested for pointer→index mapping.
- Store: `activeColorSet` default and setter; palette generation samples only
  from the active set.
