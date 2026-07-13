# Gallery: load-in transition + structured drag-masonry

Date: 2026-07-12
Surface: `src/components/Gallery.tsx`, `src/components/Gallery.module.css`, `src/store/useAppStore.ts`

## Goal

Two independent improvements to the saved-gradient Gallery:

1. **Load-in transition** — when the Gallery mounts, tiles arrive with a small
   per-tile stagger and a subtle rise-and-fade, so the grid reads as "loading
   in" rather than appearing all at once.
2. **Structured drag-masonry** — replace the current column-flow (Pinterest)
   masonry with a reading-order grid, and let the user drag tiles to reorder
   their board. The new order persists.

The two pieces are independent and can be built/verified separately.

## Non-goals (YAGNI)

- No touch-drag reorder in this pass (native HTML5 DnD is desktop-only). Noted
  as a follow-up.
- No drag-to-reorder while a filter is active (ambiguous — see below).
- No new dependencies. Hand-rolled, matching the codebase's lean tree
  (react, react-dom, zustand only).

---

## Piece 1 — Load-in transition

### Current behavior

`Gallery.module.css` `.tile` runs `tile-enter` (opacity 0 → 1, 260ms). The
per-tile `animationDelay` is set inline in `Gallery.tsx` and ordered by OKLCH
lightness (lightest first), 25ms steps capped at 375ms.

### New behavior

- **Motion:** fade + rise + hair of scale.
  ```css
  @keyframes tile-enter {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    /* to: implicit opacity 1, transform none */
  }
  .tile { animation: tile-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  ```
- **Stagger order:** change from lightness rank to **visual reading order** —
  each tile's delay is its index in the rendered `filtered` list. Delay =
  `min(index * STEP_MS, CAP_MS)` with `STEP_MS ≈ 35`, `CAP_MS ≈ 400`. This is
  the "millisecond-ish delay, like it's loading" the user asked for, flowing
  top-left → right/down.
- **Re-trigger scope:** the animation must run on **gallery entry and filter
  change**, but must NOT re-run on every reorder drag (that would fight the
  reorder transition). Implement with a "mount token" — a `key` or state value
  that changes on mount and when the active filters change, applied so the
  staggered animation restarts only then. A drag reorder does not change the
  token, so tiles use the reorder transition (Piece 2) instead of re-entering.
- **Reduced motion:** keep the existing
  `@media (prefers-reduced-motion: reduce) { .tile { animation: none } }`.

### Removal

The lightness-based delay computation in `Gallery.tsx` (the
`gradientMetric(...'lightness')` sort building `enterDelayByid`) is replaced by
the index-based delay. Drop the now-unused `gradientMetric` import if nothing
else uses it.

---

## Piece 2 — Structured masonry + drag-to-reorder

### Layout: column-flow → reading-order grid

Current masonry (`.masonryGrid`) uses CSS `column-count`, which flows tiles
**down columns**. That produces the "random Pinterest tiling" the user wants
gone, and makes drag-reorder confusing because visual order zig-zags down each
column before moving right.

Replace with a **reading-order CSS Grid** with row spans:

- `.masonryGrid` becomes `display: grid` with a fixed column count per
  breakpoint (reuse the existing 2/3/4/5 breakpoints at 600/1000/1400px) and a
  small `grid-auto-rows` unit (e.g. `8px`) plus the existing gap.
- Each tile spans a deterministic number of rows derived from its aspect ratio
  (the existing per-id `RATIOS` selection). The tile computes its row-span from
  its aspect ratio and the `grid-auto-rows` unit and sets `grid-row-end: span N`
  inline. This yields the varied-height masonry look while flowing tiles
  **left-to-right, top-to-bottom**, so visual order == `saved` array order.
- `grid` layout (uniform 4/5) is unchanged structurally; it is already
  reading-order.

Ragged bottom edges are acceptable (native CSS has no reading-order gap-fill
without experimental `masonry`); the deterministic spans keep it visually
balanced.

### Drag to reorder (native HTML5 DnD)

- Each `Tile` root gets `draggable={draggable}` where `draggable` is true only
  when **no filter is active** (`!hasFilters`) — passed down from `Gallery`.
- Handlers on the tile:
  - `onDragStart`: set the dragged id (via `dataTransfer.setData` and/or a ref
    in `Gallery`), add a "lifted" visual state.
  - `onDragOver`: `preventDefault()` to allow drop; mark this tile as the
    current drop target for the insertion cue.
  - `onDrop` / `onDragEnd`: resolve from-id and to-id, clear drag state, and if
    they differ call `reorderSaved(fromId, toId)`.
- Because tiles are already `role="button"` divs (not native `<button>`), adding
  `draggable` is safe. Click-to-open still works: a click without a drag fires
  `onClick` as today; a drag suppresses the click.
- **Filter interaction:** when `hasFilters` is true, tiles are not draggable
  (cursor + no drag handlers). They remain clickable. This avoids reordering a
  subset that doesn't represent the full board order.

### Reorder animation ("fills the gap")

- The grid items get a `transition: transform 220ms cubic-bezier(0.2,0.8,0.2,1)`
  so that when the array reorders and the grid reflows, tiles ease to their new
  positions instead of snapping.
- The lifted (dragged) tile: slight `scale(1.03)`, raised `box-shadow`, reduced
  opacity (~0.85). The drop-target tile shows an insertion cue (e.g. an outline
  or a shifted margin) so the user sees where it will land.

Note: native DnD does not provide a true FLIP transition of the dragged element
during the drag (the browser renders a drag image); the "settle" transition
applies to the non-dragged tiles reflowing after drop. This is acceptable and
keeps the implementation dependency-free.

### Store change

Add to `useAppStore` (and its `AppState` type):

```ts
reorderSaved: (fromId: string, toId: string) => void
```

Implementation: find `fromIndex` and `toIndex` in `saved` by id; splice the
moved item out and insert it at the target index; `set({ saved: next })`.
No migration or version bump needed — the persisted key is still `saved`, just
reordered. Persistence is automatic via the existing zustand `persist`
middleware.

Guard: if either id is missing or `fromId === toId`, no-op.

---

## Data flow

- `Gallery` reads `saved`, derives `filtered` and `hasFilters` (unchanged).
- `Gallery` passes `enterDelayMs` (index-based) and `draggable` (`!hasFilters`)
  plus drag callbacks to each `Tile`.
- Drag drop → `reorderSaved(fromId, toId)` → store splices `saved` → persisted →
  `Gallery` re-renders in new order → grid reflow eases via CSS transition.
- The load stagger's mount token changes on mount / filter change only, so
  reorders reflow (transition) rather than re-entering (keyframe).

## Testing

Extend `Gallery.test.tsx` / `useAppStore.test.ts`:

- **Store:** `reorderSaved` moves an item from one index to another; no-ops on
  unknown id and on `fromId === toId`; order persists in the array.
- **Gallery:** tiles are `draggable` when no filter active and not draggable
  when a filter is active. A simulated drag from tile A onto tile B calls
  `reorderSaved` with the right ids. (jsdom DnD is limited — assert the handler
  wiring / that `reorderSaved` is invoked with expected args rather than pixel
  behavior.)
- **Animation:** assert each tile's inline `animationDelay` follows index order
  (0, 35ms, 70ms, … capped), replacing the prior lightness-order assertion if
  one exists.

## Manual verification (browser preview)

1. Enter Gallery → tiles rise+fade in, staggered top-left first.
2. Masonry layout shows varied heights flowing left-to-right (reading order).
3. Drag a tile to a new spot → others ease into place, order sticks after
   reload.
4. Apply a type/hue filter → tiles no longer draggable, still clickable.
5. `prefers-reduced-motion` → no entry animation.
