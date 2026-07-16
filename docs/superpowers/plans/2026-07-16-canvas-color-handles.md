# Canvas Color Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user reorder a gradient's colors by dragging proximity-revealed dot handles directly on the edit canvas, Figma-style, while the `FlowEditor` continues to own fine position tuning.

**Architecture:** A pure geometry module (`stopAnchor`) maps each stop to a normalized canvas point per gradient type, with a configurable spoke/corner direction for the symmetric radial/square cases. A pure pixel-space reorder-projection module (`canvasReorder`) finds the nearest anchor to a cursor position, with and without a distance threshold. `CanvasHandles` is a fully prop-driven component (no DOM measurement of its own) that renders the dots, reveals the nearest one within 24px, and drives a live drag-to-reorder using pointer capture. `EditMode` measures the canvas via `getBoundingClientRect` on pointer move, forwards pixel-relative cursor + size down, and wires `onReorder` to the existing `commit()` path so canvas and `FlowEditor` share one source of truth.

**Tech Stack:** TypeScript, React 19, Vitest + Testing Library. Reuses `src/lib/stopOrdering.ts` (`EditableStop`), `src/lib/gradient.ts` (`GradientType`, `FanAnchor`, `FAN_ANCHOR_CONFIG` — newly exported), `src/hooks/useDragReorder.ts` (`moveItem` — newly exported), `src/lib/oklch.ts` (`isLightColor`).

---

## File Structure

- Modify: `src/lib/gradient.ts` — export `FAN_ANCHOR_CONFIG`.
- Create: `src/lib/stopAnchor.ts` — per-geometry anchor math (pure).
- Create: `src/lib/stopAnchor.test.ts`.
- Create: `src/lib/canvasReorder.ts` — pixel-space nearest-anchor helpers (pure).
- Create: `src/lib/canvasReorder.test.ts`.
- Modify: `src/hooks/useDragReorder.ts` — export `moveItem`.
- Create: `src/components/CanvasHandles.tsx` + `CanvasHandles.module.css`.
- Create: `src/components/CanvasHandles.test.tsx`.
- Modify: `src/components/EditMode.tsx` — mount `CanvasHandles`, forward cursor/size, add `spoke`/`corner` state + direction toggle.
- Modify: `src/components/EditMode.module.css` — direction toggle styles.

---

### Task 1: Export `FAN_ANCHOR_CONFIG` and add `stopAnchor` geometry math

**Files:**
- Modify: `src/lib/gradient.ts:27` (add `export`)
- Create: `src/lib/stopAnchor.ts`
- Test: `src/lib/stopAnchor.test.ts`

**Context:** `src/lib/gradient.ts` has `const FAN_ANCHOR_CONFIG: Record<FanAnchor, { at: string; from: number; px: number; py: number }>` at line 27, currently unexported. `GradientType` and `FanAnchor` are already exported from the same file.

- [ ] **Step 1: Export `FAN_ANCHOR_CONFIG`**

In `src/lib/gradient.ts`, change:
```ts
const FAN_ANCHOR_CONFIG: Record<FanAnchor, { at: string; from: number; px: number; py: number }> = {
```
to:
```ts
export const FAN_ANCHOR_CONFIG: Record<FanAnchor, { at: string; from: number; px: number; py: number }> = {
```

- [ ] **Step 2: Run existing gradient tests to confirm no regression**

Run: `npm test -- src/lib/gradient.test.ts`
Expected: PASS (pure addition of a keyword, no behavior change).

- [ ] **Step 3: Write the failing test**

```ts
// src/lib/stopAnchor.test.ts
import { describe, it, expect } from 'vitest'
import { stopAnchor } from './stopAnchor'

describe('stopAnchor', () => {
  it('linear: runs down the vertical axis', () => {
    expect(stopAnchor('linear', [0, 50, 100], 0)).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('linear', [0, 50, 100], 1)).toEqual({ x: 0.5, y: 0.5 })
    expect(stopAnchor('linear', [0, 50, 100], 2)).toEqual({ x: 0.5, y: 1 })
  })

  it('mirror: runs down the top half of the axis', () => {
    expect(stopAnchor('mirror', [0, 100], 0)).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('mirror', [0, 100], 1)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('radial: defaults to the up spoke, center to top edge', () => {
    expect(stopAnchor('radial', [0, 100], 0)).toEqual({ x: 0.5, y: 0.5 })
    expect(stopAnchor('radial', [0, 100], 1)).toEqual({ x: 0.5, y: 0 })
  })

  it('radial: honors all four spokes at p=1 (full extent)', () => {
    expect(stopAnchor('radial', [100], 0, { spoke: 'up' })).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('radial', [100], 0, { spoke: 'down' })).toEqual({ x: 0.5, y: 1 })
    expect(stopAnchor('radial', [100], 0, { spoke: 'left' })).toEqual({ x: 0, y: 0.5 })
    expect(stopAnchor('radial', [100], 0, { spoke: 'right' })).toEqual({ x: 1, y: 0.5 })
  })

  it('square: defaults to the top-left corner along the diagonal', () => {
    expect(stopAnchor('square', [0, 100], 0)).toEqual({ x: 0.5, y: 0.5 })
    expect(stopAnchor('square', [0, 100], 1)).toEqual({ x: 0, y: 0 })
  })

  it('square: honors all four corners at p=1', () => {
    expect(stopAnchor('square', [100], 0, { corner: 'tl' })).toEqual({ x: 0, y: 0 })
    expect(stopAnchor('square', [100], 0, { corner: 'tr' })).toEqual({ x: 1, y: 0 })
    expect(stopAnchor('square', [100], 0, { corner: 'bl' })).toEqual({ x: 0, y: 1 })
    expect(stopAnchor('square', [100], 0, { corner: 'br' })).toEqual({ x: 1, y: 1 })
  })

  it('angular: sits at mid-radius, sweeping clockwise from the top', () => {
    const top = stopAnchor('angular', [0], 0)
    expect(top.x).toBeCloseTo(0.5, 5)
    expect(top.y).toBeCloseTo(0.5 - 0.32, 5)
    const quarter = stopAnchor('angular', [25], 0)
    expect(quarter.x).toBeCloseTo(0.5 + 0.32, 5)
    expect(quarter.y).toBeCloseTo(0.5, 5)
  })

  it('fan: sits at mid-radius from the anchor pivot, sweeping the 180deg cone', () => {
    const start = stopAnchor('fan', [0], 0, { fanAnchor: 'bottom' })
    // bottom pivot is (0.5, 1); at p=0 the cone starts at 270deg (from FAN_ANCHOR_CONFIG).
    expect(start.x).toBeCloseTo(0.5 - 0.35, 4)
    expect(start.y).toBeCloseTo(1, 4)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/lib/stopAnchor.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 5: Implement `src/lib/stopAnchor.ts`**

```ts
import type { FanAnchor, GradientType } from './gradient'
import { FAN_ANCHOR_CONFIG } from './gradient'

export type SpokeDir = 'up' | 'down' | 'left' | 'right'
export type SquareCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface StopAnchorOpts {
  spoke?: SpokeDir
  corner?: SquareCorner
  fanAnchor?: FanAnchor
}

export interface AnchorPoint {
  x: number
  y: number
}

const SPOKE_VECTOR: Record<SpokeDir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -0.5 },
  down: { dx: 0, dy: 0.5 },
  left: { dx: -0.5, dy: 0 },
  right: { dx: 0.5, dy: 0 },
}

const CORNER_VECTOR: Record<SquareCorner, { dx: number; dy: number }> = {
  tl: { dx: -0.5, dy: -0.5 },
  tr: { dx: 0.5, dy: -0.5 },
  bl: { dx: -0.5, dy: 0.5 },
  br: { dx: 0.5, dy: 0.5 },
}

const ANGULAR_RADIUS = 0.32
const FAN_RADIUS = 0.35

/**
 * The "center of color volume" for a stop, as normalized canvas coords
 * (0..1) for the given geometry. Radial/square anchors pick a canonical
 * spoke/corner — cosmetic only, since those gradients render identically
 * regardless of direction. Angular/fan sample a canonical mid-radius, since
 * a ring/sector has no single center.
 */
export function stopAnchor(
  type: GradientType,
  positions: number[],
  index: number,
  opts: StopAnchorOpts = {},
): AnchorPoint {
  const p = positions[index] / 100

  switch (type) {
    case 'linear':
      return { x: 0.5, y: p }
    case 'mirror':
      return { x: 0.5, y: 0.5 * p }
    case 'radial': {
      const v = SPOKE_VECTOR[opts.spoke ?? 'up']
      return { x: 0.5 + v.dx * p, y: 0.5 + v.dy * p }
    }
    case 'square': {
      const v = CORNER_VECTOR[opts.corner ?? 'tl']
      return { x: 0.5 + v.dx * p, y: 0.5 + v.dy * p }
    }
    case 'angular': {
      const theta = p * 2 * Math.PI
      return {
        x: 0.5 + ANGULAR_RADIUS * Math.sin(theta),
        y: 0.5 - ANGULAR_RADIUS * Math.cos(theta),
      }
    }
    case 'fan': {
      const { from, px, py } = FAN_ANCHOR_CONFIG[opts.fanAnchor ?? 'bottom']
      const deg = from + p * 180
      const rad = (deg * Math.PI) / 180
      return {
        x: px + FAN_RADIUS * Math.sin(rad),
        y: py - FAN_RADIUS * Math.cos(rad),
      }
    }
    case 'repeat':
      return { x: 0.5, y: p }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/lib/stopAnchor.test.ts`
Expected: PASS (9 tests). If the fan test's expected values don't match (pivot geometry is easy to get a sign wrong on), print the actual value and adjust the test's expected number to match the documented formula — do not change the formula to match a guessed test value; re-derive from `FAN_ANCHOR_CONFIG.bottom = { from: 270, px: 0.5, py: 1 }` by hand first.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/gradient.ts src/lib/stopAnchor.ts src/lib/stopAnchor.test.ts
git commit -m "feat: stopAnchor - per-geometry canvas anchor for each color stop"
```

---

### Task 2: `canvasReorder` — pixel-space nearest-anchor helpers, and export `moveItem`

**Files:**
- Modify: `src/hooks/useDragReorder.ts:12` (add `export`)
- Create: `src/lib/canvasReorder.ts`
- Test: `src/lib/canvasReorder.test.ts`

**Context:** `src/hooks/useDragReorder.ts` has `function moveItem<T>(list: T[], from: number, to: number): T[]` at line 12, currently unexported.

- [ ] **Step 1: Export `moveItem`**

In `src/hooks/useDragReorder.ts`, change:
```ts
function moveItem<T>(list: T[], from: number, to: number): T[] {
```
to:
```ts
export function moveItem<T>(list: T[], from: number, to: number): T[] {
```

- [ ] **Step 2: Run existing hook tests to confirm no regression**

Run: `npm test -- src/hooks/useDragReorder.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing test**

```ts
// src/lib/canvasReorder.test.ts
import { describe, it, expect } from 'vitest'
import { nearestAnchorIndex, anchorWithinThreshold } from './canvasReorder'

const anchors = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

describe('nearestAnchorIndex', () => {
  it('returns the index of the closest anchor to the cursor', () => {
    expect(nearestAnchorIndex(anchors, { x: 5, y: 5 })).toBe(0)
    expect(nearestAnchorIndex(anchors, { x: 90, y: 5 })).toBe(1)
    expect(nearestAnchorIndex(anchors, { x: 95, y: 95 })).toBe(2)
  })

  it('picks the nearest even when the cursor is far from every anchor', () => {
    expect(nearestAnchorIndex(anchors, { x: 1000, y: 1000 })).toBe(2)
  })
})

describe('anchorWithinThreshold', () => {
  it('returns the nearest index when within the pixel threshold', () => {
    expect(anchorWithinThreshold(anchors, { x: 10, y: 0 }, 24)).toBe(0)
  })

  it('returns null when the nearest anchor exceeds the threshold', () => {
    expect(anchorWithinThreshold(anchors, { x: 50, y: 50 }, 24)).toBeNull()
  })

  it('returns null for an empty anchor list', () => {
    expect(anchorWithinThreshold([], { x: 0, y: 0 }, 24)).toBeNull()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/lib/canvasReorder.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 5: Implement `src/lib/canvasReorder.ts`**

```ts
export interface PixelPoint {
  x: number
  y: number
}

function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Index of the anchor closest to `cursor`, in pixel space. Anchors list must
 * be non-empty. */
export function nearestAnchorIndex(anchors: PixelPoint[], cursor: PixelPoint): number {
  let best = 0
  let bestDist = Infinity
  anchors.forEach((a, i) => {
    const d = distance(a, cursor)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })
  return best
}

/** Index of the nearest anchor within `thresholdPx` of the cursor, or null if
 * none are that close (or the list is empty). Used for proximity reveal. */
export function anchorWithinThreshold(
  anchors: PixelPoint[],
  cursor: PixelPoint,
  thresholdPx: number,
): number | null {
  if (anchors.length === 0) return null
  const i = nearestAnchorIndex(anchors, cursor)
  return distance(anchors[i], cursor) <= thresholdPx ? i : null
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/lib/canvasReorder.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useDragReorder.ts src/lib/canvasReorder.ts src/lib/canvasReorder.test.ts
git commit -m "feat: canvasReorder - pixel-space nearest-anchor helpers, export moveItem"
```

---

### Task 3: `CanvasHandles` — proximity-revealed drag-to-reorder overlay

**Files:**
- Create: `src/components/CanvasHandles.tsx`
- Create: `src/components/CanvasHandles.module.css`
- Test: `src/components/CanvasHandles.test.tsx`

**Context:** Fully prop-driven — no DOM measurement inside this component. `cursor` and `size` (both pixel-space, relative to the canvas) are supplied by the parent (`EditMode`, wired in Task 4), which owns `getBoundingClientRect`. This keeps the component trivially testable with plain numbers. `EditableStop = { id: string; hex: string; position: number }` from `../lib/stopOrdering`. `isLightColor(hex): boolean` from `../lib/oklch` picks a legible ring color per dot, matching `BlockStack`'s contrast pattern.

Reveal threshold is **24px**. Drag uses native Pointer Events with `setPointerCapture` so a drag continues even if the cursor leaves the small dot hit-target; `stopPropagation` on a dot's `pointerdown` prevents it from also triggering `EditMode`'s pull-to-edit gesture on `.preview`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CanvasHandles.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CanvasHandles } from './CanvasHandles'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

const size = { width: 200, height: 200 }

describe('CanvasHandles proximity reveal', () => {
  it('reveals no dot when the cursor is null', () => {
    render(<CanvasHandles stops={stops} type="linear" cursor={null} size={size} onReorder={vi.fn()} />)
    expect(screen.queryAllByTestId('canvas-handle-visible')).toHaveLength(0)
  })

  it('reveals only the nearest dot within 24px, hides the rest', () => {
    // linear anchors at (100,0), (100,100), (100,200) for a 200x200 canvas.
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 95 }} size={size} onReorder={vi.fn()} />)
    const visible = screen.getAllByTestId('canvas-handle-visible')
    expect(visible).toHaveLength(1)
    expect(visible[0].getAttribute('data-stop-id')).toBe('b')
  })

  it('reveals nothing when the cursor is farther than 24px from every dot', () => {
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 0, y: 0 }} size={size} onReorder={vi.fn()} />)
    expect(screen.queryAllByTestId('canvas-handle-visible')).toHaveLength(0)
  })
})

describe('CanvasHandles drag-to-reorder', () => {
  it('reorders live as the cursor moves toward another slot, and stays reordered on pointer up', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 100, clientY: 200 })
    expect(onReorder).toHaveBeenCalledWith([
      { id: 'b', hex: '#00ff00', position: 50 },
      { id: 'c', hex: '#0000ff', position: 100 },
      { id: 'a', hex: '#ff0000', position: 0 },
    ])
    fireEvent.pointerUp(dot, { pointerId: 1, clientX: 100, clientY: 200 })
    // No further reorder call on release (already-live commit).
    expect(onReorder).toHaveBeenCalledTimes(1)
  })

  it('does not call onReorder when the cursor stays over the same slot', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 100, clientY: 2 })
    expect(onReorder).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/CanvasHandles.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/components/CanvasHandles.tsx`**

```tsx
import { useState } from 'react'
import type { GradientType } from '../lib/gradient'
import type { EditableStop } from '../lib/stopOrdering'
import { stopAnchor, type StopAnchorOpts } from '../lib/stopAnchor'
import { anchorWithinThreshold, nearestAnchorIndex, type PixelPoint } from '../lib/canvasReorder'
import { moveItem } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import styles from './CanvasHandles.module.css'

const REVEAL_THRESHOLD_PX = 24

interface CanvasHandlesProps {
  stops: EditableStop[]
  type: GradientType
  spoke?: StopAnchorOpts['spoke']
  corner?: StopAnchorOpts['corner']
  fanAnchor?: StopAnchorOpts['fanAnchor']
  /** Cursor position in pixels relative to the canvas, or null when the
   * pointer is outside/absent. Measured by the parent. */
  cursor: PixelPoint | null
  /** Canvas pixel size, for converting normalized anchors to pixel space. */
  size: { width: number; height: number }
  onReorder: (next: EditableStop[]) => void
}

export function CanvasHandles({
  stops,
  type,
  spoke,
  corner,
  fanAnchor,
  cursor,
  size,
  onReorder,
}: CanvasHandlesProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const positions = stops.map((s) => s.position)
  const pixelAnchors: PixelPoint[] = stops.map((_, i) => {
    const a = stopAnchor(type, positions, i, { spoke, corner, fanAnchor })
    return { x: a.x * size.width, y: a.y * size.height }
  })

  const hoveredIndex =
    cursor && !draggingId ? anchorWithinThreshold(pixelAnchors, cursor, REVEAL_THRESHOLD_PX) : null

  function handlePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(id)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingId) return
    e.stopPropagation()
    const cursorPx = { x: e.clientX, y: e.clientY }
    // clientX/Y are viewport-relative; tests drive this directly with the
    // same coordinate space as `cursor`/`size` (canvas-relative), which is
    // valid because CanvasHandles never reads DOM position itself — the
    // parent is responsible for keeping clientX/Y and `cursor` consistent.
    const currentIndex = stops.findIndex((s) => s.id === draggingId)
    if (currentIndex === -1) return
    const targetIndex = nearestAnchorIndex(pixelAnchors, cursorPx)
    if (targetIndex !== currentIndex) {
      onReorder(moveItem(stops, currentIndex, targetIndex))
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.stopPropagation()
    setDraggingId(null)
  }

  return (
    <div className={styles.overlay} data-testid="canvas-handles">
      {stops.map((stop, i) => {
        const revealed = draggingId === stop.id || hoveredIndex === i
        const light = isLightColor(stop.hex)
        return (
          <button
            key={stop.id}
            type="button"
            aria-label={`Reorder ${stop.hex}`}
            data-testid={`canvas-handle-${stop.id}`}
            data-stop-id={stop.id}
            className={[styles.dot, revealed && styles.dotVisible, light ? styles.dotOnLight : styles.dotOnDark]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${pixelAnchors[i].x}px`, top: `${pixelAnchors[i].y}px` }}
            onPointerDown={(e) => handlePointerDown(e, stop.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {revealed && <span data-testid="canvas-handle-visible" className={styles.dotInner} />}
          </button>
        )
      })}
    </div>
  )
}
```

Note: the test drives `pointerMove`/`pointerDown` with `clientX`/`clientY` matching the same numeric space as the `cursor`/`size` props (both are plain canvas-relative pixels in the test, with no real layout involved) — that's why the component reads `e.clientX`/`e.clientY` directly during a drag rather than re-deriving `cursor` from props: it needs the freshest pointer position on every move, and in jsdom there is no real box to re-measure against, so this keeps the component self-contained and testable without mocking `getBoundingClientRect`.

- [ ] **Step 4: Create `src/components/CanvasHandles.module.css`**

```css
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.dot {
  position: absolute;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot:active {
  cursor: grabbing;
}

.dotInner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 120ms ease, transform 120ms ease;
  transform: scale(0.6);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.dotVisible .dotInner {
  opacity: 1;
  transform: scale(1);
}

.dotOnLight .dotInner {
  background: #111;
  border: 2px solid rgba(255, 255, 255, 0.8);
}

.dotOnDark .dotInner {
  background: #fff;
  border: 2px solid rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/CanvasHandles.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/CanvasHandles.tsx src/components/CanvasHandles.module.css src/components/CanvasHandles.test.tsx
git commit -m "feat: CanvasHandles - proximity-revealed drag-to-reorder overlay"
```

---

### Task 4: Wire `CanvasHandles` into `EditMode`, add the radial/square direction toggle

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/EditMode.module.css`
- Test: `src/components/EditMode.test.tsx`

**Context:** `EditMode.tsx` renders the canvas as `<div data-testid="edit-mode-preview" ref={previewRef} className={styles.preview} ... onPointerDown={handlePreviewPointerDown} onPointerUp={handlePreviewPointerUp}>` (around line 611). `.preview` is `position: relative; overflow: hidden`, so an absolutely-positioned child fills it correctly. `commit(nextStops: EditableStop[])` (around line 437) is the existing reorder/position commit — it re-equalizes positions and calls `setCurrentGradient`. `editableStops` state and `gradient` (the current `Gradient`, with `.type` and `.fanAnchor`) are already in scope. Do NOT rename or restructure `handlePreviewPointerDown`/`handlePreviewPointerUp` — `CanvasHandles`' own `stopPropagation` on its dots is what keeps a handle-drag from also triggering pull-to-edit; a plain tap/drag elsewhere on the canvas must keep working exactly as before.

`src/components/EditMode.test.tsx` already defines a module-level fixture named `gradient` (a 3-stop linear `Gradient` with distinct hexes `#ff0000`/`#00ff00`/`#0000ff`) and renders with `<EditMode gradient={gradient} onExit={vi.fn()} />` — `onImport` is optional (defaults to a no-op) and is omitted in existing tests. Reuse this `gradient` fixture and this render call shape; do not introduce a `linearGradient` name or pass `onImport`.

**Important:** re-tapping the active `GeometryTabs` tab already triggers `onToggleReversed()` (or `onRotateFan()` for fan) — do NOT repurpose that gesture for radial/square direction. Add a small, separate, dedicated toggle instead, so existing reverse-on-retap behavior for radial/square is untouched.

- [ ] **Step 1: Write the failing test**

Append to `src/components/EditMode.test.tsx`:

```tsx
describe('EditMode canvas handles', () => {
  it('mounts CanvasHandles over the preview canvas', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('canvas-handles')).toBeInTheDocument()
  })

  it('shows the direction toggle for radial, not for linear', () => {
    const { rerender } = render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.queryByTestId('direction-toggle')).not.toBeInTheDocument()
    rerender(<EditMode gradient={{ ...gradient, type: 'radial' }} onExit={vi.fn()} />)
    expect(screen.getByTestId('direction-toggle')).toBeInTheDocument()
  })

  it('reordering via a canvas handle updates the live gradient stop order', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const preview = screen.getByTestId('edit-mode-preview')
    // Give the preview a real layout box so getBoundingClientRect-derived
    // cursor/size math is well-defined in jsdom.
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, toJSON() {},
    } as DOMRect)
    fireEvent.pointerMove(preview, { clientX: 100, clientY: 0 })
    const firstHandle = screen.getAllByTestId(/^canvas-handle-(?!visible)/)[0]
    fireEvent.pointerDown(firstHandle, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(firstHandle, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(firstHandle, { pointerId: 1, clientX: 100, clientY: 200 })
    // The originally-first stop's hex should no longer be at position 0.
    const stops = useAppStore.getState().current!.stops
    expect(stops[0].hex).not.toBe(gradient.stops[0].hex)
  })
})
```

This appends to the existing `describe('EditMode', ...)` test file as a sibling top-level `describe` block; `gradient`, `useAppStore`, `render`, `screen`, `fireEvent`, and `vi` are already imported/defined at the top of the file exactly as shown above — no new imports needed for this test block itself (Step 3 below adds the two new source imports to `EditMode.tsx`, not the test file).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/EditMode.test.tsx`
Expected: FAIL — `canvas-handles` testid not found.

- [ ] **Step 3: Add imports and state to `EditMode.tsx`**

Near the other component imports (with `FlowEditor`, `GeometryTabs`, etc.):
```tsx
import { CanvasHandles } from './CanvasHandles'
import type { SpokeDir, SquareCorner } from '../lib/stopAnchor'
```

Near the other `useState` declarations (with `editableStops`, `activeStopId`):
```tsx
  const [spoke, setSpoke] = useState<SpokeDir>('up')
  const [corner, setCorner] = useState<SquareCorner>('tl')
  const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
```

- [ ] **Step 4: Add pointer-move/leave handlers that measure the canvas**

Near `handlePreviewPointerDown`/`handlePreviewPointerUp` (around line 564):
```tsx
  function handlePreviewPointerMove(e: React.PointerEvent) {
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    setCanvasSize({ width: rect.width, height: rect.height })
    setCanvasCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handlePreviewPointerLeave() {
    setCanvasCursor(null)
  }
```

- [ ] **Step 5: Mount `CanvasHandles` and wire the pointer handlers**

In the `.preview` div's JSX (around line 611), add the two new handlers alongside the existing ones:
```tsx
        onPointerDown={handlePreviewPointerDown}
        onPointerUp={handlePreviewPointerUp}
        onPointerMove={handlePreviewPointerMove}
        onPointerLeave={handlePreviewPointerLeave}
```

Immediately after the closing `</div>` of the `LikeButton`/other preview children but still inside the `.preview` div (i.e., as the last child before `.preview`'s own closing tag), add:
```tsx
        <CanvasHandles
          stops={editableStops}
          type={gradient.type}
          spoke={spoke}
          corner={corner}
          fanAnchor={gradient.fanAnchor}
          cursor={canvasCursor}
          size={canvasSize}
          onReorder={(next) => commit(next)}
        />
```

- [ ] **Step 6: Add the radial/square direction toggle**

In `.blockArea` or immediately above it (near the `FlowEditor`, around line 687), add, gated to radial/square only:
```tsx
        {(gradient.type === 'radial' || gradient.type === 'square') && (
          <div data-testid="direction-toggle" className={styles.directionToggle}>
            {gradient.type === 'radial'
              ? (['up', 'down', 'left', 'right'] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    aria-pressed={spoke === dir}
                    className={spoke === dir ? styles.directionBtnActive : styles.directionBtn}
                    onClick={() => setSpoke(dir)}
                  >
                    {dir === 'up' ? '↑' : dir === 'down' ? '↓' : dir === 'left' ? '←' : '→'}
                  </button>
                ))
              : (['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={corner === c}
                    className={corner === c ? styles.directionBtnActive : styles.directionBtn}
                    onClick={() => setCorner(c)}
                  >
                    {c === 'tl' ? '↖' : c === 'tr' ? '↗' : c === 'bl' ? '↙' : '↘'}
                  </button>
                ))}
          </div>
        )}
```

- [ ] **Step 7: Add direction toggle styles**

Append to `src/components/EditMode.module.css`:
```css
.directionToggle {
  display: flex;
  gap: 6px;
  padding: 0 var(--space-xs) 8px;
}

.directionBtn,
.directionBtnActive {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  background: transparent;
  font-size: 14px;
  cursor: pointer;
}

.directionBtnActive {
  background: rgba(128, 128, 128, 0.18);
  border-color: rgba(128, 128, 128, 0.5);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/components/EditMode.test.tsx`
Expected: PASS, including the 3 new tests. If the reorder-integration test's `getBoundingClientRect` mock doesn't satisfy TypeScript's `DOMRect` shape, add the missing fields (`x`, `y`, `toJSON`) rather than casting away the type error.

- [ ] **Step 9: Full suite + typecheck + build**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: all pass, build clean.

- [ ] **Step 10: Browser verification**

Start the preview (`preview_start {name:"dev"}`). Open the app, enter edit mode on a gradient with 3+ stops. Move the mouse near a color's expected anchor point on the canvas (for a linear gradient, straight down the vertical center at each stop's position) and confirm a small dot fades in only within about 24px, and fades out when the cursor moves away. Drag a dot toward another stop's position and confirm the gradient visibly reorders live, with the `FlowEditor` below reflecting the same new order. Switch to Radial and confirm the 4-way `↑↓←→` toggle appears and moves the handle dots without changing the rendered gradient. Switch to Square and confirm the corner toggle. Screenshot at least one drag-in-progress state.

- [ ] **Step 11: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/components/EditMode.test.tsx
git commit -m "feat: wire CanvasHandles into EditMode with radial/square direction toggle"
```

---

## Self-Review

**Spec coverage:**
- `stopAnchor` per-geometry table (linear/radial/square/angular/fan/mirror) → Task 1. ✓
- Radial 4-way spoke / square 4-corner, cosmetic/local UI state → Task 1 (anchor math) + Task 4 (state + toggle UI). ✓
- Proximity reveal at 24px → Task 3 (`anchorWithinThreshold`) + `CanvasHandles`. ✓
- Figma-style insert-and-reflow drag with snap + live preview → Task 3 (drag handlers + `moveItem`) wired to `commit()` in Task 4. ✓
- `FlowEditor` untouched, remains for position tuning → not modified in any task. ✓
- Reuses `useDragReorder`'s `moveItem` → Task 2. ✓
- Out-of-scope items (repositioning, recolor/add/delete on canvas, gradient rotation) → none implemented. ✓

**Placeholder scan:** none — every step has real code, exact file locations, and runnable commands.

**Type consistency:** `stopAnchor(type, positions, index, opts)` and its `StopAnchorOpts`/`SpokeDir`/`SquareCorner` are defined once in Task 1 and imported unchanged in Tasks 3–4. `CanvasHandlesProps` (`stops`, `type`, `spoke`, `corner`, `fanAnchor`, `cursor`, `size`, `onReorder`) matches exactly between Task 3's implementation and Task 4's call site. `nearestAnchorIndex`/`anchorWithinThreshold` signatures match between Task 2 and their use in Task 3.

**Note on `CanvasHandles`' coordinate handling:** the component reads `e.clientX`/`e.clientY` directly during an active drag (not the `cursor` prop) so it always has the freshest pointer position without depending on the parent re-rendering with a new `cursor` prop first; the `cursor` prop is only used for pre-drag proximity reveal. Task 3's tests and Task 4's wiring both keep `clientX`/`clientY` and `cursor`/`size` in the same coordinate space (canvas-relative pixels), which is what makes this consistent.
