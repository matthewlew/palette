# Full Palette + UX Improvements — Design Spec

Date: 2026-07-07
Status: Approved for planning

This spec covers seven features. Each has its own section with exact files to touch, exact behavior, and acceptance criteria. Implement them in the order listed. Do not change anything not listed. All new logic must have unit tests (Vitest, same patterns as existing `*.test.ts` / `*.test.tsx` files).

Existing key files:
- Color model: `src/lib/oklch.ts` (has `Oklch {l,c,h}`, `hexToOklch`, `oklchToHex`)
- Default colors: `src/lib/colorSets.ts`
- Generator: `src/lib/palette.ts`
- Stop editing helpers: `src/lib/stopOrdering.ts` (`EditableStop {id, hex}`)
- State: `src/store/useAppStore.ts` (zustand; `mode: 'explore' | 'edit'`, `current`, `saved`)
- Views: `src/App.tsx`, `src/components/Feed.tsx`, `src/components/EditMode.tsx`
- Global CSS: `src/index.css`

---

## Feature 1: Complete the default color set (add yellows and other missing hues)

**Problem:** `DEFAULT_COLOR_SET` in `src/lib/colorSets.ts` has no yellows, oranges, pinks, purples, or teals. Generated palettes never contain those hues.

**Change:** In `src/lib/colorSets.ts`, add the following 24 entries to `DEFAULT_COLOR_SET.colors`, appended after the existing `// Darks` group, each group with its comment exactly as shown:

```ts
// Yellows
{ name: 'Ochre', value: { l: 0.62, c: 0.11, h: 85 } },
{ name: 'Mustard', value: { l: 0.68, c: 0.13, h: 95 } },
{ name: 'Marigold', value: { l: 0.75, c: 0.15, h: 88 } },
{ name: 'Butter', value: { l: 0.88, c: 0.08, h: 95 } },
{ name: 'Straw', value: { l: 0.82, c: 0.09, h: 100 } },
{ name: 'Honey', value: { l: 0.7, c: 0.12, h: 78 } },
// Oranges
{ name: 'Apricot', value: { l: 0.78, c: 0.1, h: 60 } },
{ name: 'Amber', value: { l: 0.68, c: 0.14, h: 65 } },
{ name: 'Persimmon', value: { l: 0.6, c: 0.16, h: 45 } },
{ name: 'Tangerine', value: { l: 0.7, c: 0.17, h: 55 } },
// Pinks
{ name: 'Dusty Rose', value: { l: 0.68, c: 0.07, h: 10 } },
{ name: 'Blush', value: { l: 0.82, c: 0.05, h: 15 } },
{ name: 'Raspberry', value: { l: 0.5, c: 0.14, h: 5 } },
{ name: 'Fuchsia', value: { l: 0.6, c: 0.18, h: 345 } },
// Purples
{ name: 'Mauve', value: { l: 0.65, c: 0.06, h: 320 } },
{ name: 'Plum', value: { l: 0.4, c: 0.1, h: 330 } },
{ name: 'Violet', value: { l: 0.5, c: 0.15, h: 295 } },
{ name: 'Lilac', value: { l: 0.78, c: 0.07, h: 300 } },
// Teals
{ name: 'Teal', value: { l: 0.55, c: 0.09, h: 190 } },
{ name: 'Lagoon', value: { l: 0.65, c: 0.1, h: 200 } },
{ name: 'Verdigris', value: { l: 0.6, c: 0.07, h: 175 } },
{ name: 'Glacier', value: { l: 0.85, c: 0.04, h: 210 } },
// Bright accents
{ name: 'Poppy', value: { l: 0.55, c: 0.19, h: 25 } },
{ name: 'Grass', value: { l: 0.6, c: 0.15, h: 135 } },
```

**Do not** remove or edit any existing color. Do not change `src/lib/palette.ts`.

**Future work (do NOT build now):** color-space filter (sRGB/P3/CMYK/Pantone preview) and user-supplied hex sets. Only mention: the `ColorSet` interface already supports multiple sets.

**Acceptance criteria:**
- `DEFAULT_COLOR_SET.colors.length === 60`.
- Test in `src/lib/colorSets.test.ts`: every color's `oklchToHex(value)` round-trips within sRGB, i.e. `hexToOklch(oklchToHex(v))` has l within ±0.02 and c within ±0.02 of the original (proves no gamut clipping). Skip hue comparison — it is numerically unstable for near-neutral colors.
- Test: at least one color exists in each of these hue ranges: [75,105] (yellow), [40,70] (orange), [340,20 wrap] (pink), [290,335] (purple), [170,215] (teal).

---

## Feature 2: Explore ↔ Edit expand/collapse transition

**Problem:** `src/App.tsx` swaps `<Feed/>` for `<EditMode/>` instantly.

**Change:** Use the **View Transitions API** (`document.startViewTransition`) — simplest reliable approach; no library.

Exact steps:
1. In `src/store/useAppStore.ts`, do NOT change store logic.
2. Create `src/lib/viewTransition.ts`:
   ```ts
   export function withViewTransition(update: () => void): void {
     if (typeof document !== 'undefined' && 'startViewTransition' in document
         && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
       ;(document as any).startViewTransition(update)
     } else {
       update()
     }
   }
   ```
3. Everywhere `enterEditMode()` / `exitEditMode()` is called from a component (search for callers), wrap the call: `withViewTransition(() => enterEditMode())`.
4. In `src/components/Feed.module.css`, give the currently-visible palette card `view-transition-name: palette-card;` (add a class applied only to the active/tapped card — one element per page may have this name).
5. In `src/components/EditMode.module.css`, give the edit-mode root container `view-transition-name: palette-card;`.
6. In `src/index.css` add:
   ```css
   ::view-transition-old(palette-card),
   ::view-transition-new(palette-card) {
     animation-duration: 300ms;
     animation-timing-function: ease-out;
   }
   ```

**Acceptance criteria:**
- Entering and exiting edit mode animates the palette expanding/collapsing (verify in browser preview; screenshot before/after).
- With `prefers-reduced-motion: reduce`, mode switches instantly (unit test `viewTransition.test.ts`: mock `matchMedia` to reduce → `startViewTransition` not called; mock no support → `update` still called).
- All existing tests still pass.

---

## Feature 3: OKLCH sort (edit-mode stops + feed)

**New pure helper** in `src/lib/sortColors.ts`:

```ts
import { hexToOklch } from './oklch'

export type SortKey = 'lightness' | 'hue' | 'chroma'

/** Stable ascending sort of any items carrying a hex color. */
export function sortByOklch<T>(items: T[], getHex: (item: T) => string, key: SortKey): T[] {
  const metric = (hex: string) => {
    const c = hexToOklch(hex)
    return key === 'lightness' ? c.l : key === 'hue' ? c.h : c.c
  }
  return [...items].sort((a, b) => metric(getHex(a)) - metric(getHex(b)))
}

/** Average metric across a gradient's stops, used to sort the feed. */
export function gradientMetric(hexes: string[], key: SortKey): number {
  if (hexes.length === 0) return 0
  const vals = hexes.map((h) => {
    const c = hexToOklch(h)
    return key === 'lightness' ? c.l : key === 'hue' ? c.h : c.c
  })
  return vals.reduce((s, v) => s + v, 0) / vals.length
}
```

**Edit mode UI:** In `src/components/EditMode.tsx`, add a row of three small text buttons labeled `L`, `H`, `C` (aria-labels: "Sort by lightness", "Sort by hue", "Sort by chroma"). Tapping one replaces the current editable stops with `sortByOklch(stops, s => s.hex, key)` then re-runs the existing position logic (`equalizePositions`). Style to match existing EditMode buttons (copy an existing button class in `EditMode.module.css`).

**Feed / drawer UI:** In `src/components/Drawer.tsx` (the saved palettes list), add a select (native `<select>`) with options: `Newest` (default, current order), `Lightness`, `Hue`, `Chroma`. When not Newest, display `[...saved].sort((a,b) => gradientMetric(stopsA hexes, key) - gradientMetric(stopsB hexes, key))`. Sorting is view-only — never mutate `saved` in the store.

**Acceptance criteria:**
- `sortColors.test.ts`: sorts 3 known hexes correctly by each key; stable for equal metrics; `gradientMetric` averages correctly; empty array → 0.
- EditMode test: tapping "Sort by lightness" reorders stops darkest→lightest.
- Drawer test: selecting "Hue" reorders displayed items without changing store order.

---

## Feature 4: Micro-instruction hints

Three one-time hints, persisted in `localStorage` so each shows only once ever.

**New hook** `src/hooks/useHint.ts`:
```ts
export function useHint(key: string): { visible: boolean; dismiss: () => void }
```
- Storage key: `palette-hint-<key>`. Visible if the key is absent from localStorage. `dismiss()` sets the key to `'1'` and hides it. Guard all localStorage access in try/catch (private mode).

**New component** `src/components/Hint.tsx` + `Hint.module.css`: a small pill, fixed-position, bottom-center (`bottom: 96px`), background `rgba(0,0,0,0.65)`, white text, `font-size: 13px`, `border-radius: 999px`, `padding: 8px 16px`, fades in/out with a 200ms opacity transition, `pointer-events: none`, `role="status"`.

**Placement:**
1. `Feed.tsx`: hint key `scroll`, text `"Scroll to explore palettes ↓"`. Dismiss on the first scroll/advance gesture the feed already handles.
2. `Feed.tsx`: hint key `like`, text `"Double-tap to like"`. Show only after `scroll` is dismissed; dismiss on first double-tap (hook into existing `useDoubleTap` call site).
3. `EditMode.tsx`: hint key `edit`, text `"Tap a swatch to edit"`. Show when edit mode mounts; dismiss on any pointerdown inside edit mode, or automatically after 4 seconds.

**Acceptance criteria:**
- `useHint.test.tsx`: visible when key absent; hidden after dismiss; hidden on remount after dismiss; no crash when localStorage throws.
- Hints never reappear after dismissal (manual preview check).

---

## Feature 5: Full-width on desktop

**Problem:** `#root` in `src/index.css` is `width: 1126px; margin: 0 auto; border-inline: 1px solid var(--border);`.

**Change:** In `src/index.css`, replace those three declarations on `#root` with `width: 100%;` (keep `max-width: 100%`, remove `border-inline`, keep everything else). No component changes. This is temporary until a real desktop layout exists.

**Acceptance criteria:** At 1440px viewport width the app fills the full width with no side borders (preview screenshot); mobile (≤768px) unchanged.

---

## Feature 6: Fix scroll-triggers-tap + momentum scrubbing (iOS feel)

Two related problems in the feed:

### 6a. Scrolling must not trigger tap-to-edit

**Problem:** `src/components/GradientPage.tsx` calls `useDoubleTap(handleDoubleTap, onEdit)` from `onPointerUp` with no movement check. On iPhone Safari, lifting the finger at the end of a scroll fires `pointerup`, which registers as a single tap and opens edit mode.

**Change:** In `GradientPage.tsx`, add movement tracking:
1. Add `onPointerDown` handler on the same div: store `{x: e.clientX, y: e.clientY}` in a ref (`pointerStartRef`).
2. In the existing `onPointerUp` handler, before calling the `useDoubleTap` handler: compute distance from `pointerStartRef`. If distance > 10px (Euclidean), return early — it was a scroll/drag, not a tap. Otherwise call the existing handler.
3. Do not modify `useDoubleTap` itself.

**Acceptance criteria (test in `GradientPage.test.tsx`):**
- pointerdown at (100,100) → pointerup at (100,300) → `onEdit` is NOT called (even after the double-tap timeout).
- pointerdown at (100,100) → pointerup at (103,102) → single-tap behavior works as before (onEdit called after timeout).
- Double-tap with no movement still calls `onSave`.

### 6b. Momentum scrubbing — Apple Photos scrubber feel

**Problem:** In `src/components/Feed.tsx`, `preventDefault()` on touchmove kills native inertia, so only literal finger travel counts, at a fixed `STEP_PX = 80`. A fast flick produces ~3 palettes; users expect 12+ from a hard flick.

**Change:** In `Feed.tsx`:
1. Lower `STEP_PX` from `80` to `60`.
2. Track velocity during touchmove: keep `velocityRef = useRef(0)`. On each touchmove, compute `instantV = delta / (now - lastMoveTime)` (px/ms, use `performance.now()`; guard divide-by-zero with `dt < 1 → skip`), and smooth: `velocityRef.current = 0.8 * instantV + 0.2 * velocityRef.current`. Store `lastMoveTimeRef` alongside `lastTouchYRef`.
3. On `touchend`, if `Math.abs(velocityRef.current) > 0.3` (px/ms), start a momentum animation with `requestAnimationFrame`:
   - Each frame: `accumulatedDeltaRef.current += velocityRef.current * frameDt`; `velocityRef.current *= Math.pow(0.95, frameDt / 16.67)` (exponential decay normalized to 60fps); call `consumeAccumulatedDelta()`.
   - Stop when `Math.abs(velocityRef.current) < 0.05` or index hits 0 going backward.
   - Store the rAF id in a ref; cancel any running momentum on the next `touchstart` or `wheel`, and in the effect cleanup.
4. Haptics: `vibrateStep()` already fires per step via `goTo`. Keep it. (Note: iOS Safari ignores `navigator.vibrate`; this is best-effort, no further work.)
5. Keep wheel behavior unchanged (trackpads have native inertia already).

**Acceptance criteria:**
- Extract the momentum math into a pure helper `src/lib/momentum.ts`: `decayVelocity(v: number, frameDtMs: number): number` and `shouldStartMomentum(v: number): boolean`, unit-tested (decay halves roughly every ~230ms; 0.29 → no momentum; 0.31 → momentum).
- Feed test (jsdom, fake timers + mocked rAF): a simulated fast swipe (300px in 100ms) advances the index by ≥8 total after momentum settles; a slow drag (60px in 500ms) advances exactly 1 and starts no momentum.
- Manual iPhone check: fast flick spins through ~10+ palettes decelerating smoothly; scroll never opens edit mode; single tap still opens edit.

---

## Feature 7: Flow-mode edit view (gradient with draggable stop handles)

**Problem:** Edit mode currently shows discrete color blocks and equalizes stop positions (`equalizePositions` in `src/lib/stopOrdering.ts`). Wanted: the edit view is one continuous gradient with draggable handles on it — each handle IS a stop; dragging a handle changes that stop's actual `position`.

**Change:**

1. **Data:** extend `EditableStop` in `src/lib/stopOrdering.ts` to `{ id: string; hex: string; position: number }` (0–100). `toEditableStops` copies the real position from `GradientStop`. Add:
   ```ts
   export function moveStop(stops: EditableStop[], id: string, position: number): EditableStop[]
   // clamps position to [0,100], updates that stop, returns stops re-sorted by position (stable)
   export function toGradientStops(stops: EditableStop[]): GradientStop[]
   // maps {hex, position} straight through, sorted by position
   ```
   `equalizePositions` remains only as the fallback when ADDING a stop from the swatch tray: new stop is inserted at the midpoint of the largest positional gap (use existing `insertionIndex.ts` if it fits, otherwise compute largest gap directly). Update all `equalizePositions` call sites accordingly.

2. **New component** `src/components/FlowEditor.tsx` + `FlowEditor.module.css`, replacing the color-block stack (`BlockStack`) inside `EditMode.tsx`:
   - Renders the live gradient full-size (reuse `buildGradientCss` with the current editable stops — linear vertical for editing regardless of geometry type; geometry preview stays wherever it currently is).
   - One handle per stop, absolutely positioned along the gradient axis at `top: {position}%`. Handle visual: 28px circle filled with the stop's hex, 2px solid white border, `box-shadow: 0 1px 4px rgba(0,0,0,0.4)`, centered on a thin horizontal guide line.
   - Drag: pointer events with `setPointerCapture`. `position = clamp(((pointerY - rectTop) / rectHeight) * 100, 0, 100)`, call `moveStop` on every move (live gradient update).
   - Tap (movement < 6px between down/up) on a handle: opens the existing color-change UI for that stop (whatever BlockStack tap currently does — reuse the same callback).
   - Existing remove/add flows (swatch tray, etc.) keep working against the new `EditableStop` shape.
   - Accessibility: each handle is a `role="slider"` with `aria-valuemin=0 aria-valuemax=100 aria-valuenow={position}` and `aria-label="Stop {hex}"`; ArrowUp/ArrowDown move by 1 (Shift: 10).

3. **Sorting interplay (Feature 3):** the edit-mode L/H/C sort buttons now reassign positions: after sorting by the chosen key, distribute positions evenly (`equalizePositions` on the sorted order). Update Feature 3's edit-mode wording accordingly.

4. **Saving/exit:** on exit, `toGradientStops` produces the stops written back to the store — positions are preserved exactly (no equalize on exit). Check `EditMode.tsx` exit path and remove any equalize-on-exit behavior.

**Acceptance criteria:**
- `stopOrdering.test.ts`: `moveStop` clamps, reorders, is stable; `toGradientStops` round-trips positions; add-stop inserts in largest gap.
- `FlowEditor.test.tsx`: renders one slider per stop at correct `aria-valuenow`; pointer drag updates position; keyboard arrows adjust by 1/10; tap (no move) triggers the color-change callback; drag does not.
- Existing EditMode tests updated, all passing.
- Manual check: dragging a handle visibly shifts the gradient in real time; exiting preserves custom positions in the feed.

---

## Testing & verification (all features)

- Run `npm test` — all pass.
- Run the dev server via preview tools; verify each feature visually at mobile (375px) and desktop (1280px) widths.
- No TypeScript errors (`npm run build`).
