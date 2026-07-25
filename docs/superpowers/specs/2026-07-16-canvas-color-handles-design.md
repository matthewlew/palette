# Canvas Color Handles — Proximity-Revealed Drag-to-Reorder Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan
**Scope:** Edit mode. Adds direct-manipulation color reordering on the gradient canvas.

## Background & goal

With the desktop swatch picker removed, editing lives entirely in the bottom
"linear controller" (`FlowEditor`). This adds a more minimal, direct way to
reorder colors: drag them on the blurred canvas itself.

In edit mode, each stop gets a **handle dot at the center of its color volume**
on the canvas. Dragging a dot reorders the stops **Figma-style** (insert-and-
reflow, snap to the nearest slot, draggable back, live gradient update). The dots
are **proximity-revealed** — a dot only appears when the cursor is within 24px of
it, so at rest the gradient is uninterrupted by handle UI. The `FlowEditor` stays
for fine **position** tuning; the canvas handles do **reorder** only.

## Anchor rules — `stopAnchor` (pure)

New pure function `src/lib/stopAnchor.ts`:

```ts
type SpokeDir = 'up' | 'down' | 'left' | 'right'
type SquareCorner = 'tl' | 'tr' | 'bl' | 'br'

interface AnchorOpts {
  spoke?: SpokeDir       // radial
  corner?: SquareCorner  // square
  fanAnchor?: FanAnchor  // fan (from lib/gradient)
}

// Normalized canvas coords {x, y} in 0..1 for a stop's "center of color volume".
function stopAnchor(
  type: GradientType,
  positions: number[], // each stop's position 0..100, in stop order
  index: number,
  opts?: AnchorOpts,
): { x: number; y: number }
```

`p = positions[index] / 100`. Per geometry:

| Geometry | Anchor |
|---|---|
| linear | `(0.5, p)` — down the axis |
| radial | along the chosen spoke from center: up `(0.5, 0.5 − 0.5p)`, down `(0.5, 0.5 + 0.5p)`, left `(0.5 − 0.5p, 0.5)`, right `(0.5 + 0.5p, 0.5)` (default up) |
| square | center → chosen corner along the diagonal, e.g. tl `(0.5 − 0.5p, 0.5 − 0.5p)` (default tl) |
| angular | conic at mid-radius `R=0.32`: angle `θ = 360·p` from top → `(0.5 + R·sinθ, 0.5 − R·cosθ)` |
| fan | from the fan pivot (`FAN_ANCHOR_CONFIG[fanAnchor]`), mid-radius `R=0.35`, angle sweeping the 180° cone by `p` |
| mirror | top half of the axis: `(0.5, 0.5·p)` |

Rings and sectors have no single center, so radial/square/angular pick a canonical
spoke/mid-radius — an intentional approximation. Because radial and square are
symmetric, the spoke/corner choice is **cosmetic** (it does not change the gradient
output), which is why it can be freely reconfigured.

## Direction control (radial + square)

- A **4-way direction toggle** (up/down/left/right for radial; the four corners for
  square) appears alongside the handles while editing a radial or square gradient.
- It sets **local UI state** in `EditMode` (`spoke` / `corner`), NOT a gradient
  property — the gradient is symmetric, so this only relocates the handles.
- Reuses the existing fan-anchor selector's visual pattern for consistency.
- Linear, angular, fan, and mirror have fixed anchors and show no direction toggle.

## `CanvasHandles` overlay

New component `src/components/CanvasHandles.tsx`, absolutely positioned over the
edit canvas (fills it, `pointer-events` only on active regions):

- **Inputs:** `stops: EditableStop[]`, `type`, `spoke`/`corner`, `fanAnchor`,
  `onReorder(next: EditableStop[])`, and the canvas size (via a ref/ResizeObserver).
- **Proximity reveal:** on pointer move, compute each stop's anchor pixel
  (`stopAnchor` × canvas size). A dot renders only when the cursor is within
  **24px** of its anchor (the nearest one wins if two overlap). No cursor nearby →
  no dots.
- **Drag-to-reorder (Figma-style):** pointer-down within 24px of a dot starts a
  drag. While dragging, project the cursor onto the ordered anchor sequence to find
  the **target slot**; reorder with **insert-and-reflow** (the dragged stop moves to
  that slot, others shift), snapping the preview to slot anchors. Live-updates via
  `onReorder` so the canvas re-renders instantly. Releasing commits; dragging back
  before release restores. Reuses the array-move logic from `useDragReorder`
  (`moveItem`) for the reorder itself; the 2D→slot projection is new.
- **Minimum 2 stops**; with 2, reorder is a straight swap.

## EditMode wiring

- Mount `<CanvasHandles>` over the canvas in `EditMode`, fed by the existing
  `editableStops` and a new `onReorder` that calls `setEditableStops` — the same
  state the `FlowEditor` reads, so canvas and controller stay in sync.
- Add local `spoke` / `corner` state + the 4-way toggle (shown only for
  radial/square).
- `FlowEditor` is unchanged and remains the tool for fine **position** editing.
- Live preview is automatic: reordering `editableStops` re-renders the canvas.

## Data flow

`EditMode` owns `editableStops` → `CanvasHandles` reads them + computes anchors →
drag reorders → `onReorder(next)` → `setEditableStops` → canvas + `FlowEditor` both
reflect the new order.

## Testing

- `stopAnchor.test.ts`: each geometry returns the expected coords for sample
  positions; radial honors all four spokes; square honors corners; endpoints
  (`p=0`, `p=1`) land where expected.
- Reorder projection: cursor near slot k targets index k; insert-and-reflow
  produces the right array (reuse/verify `moveItem`).
- Proximity reveal: a dot is hidden when the cursor is >24px from every anchor and
  shown when within 24px; nearest anchor wins when two are within range.
- EditMode integration: dragging a handle reorders `editableStops` and the
  controller reflects it; the direction toggle only renders for radial/square.

## Out of scope

- Repositioning (changing a stop's 0–100 position) on the canvas — stays in the
  `FlowEditor`.
- Recoloring / adding / deleting stops on the canvas — unchanged (tap-to-recolor,
  Add color, drag-down-to-remove remain in the controller).
- Non-symmetric per-geometry anchor perfection (rings/sectors stay approximations).
- Touch-specific hover affordance beyond pointer proximity (pointer events cover
  touch drag; the 24px reveal is a mouse/hover nicety — on touch the dot appears on
  touchstart within range).

## Build order

1. `stopAnchor.ts` + tests (all geometries, directions).
2. `CanvasHandles.tsx` — proximity reveal + drag-to-reorder + tests.
3. EditMode wiring: mount overlay, `onReorder`, `spoke`/`corner` state.
4. 4-way direction toggle for radial/square.
