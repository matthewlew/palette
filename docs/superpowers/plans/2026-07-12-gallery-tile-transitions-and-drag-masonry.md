# Gallery load-in transition + drag-masonry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the saved-gradient Gallery a staggered rise-and-fade load-in and replace the column-flow Pinterest masonry with a reading-order grid whose tiles can be dragged to reorder (persisted).

**Architecture:** Add a `reorderSaved` action to the zustand store (auto-persisted). Rework the load animation to a transform+opacity keyframe staggered by render index, re-triggered only on mount/filter-change via a grid remount key. Convert masonry from CSS `column-count` to a CSS Grid whose per-tile row spans are computed from measured tile height by a small `useMasonryRowSpans` hook. Wire native HTML5 drag-and-drop on the tiles, and animate the post-reorder reflow with a small FLIP hook `useFlipReorder`.

**Tech Stack:** React 19, Zustand 5, CSS Modules, Vitest + Testing Library. No new dependencies.

---

## File structure

- `src/store/useAppStore.ts` — add `reorderSaved(fromId, toId)` action + type (Task 1).
- `src/hooks/useMasonryRowSpans.ts` — NEW: measures grid children and sets `grid-row-end: span N` for reading-order masonry (Task 3).
- `src/hooks/useFlipReorder.ts` — NEW: FLIP transition of grid items after a reorder (Task 4).
- `src/components/Gallery.tsx` — index-based enter delay, grid remount key, drag handlers, wire both hooks, pass drag props to `Tile` (Tasks 2, 3, 4, 5).
- `src/components/Gallery.module.css` — new `tile-enter` keyframe, grid-based `.masonryGrid`/`.masonryTile`, drag state classes (Tasks 2, 3, 5).
- Tests: `src/store/useAppStore.test.ts` (Task 1), `src/components/Gallery.test.tsx` (Tasks 2, 5).

Run all tests with: `npm test -- --run`
Lint with: `npx oxlint src`

---

### Task 1: Store `reorderSaved` action

**Files:**
- Modify: `src/store/useAppStore.ts` (AppState interface near line 46; action near the other saved actions ~line 133)
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the `describe('useAppStore', …)` block in `src/store/useAppStore.test.ts`:

```ts
  it('reorders a saved gradient to a later position', () => {
    const a: Gradient = { ...sampleGradient, id: 'a' }
    const b: Gradient = { ...sampleGradient, id: 'b', stops: [{ hex: '#00ff00', position: 0 }, { hex: '#000000', position: 100 }] }
    const c: Gradient = { ...sampleGradient, id: 'c', stops: [{ hex: '#ffffff', position: 0 }, { hex: '#111111', position: 100 }] }
    useAppStore.setState({ saved: [a, b, c] })
    useAppStore.getState().reorderSaved('a', 'c')
    expect(useAppStore.getState().saved.map((g) => g.id)).toEqual(['b', 'c', 'a'])
  })

  it('reorders a saved gradient to an earlier position', () => {
    const a: Gradient = { ...sampleGradient, id: 'a' }
    const b: Gradient = { ...sampleGradient, id: 'b', stops: [{ hex: '#00ff00', position: 0 }, { hex: '#000000', position: 100 }] }
    const c: Gradient = { ...sampleGradient, id: 'c', stops: [{ hex: '#ffffff', position: 0 }, { hex: '#111111', position: 100 }] }
    useAppStore.setState({ saved: [a, b, c] })
    useAppStore.getState().reorderSaved('c', 'a')
    expect(useAppStore.getState().saved.map((g) => g.id)).toEqual(['c', 'a', 'b'])
  })

  it('no-ops reorder on unknown id or identical ids', () => {
    const a: Gradient = { ...sampleGradient, id: 'a' }
    const b: Gradient = { ...sampleGradient, id: 'b', stops: [{ hex: '#00ff00', position: 0 }, { hex: '#000000', position: 100 }] }
    useAppStore.setState({ saved: [a, b] })
    useAppStore.getState().reorderSaved('a', 'a')
    useAppStore.getState().reorderSaved('a', 'missing')
    expect(useAppStore.getState().saved.map((g) => g.id)).toEqual(['a', 'b'])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/store/useAppStore.test.ts`
Expected: FAIL — `reorderSaved is not a function`.

- [ ] **Step 3: Add the type to `AppState`**

In `src/store/useAppStore.ts`, in the `AppState` interface, directly after the `renameCurrentGradient` line, add:

```ts
  /** Moves the saved gradient `fromId` to occupy `toId`'s current position,
   * shifting the others. Persisted via the `saved` array. No-op if either id
   * is missing or the ids are equal. */
  reorderSaved: (fromId: string, toId: string) => void
```

- [ ] **Step 4: Implement the action**

In the store body, directly after the `renameCurrentGradient` action implementation, add:

```ts
      reorderSaved: (fromId, toId) => {
        if (fromId === toId) return
        const saved = get().saved
        const fromIndex = saved.findIndex((g) => g.id === fromId)
        const toIndex = saved.findIndex((g) => g.id === toId)
        if (fromIndex === -1 || toIndex === -1) return
        const next = saved.slice()
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        set({ saved: next })
      },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --run src/store/useAppStore.test.ts`
Expected: PASS (all three new tests plus existing ones).

- [ ] **Step 6: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add reorderSaved store action for gallery drag reorder"
```

---

### Task 2: Load-in transition — rise + fade, staggered by index

**Files:**
- Modify: `src/components/Gallery.module.css` (`.tile` ~line 132, `@keyframes tile-enter` ~line 147)
- Modify: `src/components/Gallery.tsx` (enter-delay computation ~lines 391-403; grid container ~line 573; imports)
- Test: `src/components/Gallery.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Gallery.test.tsx`. Put it in a new `describe` block at the end of the file:

```ts
describe('Gallery load-in stagger', () => {
  beforeEach(() => {
    useAppStore.setState({
      saved: [
        { id: 'a', type: 'linear', stops: [{ hex: '#000000', position: 0 }, { hex: '#111111', position: 100 }], name: 'A' },
        { id: 'b', type: 'linear', stops: [{ hex: '#ffffff', position: 0 }, { hex: '#eeeeee', position: 100 }], name: 'B' },
        { id: 'c', type: 'linear', stops: [{ hex: '#888888', position: 0 }, { hex: '#777777', position: 100 }], name: 'C' },
      ],
      mode: 'gallery',
    })
  })

  it('staggers tile animationDelay by render order, not color', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const tiles = screen.getAllByTestId('gallery-tile')
    const delays = tiles.map((t) => (t as HTMLElement).style.animationDelay)
    // Index-based: 0ms, 35ms, 70ms in DOM/render order regardless of lightness.
    expect(delays).toEqual(['0ms', '35ms', '70ms'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/components/Gallery.test.tsx -t "staggers tile animationDelay"`
Expected: FAIL — delays are lightness-ordered (e.g. `['35ms','0ms','70ms']` or capped values), not `['0ms','35ms','70ms']`.

- [ ] **Step 3: Replace the enter-delay computation in `Gallery.tsx`**

In `src/components/Gallery.tsx`, delete this block (currently ~lines 388-403):

```ts
  // Entering the Gallery dissolves the tiles in lightest-first: each tile's
  // fade delay is its rank by average OKLCH lightness. Steps are tiny (25ms,
  // capped) so it reads as a subtle ripple, not an obvious sequence.
  const ENTER_STEP_MS = 25
  const ENTER_DELAY_CAP_MS = 375
  const enterDelayByid = new Map<string, number>()
  ;[...filtered]
    .sort(
      (a, b) =>
        gradientMetric(b.stops.map((s) => s.hex), 'lightness') -
        gradientMetric(a.stops.map((s) => s.hex), 'lightness')
    )
    .forEach((gradient, rank) => {
      enterDelayByid.set(gradient.id, Math.min(rank * ENTER_STEP_MS, ENTER_DELAY_CAP_MS))
    })
```

Replace with:

```ts
  // Entering the Gallery loads tiles in reading order: each tile's delay is
  // its index in the rendered list, so the grid arrives top-left → bottom-right
  // like it's loading in. Tiny steps, capped, so it reads as a ripple.
  const ENTER_STEP_MS = 35
  const ENTER_DELAY_CAP_MS = 400
  const enterDelayFor = (index: number) => Math.min(index * ENTER_STEP_MS, ENTER_DELAY_CAP_MS)
```

- [ ] **Step 4: Pass the index-based delay and add the remount key**

In `src/components/Gallery.tsx`, change the grid container and the tile map. Replace the current block (the `<div ref={gridRef} …>` down through the closing `</div>` of the map, currently ~lines 573-589) with:

```tsx
        <div
          ref={gridRef}
          key={`${typeFilter ?? 'all'}-${hueFilter ?? 'all'}`}
          onKeyDown={handleGridKeyDown}
          className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}
        >
          {filtered.map((gradient, index) => (
            <Tile
              key={gradient.id}
              gradient={gradient}
              onOpen={setOpen}
              galleryLayout={galleryLayout}
              onRiff={onRiff}
              onDelete={removeSavedGradientById}
              enterDelayMs={enterDelayFor(index)}
            />
          ))}
        </div>
```

Note: the `key` on the grid remounts all tiles when the active filter changes, so the stagger re-runs on filter change but NOT on reorder (reorder does not change the filter key). Keep `key={gradient.id}` on each `Tile` so tiles are stable across reorders (required by Task 4's FLIP).

- [ ] **Step 5: Remove the now-unused import**

In `src/components/Gallery.tsx`, delete the line:

```ts
import { gradientMetric } from '../lib/sortColors'
```

(Verify no other reference to `gradientMetric` remains in the file first: `grep -n gradientMetric src/components/Gallery.tsx` should show none after removal.)

- [ ] **Step 6: Update the keyframe and `.tile` animation in CSS**

In `src/components/Gallery.module.css`, replace the `.tile` `animation` line and the `@keyframes tile-enter` block.

Change the `.tile` rule's animation (currently `animation: tile-enter 260ms ease both;`) to:

```css
  /* Staggered entry: rise + fade. 'backwards' holds the from-state through the
     per-tile animation-delay (set inline, ordered by render index) and then
     releases the transform so drag-reorder FLIP transforms (useFlipReorder)
     are not overridden by a forwards fill. */
  animation: tile-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
```

Replace the keyframe block:

```css
@keyframes tile-enter {
  from {
    opacity: 0;
  }
}
```

with:

```css
@keyframes tile-enter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
}
```

Leave the existing `@media (prefers-reduced-motion: reduce) { .tile { animation: none; } }` rule unchanged.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- --run src/components/Gallery.test.tsx -t "staggers tile animationDelay"`
Expected: PASS.

- [ ] **Step 8: Run the full suite + lint**

Run: `npm test -- --run && npx oxlint src`
Expected: PASS, no lint errors (confirms the `gradientMetric` import removal left no dangling reference).

- [ ] **Step 9: Commit**

```bash
git add src/components/Gallery.tsx src/components/Gallery.module.css src/components/Gallery.test.tsx
git commit -m "feat: gallery load-in rises and fades, staggered by render order"
```

---

### Task 3: Reading-order masonry via measured row spans

**Files:**
- Create: `src/hooks/useMasonryRowSpans.ts`
- Modify: `src/components/Gallery.module.css` (`.masonryGrid`/`.masonryTile` ~lines 399-422)
- Modify: `src/components/Gallery.tsx` (call the hook; the `gridRef` already exists)

- [ ] **Step 1: Create the hook**

Create `src/hooks/useMasonryRowSpans.ts` with exactly:

```ts
import { useLayoutEffect } from 'react'

// Height of one implicit grid row (must match grid-auto-rows in the CSS).
const ROW_UNIT_PX = 8

/**
 * Reading-order masonry with CSS Grid. The grid uses a small `grid-auto-rows`
 * unit; each child is measured (its natural height, via offsetHeight so CSS
 * transforms like the entry animation don't skew it) and told how many rows to
 * span. Re-measures on element resize and whenever `deps` change (layout,
 * filter, or order changes).
 *
 * Requires the grid to set `align-items: start` so children are content-height,
 * not stretched to their (tiny) grid area.
 */
export function useMasonryRowSpans(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const rowGapPx = parseFloat(getComputedStyle(container).rowGap) || 0
    const children = Array.from(container.children) as HTMLElement[]

    const apply = () => {
      for (const child of children) {
        const height = child.offsetHeight
        const span = Math.max(
          1,
          Math.round((height + rowGapPx) / (ROW_UNIT_PX + rowGapPx)),
        )
        child.style.gridRowEnd = `span ${span}`
      }
    }

    apply()
    const observer = new ResizeObserver(apply)
    children.forEach((child) => observer.observe(child))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
```

- [ ] **Step 2: Rewrite the masonry CSS to a grid**

In `src/components/Gallery.module.css`, replace the entire masonry block (currently ~lines 399-422):

```css
.masonryGrid {
  column-count: 2;
  column-gap: var(--space-md);
  width: 100%;
}

.masonryTile {
  composes: tile;
  display: inline-flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: var(--space-md);
  break-inside: avoid;
}

@media (min-width: 600px) {
  .masonryGrid {
    column-count: 3;
    column-gap: var(--space-xl);
  }
  .masonryTile {
    margin-bottom: var(--space-xl);
  }
}

@media (min-width: 1000px) {
  .masonryGrid {
    column-count: 4;
  }
}

@media (min-width: 1400px) {
  .masonryGrid {
    column-count: 5;
  }
}
```

with:

```css
/* Reading-order masonry: a CSS grid with a small row unit (grid-auto-rows),
   where useMasonryRowSpans measures each tile and sets its row span. Tiles
   flow left-to-right, top-to-bottom, so visual order == saved-array order
   (which is what makes drag-reorder intuitive). align-items:start lets tiles
   size to content instead of stretching to their (8px) grid area. */
.masonryGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 8px;
  align-items: start;
  column-gap: var(--space-md);
  row-gap: var(--space-md);
  width: 100%;
}

.masonryTile {
  composes: tile;
  width: 100%;
}

@media (min-width: 600px) {
  .masonryGrid {
    grid-template-columns: repeat(3, 1fr);
    column-gap: var(--space-xl);
    row-gap: var(--space-xl);
  }
}

@media (min-width: 1000px) {
  .masonryGrid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1400px) {
  .masonryGrid {
    grid-template-columns: repeat(5, 1fr);
  }
}
```

Note: `grid-auto-rows: 8px` must equal `ROW_UNIT_PX` in the hook.

- [ ] **Step 3: Call the hook in `Gallery.tsx`**

In `src/components/Gallery.tsx`, add the import near the other hook imports at the top:

```ts
import { useMasonryRowSpans } from '../hooks/useMasonryRowSpans'
```

Then, immediately after the `const gridRef = useRef<HTMLDivElement>(null)` line, add:

```ts
  // Masonry uses measured row spans; grid layout is a plain uniform grid.
  useMasonryRowSpans(gridRef, galleryLayout === 'masonry', [
    galleryLayout,
    filtered.map((g) => g.id).join(','),
  ])
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx oxlint src`
Expected: no errors.

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS. (jsdom has no real layout, so `offsetHeight` is 0 and spans become 1 — that is fine; these tests assert wiring, not pixel layout. Confirm no test throws.)

- [ ] **Step 6: Browser verification**

Start the dev server and confirm the masonry visually. From `.claude/launch.json` (create it if missing per the preview tool guidance, e.g. name `dev`, `npm run dev`, port from `vite.config.ts` / default 5173):
- Switch the Gallery to the masonry (Pinterest icon) layout.
- Expected: tiles of varied heights flow left→right, top→bottom (reading order), tightly packed with no per-column zig-zag. Resize the window; spans recompute and the layout stays tight.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMasonryRowSpans.ts src/components/Gallery.tsx src/components/Gallery.module.css
git commit -m "feat: reading-order grid masonry with measured row spans"
```

---

### Task 4: FLIP reorder hook

**Files:**
- Create: `src/hooks/useFlipReorder.ts`
- Modify: `src/components/Gallery.tsx` (call the hook; tag tiles with `data-tile-id`)

- [ ] **Step 1: Create the hook**

Create `src/hooks/useFlipReorder.ts` with exactly:

```ts
import { useLayoutEffect, useRef } from 'react'

/**
 * FLIP animation for grid reflow after a reorder. Grid position changes are
 * layout-driven, which CSS transitions don't animate — so we record each
 * tile's position, and after the DOM updates we translate it back to its old
 * spot with no transition, then release to `translate(0)` with a transition so
 * it glides into place.
 *
 * Only animates a pure reorder (same set of ids): when tiles are added/removed
 * (e.g. a filter change) it just records positions, leaving the entry keyframe
 * to handle the appearance. Tiles must carry `data-tile-id`.
 */
export function useFlipReorder(
  containerRef: React.RefObject<HTMLElement | null>,
  orderKey: string,
  enabled: boolean,
) {
  const prevRects = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      prevRects.current = new Map()
      return
    }

    const tiles = Array.from(
      container.querySelectorAll<HTMLElement>('[data-tile-id]'),
    )
    const prev = prevRects.current
    const next = new Map<string, DOMRect>()
    for (const tile of tiles) {
      next.set(tile.dataset.tileId as string, tile.getBoundingClientRect())
    }

    const sameSet =
      prev.size === next.size &&
      [...next.keys()].every((id) => prev.has(id))

    if (enabled && prev.size > 0 && sameSet) {
      for (const tile of tiles) {
        const id = tile.dataset.tileId as string
        const oldRect = prev.get(id) as DOMRect
        const newRect = next.get(id) as DOMRect
        const dx = oldRect.left - newRect.left
        const dy = oldRect.top - newRect.top
        if (dx === 0 && dy === 0) continue
        tile.style.transition = 'none'
        tile.style.transform = `translate(${dx}px, ${dy}px)`
        requestAnimationFrame(() => {
          tile.style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)'
          tile.style.transform = ''
        })
      }
    }

    prevRects.current = next
  }, [orderKey, enabled, containerRef])
}
```

- [ ] **Step 2: Tag tiles and call the hook in `Gallery.tsx`**

Add the import near the other hook imports:

```ts
import { useFlipReorder } from '../hooks/useFlipReorder'
```

Immediately after the `useMasonryRowSpans(...)` call added in Task 3, add:

```ts
  // Glide tiles to their new spots after a drag reorder (FLIP). Disabled under
  // reduced-motion. Keyed on the current order so it runs only on reorder.
  const orderKey = filtered.map((g) => g.id).join(',')
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useFlipReorder(gridRef, orderKey, !prefersReducedMotion)
```

In the `Tile` component, add `data-tile-id={gradient.id}` to the tile root `<div>` (the one with `data-testid="gallery-tile"`), directly under that attribute:

```tsx
      data-testid="gallery-tile"
      data-tile-id={gradient.id}
```

- [ ] **Step 3: Verify types + lint + tests**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx oxlint src && npm test -- --run`
Expected: all pass. (jsdom `getBoundingClientRect` returns zeros, so FLIP computes no movement — the hook is a no-op there, tests unaffected.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFlipReorder.ts src/components/Gallery.tsx
git commit -m "feat: FLIP-animate gallery tiles reflowing after reorder"
```

---

### Task 5: Native drag-to-reorder wiring

**Files:**
- Modify: `src/components/Gallery.tsx` (`Tile` props/handlers; `Gallery` drag state + handlers; pass props)
- Modify: `src/components/Gallery.module.css` (drag state classes)
- Test: `src/components/Gallery.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block at the end of `src/components/Gallery.test.tsx`:

```ts
describe('Gallery drag reorder', () => {
  const g = (id: string, hex: string): Gradient => ({
    id,
    type: 'linear',
    stops: [{ hex, position: 0 }, { hex: '#000000', position: 100 }],
    name: id.toUpperCase(),
  })

  beforeEach(() => {
    useAppStore.setState({ saved: [g('a', '#ff0000'), g('b', '#00ff00'), g('c', '#0000ff')], mode: 'gallery' })
  })

  it('tiles are draggable when no filter is active', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const tiles = screen.getAllByTestId('gallery-tile')
    expect(tiles[0].getAttribute('draggable')).toBe('true')
  })

  it('reorders the saved array when a tile is dropped on another', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const tiles = screen.getAllByTestId('gallery-tile')
    // Drag tile A (index 0) onto tile C (index 2).
    fireEvent.dragStart(tiles[0])
    fireEvent.dragEnter(tiles[2])
    fireEvent.dragOver(tiles[2])
    fireEvent.drop(tiles[2])
    expect(useAppStore.getState().saved.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not make tiles draggable while a type filter is active', () => {
    render(<Gallery onRiff={vi.fn()} />)
    // 'a','b','c' are all linear; click the Linear chip to filter.
    fireEvent.click(screen.getByRole('button', { name: /^Linear/ }))
    const tiles = screen.getAllByTestId('gallery-tile')
    expect(tiles[0].getAttribute('draggable')).toBe('false')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/components/Gallery.test.tsx -t "drag reorder"`
Expected: FAIL — tiles have no `draggable` attribute and drop does not reorder.

- [ ] **Step 3: Extend the `Tile` props and root element**

In `src/components/Gallery.tsx`, extend the `Tile` function's prop list. Change the destructured params and type to add the drag props:

```tsx
function Tile({
  gradient,
  onOpen,
  galleryLayout,
  onRiff,
  onDelete,
  enterDelayMs,
  draggable,
  isDragging,
  isDragOver,
  onDragStartTile,
  onDragEnterTile,
  onDropTile,
  onDragEndTile,
}: {
  gradient: Gradient
  onOpen: (gradient: Gradient) => void
  galleryLayout: 'grid' | 'masonry'
  onRiff: (gradient: Gradient) => void
  onDelete: (id: string) => void
  enterDelayMs: number
  draggable: boolean
  isDragging: boolean
  isDragOver: boolean
  onDragStartTile: (id: string) => void
  onDragEnterTile: (id: string) => void
  onDropTile: (id: string) => void
  onDragEndTile: () => void
}) {
```

Then update the tile root `<div>` (the `role="button"` element). Replace its opening tag and attributes with:

```tsx
    <div
      role="button"
      tabIndex={0}
      data-testid="gallery-tile"
      data-tile-id={gradient.id}
      className={[
        galleryLayout === 'masonry' ? styles.masonryTile : styles.tile,
        draggable ? styles.tileDraggable : '',
        isDragging ? styles.tileDragging : '',
        isDragOver ? styles.tileDragOver : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: `${enterDelayMs}ms` }}
      aria-label={`${gradient.name ?? 'Untitled'}, ${gradient.type} gradient`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        // Firefox requires data to be set for a drag to start.
        e.dataTransfer.setData('text/plain', gradient.id)
        onDragStartTile(gradient.id)
      }}
      onDragEnter={() => onDragEnterTile(gradient.id)}
      onDragOver={(e) => {
        if (!draggable) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDropTile(gradient.id)
      }}
      onDragEnd={onDragEndTile}
      onClick={() => onOpen(gradient)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(gradient)
        }
      }}
    >
```

(This replaces the existing root `<div>` opening tag, including its prior `className`, `style`, `aria-label`, `onClick`, and `onKeyDown` — those are all reproduced above with the drag additions.)

- [ ] **Step 4: Add drag state and handlers in `Gallery`**

In the `Gallery` component, after the existing `const [open, setOpen] = useState<Gradient | null>(null)` line, add:

```tsx
  const reorderSaved = useAppStore((s) => s.reorderSaved)
  const dragIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function clearDrag() {
    dragIdRef.current = null
    setDraggingId(null)
    setDragOverId(null)
  }
  function handleDragStartTile(id: string) {
    dragIdRef.current = id
    setDraggingId(id)
  }
  function handleDragEnterTile(id: string) {
    if (dragIdRef.current && id !== dragIdRef.current) setDragOverId(id)
  }
  function handleDropTile(id: string) {
    const from = dragIdRef.current
    if (from && from !== id) reorderSaved(from, id)
    clearDrag()
  }
```

(`useState` and `useRef` are already imported at the top of the file; `useAppStore` is already imported.)

- [ ] **Step 5: Pass the drag props to each `Tile`**

In the `filtered.map(...)` render (updated in Task 2), replace the `<Tile … />` with:

```tsx
            <Tile
              key={gradient.id}
              gradient={gradient}
              onOpen={setOpen}
              galleryLayout={galleryLayout}
              onRiff={onRiff}
              onDelete={removeSavedGradientById}
              enterDelayMs={enterDelayFor(index)}
              draggable={!hasFilters}
              isDragging={draggingId === gradient.id}
              isDragOver={dragOverId === gradient.id}
              onDragStartTile={handleDragStartTile}
              onDragEnterTile={handleDragEnterTile}
              onDropTile={handleDropTile}
              onDragEndTile={clearDrag}
            />
```

- [ ] **Step 6: Add drag-state CSS**

Append to `src/components/Gallery.module.css`:

```css
/* Drag-to-reorder affordances (desktop, native HTML5 DnD). Only tiles in the
   unfiltered board are draggable — reordering a filtered subset is ambiguous. */
.tileDraggable {
  cursor: grab;
}

.tileDraggable:active {
  cursor: grabbing;
}

.tileDragging {
  opacity: 0.85;
  transform: scale(1.03);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.tileDragOver .tilePreview {
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .tileDragging {
    transform: none;
  }
}
```

- [ ] **Step 7: Run the drag tests to verify they pass**

Run: `npm test -- --run src/components/Gallery.test.tsx -t "drag reorder"`
Expected: PASS (all three).

- [ ] **Step 8: Run the full suite + lint + types**

Run: `npm test -- --run && npx oxlint src && npx tsc -p tsconfig.app.json --noEmit`
Expected: all pass.

- [ ] **Step 9: Browser verification**

With the dev server running (Task 3 preview):
- Unfiltered masonry: cursor shows grab over a tile; drag a tile onto another → on drop the others glide into place (FLIP) and the dragged tile lands in the new slot.
- Reload the page → the new order persists.
- Click a type or hue chip → tiles are no longer draggable (grab cursor gone) but still open the viewer on click.
- Verify a plain click (no drag) still opens the viewer.

- [ ] **Step 10: Commit**

```bash
git add src/components/Gallery.tsx src/components/Gallery.module.css src/components/Gallery.test.tsx
git commit -m "feat: drag gallery tiles to reorder your board (persisted)"
```

---

## Self-review notes (addressed)

- **Spec coverage:** load motion (Task 2), reading-order masonry (Task 3), drag+persist (Tasks 1, 5), ease-into-place reflow (Task 4), filter disables drag (Task 5), reduced-motion (Tasks 2, 5), no new deps (all). Store `reorderSaved` matches the spec signature.
- **Forwards-fill conflict:** the entry animation uses `backwards` (not `both`) so its final transform does not override the FLIP inline transform in Task 4.
- **Measurement vs transform:** `useMasonryRowSpans` uses `offsetHeight` (transform-independent) so the entry animation's `scale`/`translateY` cannot skew row spans.
- **Grid `align-items: start`** is required for content-height measurement — included in Task 3 CSS.
- **`ROW_UNIT_PX` (8) == `grid-auto-rows: 8px`** — kept in sync across Task 3 hook and CSS.
- **Click vs drag:** native DnD suppresses the click that would otherwise follow a drag, so `onClick` open still works after a drop without extra guarding.
