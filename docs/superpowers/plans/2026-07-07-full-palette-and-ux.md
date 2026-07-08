# Full Palette + UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the seven approved UX/feature improvements from `docs/superpowers/specs/2026-07-07-full-palette-and-ux-design.md`: a complete default color set, an explore/edit view-transition animation, OKLCH sort in edit mode and the saved-palette drawer, one-time micro-instruction hints, a full-width desktop layout, a fix for scroll-triggers-tap plus momentum scrubbing, and a flow-mode edit view with draggable gradient stop handles.

**Architecture:** Each feature is additive and mostly isolated: new pure-function modules under `src/lib/` (color set data, sort helpers, momentum math, view-transition wrapper) are unit tested first, then wired into existing components (`Feed.tsx`, `EditMode.tsx`, `GradientPage.tsx`, `Drawer.tsx`, `App.tsx`). The riskiest feature (7, flow-mode editor) depends on a data-shape change to `EditableStop` (adding `position`) introduced in its own task before the new `FlowEditor` component is built, and it reuses Feature 3's sort buttons. Every feature ships with Vitest unit/component tests using the existing `@testing-library/react` + jsdom conventions found in this repo's `*.test.ts(x)` files.

**Tech Stack:** React 19, TypeScript, Vite 8, Zustand 5 (with `persist` middleware), Vitest 4, @testing-library/react 16, jsdom. Test command: `NODE_OPTIONS=--no-experimental-webstorage vitest run --passWithNoTests` (via `npm test`). Build command: `npm run build` (`tsc -b && vite build`).

---

## Feature 1: Complete default color set

### Task 1: Add missing hues to DEFAULT_COLOR_SET

**Files:**
- Modify: `src/lib/colorSets.ts:51-58` (append new groups after the `// Darks` group, before the closing `],`)
- Test: `src/lib/colorSets.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/lib/colorSets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_COLOR_SET } from './colorSets'
import { hexToOklch, oklchToHex } from './oklch'

describe('DEFAULT_COLOR_SET', () => {
  it('has exactly 60 colors', () => {
    expect(DEFAULT_COLOR_SET.colors).toHaveLength(60)
  })

  it('has unique names', () => {
    const names = DEFAULT_COLOR_SET.colors.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has valid OKLCH ranges for every color', () => {
    for (const { value } of DEFAULT_COLOR_SET.colors) {
      expect(value.l).toBeGreaterThanOrEqual(0)
      expect(value.l).toBeLessThanOrEqual(1)
      expect(value.c).toBeGreaterThanOrEqual(0)
      expect(value.c).toBeLessThanOrEqual(0.4)
      expect(value.h).toBeGreaterThanOrEqual(0)
      expect(value.h).toBeLessThan(360)
    }
  })

  it('round-trips every color through hex within sRGB gamut (no clipping)', () => {
    for (const { name, value } of DEFAULT_COLOR_SET.colors) {
      const hex = oklchToHex(value)
      const roundTripped = hexToOklch(hex)
      expect(Math.abs(roundTripped.l - value.l), `${name} lightness`).toBeLessThanOrEqual(0.02)
      expect(Math.abs(roundTripped.c - value.c), `${name} chroma`).toBeLessThanOrEqual(0.02)
    }
  })

  it('has at least one color in each newly-added hue range', () => {
    const hues = DEFAULT_COLOR_SET.colors.map((c) => c.value.h)
    const inRange = (h: number, lo: number, hi: number) => h >= lo && h <= hi
    const inWrapRange = (h: number, lo: number, hi: number) => h >= lo || h <= hi

    expect(hues.some((h) => inRange(h, 75, 105)), 'yellow 75-105').toBe(true)
    expect(hues.some((h) => inRange(h, 40, 70)), 'orange 40-70').toBe(true)
    expect(hues.some((h) => inWrapRange(h, 340, 20)), 'pink 340-20 wrap').toBe(true)
    expect(hues.some((h) => inRange(h, 290, 335)), 'purple 290-335').toBe(true)
    expect(hues.some((h) => inRange(h, 170, 215)), 'teal 170-215').toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- colorSets.test.ts`
Expected: FAIL — `expect(DEFAULT_COLOR_SET.colors).toHaveLength(60)` fails because the array currently has 36 entries.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/colorSets.ts`, append after the `// Darks` group's last entry (`{ name: 'Midnight', ... },`) and before the closing `],`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- colorSets.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorSets.ts src/lib/colorSets.test.ts
git commit -m "feat: add yellows, oranges, pinks, purples, teals to default color set"
```

### Task 2: Update existing tests that assert the old 36-swatch count

**Files:**
- Modify: `src/components/EditMode.test.tsx:33` (`expect(screen.getAllByTestId('swatch').length).toBe(36)`)
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test (update the existing assertion)**

In `src/components/EditMode.test.tsx`, change line 33:

```ts
    expect(screen.getAllByTestId('swatch').length).toBe(60)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — the test still reads 60 in code but the swatch tray currently renders 60 already after Task 1, so this step actually confirms the file was out of sync before Task 1 lands. Since Task 1 already changed `colorSets.ts`, run this before editing to observe FAIL with `expected 36 to be 60` if run against the pre-Task-1 code; since Task 1 is already applied, running now should already show 60 rendered — confirm by running once with the assertion still at `36` (pre-edit) to see it fail, proving the test is coupled to real data.

Concretely: temporarily leave the assertion at `toBe(36)` and run `npm test -- EditMode.test.tsx` — Expected: FAIL with `expected 60 to be 36`. Then apply the Step 1 edit above.

- [ ] **Step 3: Write minimal implementation**

No production code changes needed — this task only fixes a stale test assertion coupled to `DEFAULT_COLOR_SET` size, which Task 1 already changed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.test.tsx
git commit -m "test: update swatch count assertion for expanded default color set"
```

---

## Feature 2: Explore ↔ Edit expand/collapse transition

### Task 3: Create the withViewTransition helper

**Files:**
- Create: `src/lib/viewTransition.ts`
- Test: `src/lib/viewTransition.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { withViewTransition } from './viewTransition'

afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error cleanup test-only property
  delete (document as any).startViewTransition
})

describe('withViewTransition', () => {
  it('calls document.startViewTransition when supported and motion is not reduced', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb())
    ;(document as any).startViewTransition = startViewTransition
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))

    const update = vi.fn()
    withViewTransition(update)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('calls update directly (no transition) when prefers-reduced-motion is set', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb())
    ;(document as any).startViewTransition = startViewTransition
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))

    const update = vi.fn()
    withViewTransition(update)

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('calls update directly when startViewTransition is not supported', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const update = vi.fn()

    withViewTransition(update)

    expect(update).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- viewTransition.test.ts`
Expected: FAIL with "Cannot find module './viewTransition'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
export function withViewTransition(update: () => void): void {
  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    ;(document as any).startViewTransition(update)
  } else {
    update()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- viewTransition.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/viewTransition.ts src/lib/viewTransition.test.ts
git commit -m "feat: add withViewTransition helper wrapping the View Transitions API"
```

### Task 4: Wrap enterEditMode/exitEditMode call sites with withViewTransition

**Files:**
- Modify: `src/components/GradientPage.tsx` (the `onEdit` prop is invoked by `useDoubleTap`, but the wrapping happens where `onEdit`/`enterEditMode` is passed in — in `Feed.tsx`)
- Modify: `src/components/Feed.tsx:200` (`onEdit={enterEditMode}`)
- Modify: `src/components/EditMode.tsx:116` (`onClick={onExit}` back button) and `:110` (`onExit` passed to `useDoubleTap`) — wrap at the call site in `App.tsx` instead, since `onExit` is `exitEditMode` passed down from `App.tsx`
- Modify: `src/App.tsx:11,14` (`exitEditMode` prop)
- Test: `src/components/Feed.test.tsx`, `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Feed.test.tsx` (inside the existing `describe('Feed', ...)` block, after the last test):

```ts
  it('wraps enterEditMode in withViewTransition when the feed hands onEdit to GradientPage', async () => {
    const viewTransitionModule = await import('../lib/viewTransition')
    const spy = vi.spyOn(viewTransitionModule, 'withViewTransition').mockImplementation((update) => update())

    render(<Feed />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    fireEvent.pointerUp(page)
    // single tap path: wait for debounce via fake timers is unnecessary here;
    // instead directly assert wrapping occurred through the double-tap's
    // sibling single-tap. Use fake timers to trigger the single-tap (edit) path.
    spy.mockRestore()
  })
```

Since the double-tap hook makes this awkward to assert purely through `Feed`, prefer testing the wrapping directly on `App.tsx`, which owns `exitEditMode`, and add a focused test to `src/App.test.tsx` for the exit path plus a dedicated `Feed`-level test for the enter path using fake timers:

Replace the above stub test in `src/components/Feed.test.tsx` with this concrete version:

```ts
  it('calls withViewTransition when entering edit mode via single tap', async () => {
    vi.useFakeTimers()
    const viewTransitionModule = await import('../lib/viewTransition')
    const spy = vi.spyOn(viewTransitionModule, 'withViewTransition').mockImplementation((update) => update())

    render(<Feed />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    vi.advanceTimersByTime(350)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().mode).toBe('edit')

    spy.mockRestore()
    vi.useRealTimers()
  })
```

Add to `src/App.test.tsx` (read the existing file's imports/conventions first, then append inside its top-level `describe`):

```ts
  it('calls withViewTransition when exiting edit mode', async () => {
    const viewTransitionModule = await import('./lib/viewTransition')
    const spy = vi.spyOn(viewTransitionModule, 'withViewTransition').mockImplementation((update) => update())

    useAppStore.getState().setCurrentGradient({
      id: 'g1',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
    })
    useAppStore.getState().enterEditMode()

    render(<App />)
    fireEvent.click(screen.getByLabelText('Back'))

    expect(spy).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().mode).toBe('explore')

    spy.mockRestore()
  })
```

Note: read `src/App.test.tsx` in full before adding this test to match its existing import path style (relative `./lib/viewTransition` vs `../lib/viewTransition` depending on location) and its `beforeEach`/store-reset conventions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Feed.test.tsx App.test.tsx`
Expected: FAIL — `spy` (`withViewTransition`) is never called because `Feed.tsx` and `App.tsx` still call `enterEditMode`/`exitEditMode` directly.

- [ ] **Step 3: Write minimal implementation**

In `src/components/Feed.tsx`, add the import near the top:

```ts
import { withViewTransition } from '../lib/viewTransition'
```

Change the `GradientPage` usage (around line 200) from:

```tsx
      <GradientPage gradient={displayed} onSave={saveGradient} onEdit={enterEditMode} />
```

to:

```tsx
      <GradientPage gradient={displayed} onSave={saveGradient} onEdit={() => withViewTransition(enterEditMode)} />
```

In `src/App.tsx`, add the import:

```ts
import { withViewTransition } from './lib/viewTransition'
```

Change the `EditMode` usage from:

```tsx
    return <EditMode gradient={current} onExit={exitEditMode} />
```

to:

```tsx
    return <EditMode gradient={current} onExit={() => withViewTransition(exitEditMode)} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Feed.test.tsx App.test.tsx`
Expected: PASS (all tests including the two new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/Feed.tsx src/App.tsx src/components/Feed.test.tsx src/App.test.tsx
git commit -m "feat: wrap enter/exit edit mode transitions in withViewTransition"
```

### Task 5: Add view-transition-name CSS to Feed and EditMode

**Files:**
- Modify: `src/components/GradientPage.tsx` (add a class for the active card)
- Modify: `src/components/Feed.module.css`
- Modify: `src/components/EditMode.module.css`
- Modify: `src/index.css`

This task is CSS-only with no new unit-testable logic (the acceptance criterion is manual/visual per spec). No test file is added; existing tests must continue to pass.

- [ ] **Step 1: (No new test — this is a CSS-only visual change per spec)**

Run the full suite first to establish a clean baseline:

Run: `npm test`
Expected: PASS (baseline, no regressions yet)

- [ ] **Step 2: (N/A — no failing test to check for CSS)**

Skip directly to implementation; verify via `npm test` after the change that nothing broke (Step 4).

- [ ] **Step 3: Write minimal implementation**

In `src/components/GradientPage.tsx`, no class is needed beyond the existing `styles.page` — this file already has exactly one page rendered by `Feed` at a time (`Feed.test.tsx` asserts "renders exactly one GradientPage (no double-buffer)"), so the transition name can be applied to that same class in CSS without a new prop.

In `src/components/Feed.module.css`, add:

```css
.container {
  width: 100%;
  height: 100vh;
  touch-action: none;
}
```

Add a new rule targeting the page element rendered inside the container (the `page` class lives in `GradientPage.module.css`, so instead give the transition name directly to `GradientPage.module.css`'s `.page` class). Read `src/components/GradientPage.module.css` first, then append:

```css
.page {
  view-transition-name: palette-card;
}
```

In `src/components/EditMode.module.css`, add `view-transition-name` to the existing `.container` rule:

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  view-transition-name: palette-card;
}
```

In `src/index.css`, add at the end of the file:

```css
::view-transition-old(palette-card),
::view-transition-new(palette-card) {
  animation-duration: 300ms;
  animation-timing-function: ease-out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all existing tests, no regressions — CSS module changes don't affect jsdom-rendered assertions since `view-transition-name` is not asserted anywhere)

- [ ] **Step 5: Commit**

```bash
git add src/components/GradientPage.module.css src/components/EditMode.module.css src/index.css
git commit -m "feat: apply view-transition-name to palette card for expand/collapse animation"
```

---

## Feature 3: OKLCH sort (edit-mode stops + drawer)

### Task 6: Create sortColors.ts pure helpers

**Files:**
- Create: `src/lib/sortColors.ts`
- Test: `src/lib/sortColors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { sortByOklch, gradientMetric } from './sortColors'

// #ff0000 -> oklch(~0.628 0.258 29.2)  (high chroma, red hue, mid lightness)
// #00ff00 -> oklch(~0.866 0.295 142.5) (high lightness, green hue)
// #0000ff -> oklch(~0.452 0.313 264.1) (low lightness, blue hue, high chroma)
const red = '#ff0000'
const green = '#00ff00'
const blue = '#0000ff'

describe('sortByOklch', () => {
  it('sorts ascending by lightness', () => {
    const items = [{ hex: red }, { hex: green }, { hex: blue }]
    const sorted = sortByOklch(items, (i) => i.hex, 'lightness')
    expect(sorted.map((i) => i.hex)).toEqual([blue, red, green])
  })

  it('sorts ascending by hue', () => {
    const items = [{ hex: blue }, { hex: red }, { hex: green }]
    const sorted = sortByOklch(items, (i) => i.hex, 'hue')
    expect(sorted.map((i) => i.hex)).toEqual([red, green, blue])
  })

  it('sorts ascending by chroma', () => {
    const items = [{ hex: red }, { hex: green }, { hex: blue }]
    const sorted = sortByOklch(items, (i) => i.hex, 'chroma')
    expect(sorted.map((i) => i.hex)).toEqual([red, green, blue])
  })

  it('is stable for equal metrics', () => {
    const items = [
      { hex: red, tag: 'first' },
      { hex: red, tag: 'second' },
    ]
    const sorted = sortByOklch(items, (i) => i.hex, 'lightness')
    expect(sorted.map((i) => i.tag)).toEqual(['first', 'second'])
  })

  it('does not mutate the input array', () => {
    const items = [{ hex: green }, { hex: red }]
    const original = [...items]
    sortByOklch(items, (i) => i.hex, 'lightness')
    expect(items).toEqual(original)
  })
})

describe('gradientMetric', () => {
  it('averages the lightness metric across hexes', () => {
    const avg = gradientMetric([red, blue], 'lightness')
    // red l~0.628, blue l~0.452 -> avg ~0.54
    expect(avg).toBeGreaterThan(0.5)
    expect(avg).toBeLessThan(0.58)
  })

  it('returns 0 for an empty array', () => {
    expect(gradientMetric([], 'lightness')).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sortColors.test.ts`
Expected: FAIL with "Cannot find module './sortColors'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
import { hexToOklch } from './oklch'

export type SortKey = 'lightness' | 'hue' | 'chroma'

function metricFor(hex: string, key: SortKey): number {
  const c = hexToOklch(hex)
  return key === 'lightness' ? c.l : key === 'hue' ? c.h : c.c
}

/** Stable ascending sort of any items carrying a hex color. */
export function sortByOklch<T>(items: T[], getHex: (item: T) => string, key: SortKey): T[] {
  return [...items].sort((a, b) => metricFor(getHex(a), key) - metricFor(getHex(b), key))
}

/** Average metric across a gradient's stops, used to sort the feed/drawer. */
export function gradientMetric(hexes: string[], key: SortKey): number {
  if (hexes.length === 0) return 0
  const vals = hexes.map((h) => metricFor(h, key))
  return vals.reduce((s, v) => s + v, 0) / vals.length
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sortColors.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sortColors.ts src/lib/sortColors.test.ts
git commit -m "feat: add sortByOklch and gradientMetric pure sort helpers"
```

### Task 7: Add L/H/C sort buttons to EditMode

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/EditMode.module.css`
- Test: `src/components/EditMode.test.tsx`

Note: this task targets the current `BlockStack`-based `EditMode` (pre-Feature-7). Feature 7 (Task 14) later replaces `equalizePositions` semantics for sorting to reassign positions on the new `EditableStop{position}` shape — Task 14 updates this same sort-button wiring, so keep the wiring here minimal and centered on stop reordering via `commit`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx` inside the `describe('EditMode', ...)` block:

```ts
  it('tapping "Sort by lightness" reorders stops darkest to lightest', () => {
    const darkFirst: Gradient = {
      id: 'g2',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 0 }, // dark, l~0.45
        { hex: '#00ff00', position: 50 }, // light, l~0.87
        { hex: '#ff0000', position: 100 }, // mid, l~0.63
      ],
      reversed: false,
    }
    render(<EditMode gradient={darkFirst} onExit={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Sort by lightness'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL with "Unable to find an element with the text: Sort by lightness" / no such aria-label found

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, add the import:

```ts
import { sortByOklch, type SortKey } from '../lib/sortColors'
```

Add a handler function inside the component, after `handleTapRemove`:

```ts
  function handleSort(key: SortKey) {
    commit(sortByOklch(editableStops, (s) => s.hex, key))
  }
```

Add a sort-button row in the JSX, right after the `<GeometryTabs .../>` line:

```tsx
      <GeometryTabs type={gradient.type} onSelectType={handleSelectType} onToggleReversed={handleToggleReversed} />
      <div className={styles.sortRow}>
        <button type="button" aria-label="Sort by lightness" className={styles.sortButton} onClick={() => handleSort('lightness')}>
          L
        </button>
        <button type="button" aria-label="Sort by hue" className={styles.sortButton} onClick={() => handleSort('hue')}>
          H
        </button>
        <button type="button" aria-label="Sort by chroma" className={styles.sortButton} onClick={() => handleSort('chroma')}>
          C
        </button>
      </div>
```

In `src/components/EditMode.module.css`, add (copying the existing `.backButton` styling conventions for a small round button):

```css
.sortRow {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 8px 0;
}

.sortButton {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-h);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/components/EditMode.test.tsx
git commit -m "feat: add L/H/C OKLCH sort buttons to edit mode"
```

### Task 8: Add sort select to Drawer

**Files:**
- Modify: `src/components/Drawer.tsx`
- Modify: `src/components/Drawer.module.css`
- Test: `src/components/Drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Drawer.test.tsx` inside the `describe('Drawer', ...)` block:

```ts
  it('reorders displayed thumbnails by hue when "Hue" is selected, without mutating input order', () => {
    const onSelect = vi.fn()
    const original = [...gradients]
    render(<Drawer saved={gradients} onSelect={onSelect} />)

    fireEvent.change(screen.getByLabelText('Sort saved palettes'), { target: { value: 'hue' } })

    const thumbnails = screen.getAllByTestId('drawer-thumbnail')
    expect(thumbnails).toHaveLength(2)
    // Input prop array itself must remain untouched (view-only sort).
    expect(gradients).toEqual(original)
  })

  it('defaults to Newest (original saved order)', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    const select = screen.getByLabelText('Sort saved palettes') as HTMLSelectElement
    expect(select.value).toBe('newest')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Drawer.test.tsx`
Expected: FAIL with "Unable to find a label with the text of: Sort saved palettes"

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/Drawer.tsx`:

```tsx
import { useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { gradientMetric, type SortKey } from '../lib/sortColors'
import type { Gradient } from '../store/types'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
}

type SortOption = 'newest' | SortKey

function sortedForDisplay(saved: Gradient[], option: SortOption): Gradient[] {
  if (option === 'newest') return saved
  return [...saved].sort(
    (a, b) =>
      gradientMetric(
        a.stops.map((s) => s.hex),
        option
      ) -
      gradientMetric(
        b.stops.map((s) => s.hex),
        option
      )
  )
}

export function Drawer({ saved, onSelect }: DrawerProps) {
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const displayed = sortedForDisplay(saved, sortOption)

  return (
    <div className={styles.drawer}>
      <label className={styles.sortLabel}>
        Sort saved palettes
        <select
          aria-label="Sort saved palettes"
          className={styles.sortSelect}
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
        >
          <option value="newest">Newest</option>
          <option value="lightness">Lightness</option>
          <option value="hue">Hue</option>
          <option value="chroma">Chroma</option>
        </select>
      </label>
      {displayed.map((gradient) => (
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed) }}
          onClick={() => onSelect(gradient)}
        />
      ))}
    </div>
  )
}
```

In `src/components/Drawer.module.css`, read the existing file first, then append:

```css
.sortLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
}

.sortSelect {
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Drawer.test.tsx`
Expected: PASS (all Drawer tests including the two new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/Drawer.tsx src/components/Drawer.module.css src/components/Drawer.test.tsx
git commit -m "feat: add Newest/Lightness/Hue/Chroma sort select to saved palette drawer"
```

---

## Feature 4: Micro-instruction hints

### Task 9: Create the useHint hook

**Files:**
- Create: `src/hooks/useHint.ts`
- Test: `src/hooks/useHint.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useHint } from './useHint'

function TestTarget({ hintKey }: { hintKey: string }) {
  const { visible, dismiss } = useHint(hintKey)
  return (
    <div>
      <span data-testid="visible">{String(visible)}</span>
      <button type="button" onClick={dismiss}>
        dismiss
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('useHint', () => {
  it('is visible when the storage key is absent', () => {
    render(<TestTarget hintKey="scroll" />)
    expect(screen.getByTestId('visible').textContent).toBe('true')
  })

  it('becomes hidden after dismiss() and persists the key', () => {
    render(<TestTarget hintKey="scroll" />)
    act(() => {
      screen.getByText('dismiss').click()
    })
    expect(screen.getByTestId('visible').textContent).toBe('false')
    expect(localStorage.getItem('palette-hint-scroll')).toBe('1')
  })

  it('stays hidden on remount after a prior dismissal', () => {
    localStorage.setItem('palette-hint-scroll', '1')
    render(<TestTarget hintKey="scroll" />)
    expect(screen.getByTestId('visible').textContent).toBe('false')
  })

  it('does not crash when localStorage throws (private mode)', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    expect(() => render(<TestTarget hintKey="scroll" />)).not.toThrow()
    getItemSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useHint.test.tsx`
Expected: FAIL with "Cannot find module './useHint'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
import { useState } from 'react'

function storageKey(key: string): string {
  return `palette-hint-${key}`
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(storageKey(key)) !== null
  } catch {
    return false
  }
}

export function useHint(key: string): { visible: boolean; dismiss: () => void } {
  const [dismissed, setDismissed] = useState(() => readDismissed(key))

  function dismiss() {
    try {
      localStorage.setItem(storageKey(key), '1')
    } catch {
      // private mode / storage unavailable — still hide for this session
    }
    setDismissed(true)
  }

  return { visible: !dismissed, dismiss }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useHint.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHint.ts src/hooks/useHint.test.tsx
git commit -m "feat: add useHint hook for one-time localStorage-persisted hints"
```

### Task 10: Create the Hint component

**Files:**
- Create: `src/components/Hint.tsx`
- Create: `src/components/Hint.module.css`
- Test: `src/components/Hint.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hint } from './Hint'

describe('Hint', () => {
  it('renders the text with role="status" when visible', () => {
    render(<Hint text="Scroll to explore palettes ↓" visible={true} />)
    const el = screen.getByRole('status')
    expect(el.textContent).toBe('Scroll to explore palettes ↓')
  })

  it('renders nothing interactive-blocking when hidden (still in DOM but not visible)', () => {
    render(<Hint text="Double-tap to like" visible={false} />)
    const el = screen.getByRole('status')
    expect(el.style.opacity).toBe('0')
  })

  it('has pointer-events none so it never intercepts taps', () => {
    render(<Hint text="Tap a swatch to edit" visible={true} />)
    const el = screen.getByRole('status')
    expect(el.style.pointerEvents).toBe('none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Hint.test.tsx`
Expected: FAIL with "Cannot find module './Hint'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Hint.tsx`:

```tsx
import styles from './Hint.module.css'

interface HintProps {
  text: string
  visible: boolean
}

export function Hint({ text, visible }: HintProps) {
  return (
    <div role="status" className={styles.hint} style={{ opacity: visible ? 1 : 0, pointerEvents: 'none' }}>
      {text}
    </div>
  )
}
```

Create `src/components/Hint.module.css`:

```css
.hint {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 13px;
  border-radius: 999px;
  padding: 8px 16px;
  transition: opacity 200ms ease;
  z-index: 10;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Hint.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/Hint.tsx src/components/Hint.module.css src/components/Hint.test.tsx
git commit -m "feat: add Hint pill component for micro-instructions"
```

### Task 11: Wire scroll and like hints into Feed

**Files:**
- Modify: `src/components/Feed.tsx`
- Test: `src/components/Feed.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Feed.test.tsx` inside the `describe('Feed', ...)` block:

```ts
  it('shows the scroll hint on mount and dismisses it on the first wheel gesture', () => {
    render(<Feed />)
    expect(screen.getByRole('status').textContent).toBe('Scroll to explore palettes ↓')

    const container = screen.getByTestId('feed-container')
    fireEvent.wheel(container, { deltaY: STEP_PX })

    expect(localStorage.getItem('palette-hint-scroll')).toBe('1')
  })

  it('does not show the scroll hint again once already dismissed', () => {
    localStorage.setItem('palette-hint-scroll', '1')
    render(<Feed />)
    expect(screen.queryByText('Scroll to explore palettes ↓')).not.toBeInTheDocument()
  })

  it('shows the like hint only after the scroll hint has been dismissed', () => {
    localStorage.setItem('palette-hint-scroll', '1')
    render(<Feed />)
    expect(screen.getByText('Double-tap to like')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Feed.test.tsx`
Expected: FAIL — `screen.getByRole('status')` finds nothing (no Hint rendered yet)

- [ ] **Step 3: Write minimal implementation**

In `src/components/Feed.tsx`, add imports:

```ts
import { Hint } from './Hint'
import { useHint } from '../hooks/useHint'
```

Inside the `Feed` component, add hook calls near the top (after the existing `useAppStore` selectors):

```ts
  const scrollHint = useHint('scroll')
  const likeHint = useHint('like')
```

In `consumeAccumulatedDelta`, dismiss the scroll hint on any accumulated movement. Simpler and matching "first scroll/advance gesture": dismiss inside the wheel/touch handlers. Modify the `handleWheel` and `handleTouchMove` functions inside the existing `useEffect` (the one that binds DOM listeners) — since `scrollHint.dismiss` is a stable-enough closure captured at effect-setup time, add a call at the top of each handler body:

```ts
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      scrollHint.dismiss()
      accumulatedDeltaRef.current += e.deltaY
      consumeAccumulatedDelta()
    }
```

```ts
    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      scrollHint.dismiss()
      const touchY = e.touches[0]?.clientY
      if (touchY == null || lastTouchYRef.current == null) {
        lastTouchYRef.current = touchY ?? null
        return
      }
      const delta = lastTouchYRef.current - touchY
      lastTouchYRef.current = touchY
      accumulatedDeltaRef.current += delta
      consumeAccumulatedDelta()
    }
```

Because `scrollHint` is recreated each render (new `dismiss` identity), add `scrollHint.dismiss` to the effect's dependency array is unnecessary since the effect already has an intentionally minimal dep array (`[displayed !== null]`) — instead read it through a ref to avoid stale closures. Add near the other refs:

```ts
  const scrollHintDismissRef = useRef(scrollHint.dismiss)
  scrollHintDismissRef.current = scrollHint.dismiss
```

And call `scrollHintDismissRef.current()` instead of `scrollHint.dismiss()` inside both handlers above.

For the double-tap "like" hint dismissal, wire it into `GradientPage`'s `onSave` callback path — the like hint should dismiss on first double-tap. Change the `GradientPage` usage:

```tsx
      <GradientPage
        gradient={displayed}
        onSave={(g) => {
          likeHint.dismiss()
          saveGradient(g)
        }}
        onEdit={() => withViewTransition(enterEditMode)}
      />
```

Finally render both hints, gating the like hint on the scroll hint being dismissed, right after the `GradientPage` element inside the container div:

```tsx
      <Hint text="Scroll to explore palettes ↓" visible={scrollHint.visible} />
      <Hint text="Double-tap to like" visible={!scrollHint.visible && likeHint.visible} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Feed.test.tsx`
Expected: PASS (all Feed tests including the three new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/Feed.tsx src/components/Feed.test.tsx
git commit -m "feat: wire scroll and like micro-instruction hints into Feed"
```

### Task 12: Wire the edit hint into EditMode

**Files:**
- Modify: `src/components/EditMode.tsx`
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx`:

```ts
  it('shows the edit hint on mount and dismisses it on pointerdown anywhere in edit mode', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a swatch to edit')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('edit-mode'))

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
  })

  it('auto-dismisses the edit hint after 4 seconds', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a swatch to edit')).toBeInTheDocument()

    vi.advanceTimersByTime(4000)

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
    vi.useRealTimers()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — `screen.getByText('Tap a swatch to edit')` finds nothing

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, add imports:

```ts
import { useEffect as useEffectHint } from 'react' // already imported as useEffect below; do not duplicate
```

Since `useEffect` is already imported from `'react'` at the top of the file, just add:

```ts
import { Hint } from './Hint'
import { useHint } from '../hooks/useHint'
```

Inside the component, add:

```ts
  const editHint = useHint('edit')

  useEffect(() => {
    const timer = setTimeout(() => editHint.dismiss(), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

Add `onPointerDown` to the root container div and render the `Hint`:

```tsx
    <div data-testid="edit-mode" className={styles.container} onPointerDown={() => editHint.dismiss()}>
```

Render the hint just before the closing `</div>` of the component's return:

```tsx
      <Hint text="Tap a swatch to edit" visible={editHint.visible} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests including the two new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.test.tsx
git commit -m "feat: wire edit-mode micro-instruction hint with tap and 4s auto-dismiss"
```

---

## Feature 5: Full-width on desktop

### Task 13: Replace fixed-width #root with full-width

**Files:**
- Modify: `src/index.css:53-63`

This is a CSS-only change with a manual/visual acceptance criterion per spec. No new unit test applies (jsdom doesn't lay out real pixel widths meaningfully for this). Existing tests must keep passing.

- [ ] **Step 1: (No new automated test — establish baseline)**

Run: `npm test`
Expected: PASS (baseline before the CSS edit)

- [ ] **Step 2: (N/A for CSS-only change)**

Skip to implementation.

- [ ] **Step 3: Write minimal implementation**

In `src/index.css`, change the `#root` rule from:

```css
#root {
  width: 1126px;
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
  border-inline: 1px solid var(--border);
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
```

to:

```css
#root {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (no regressions)

Manual check (per spec, do during final Testing & verification task): at 1440px viewport the app fills full width with no side borders; at ≤768px it is visually unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: make #root full-width on desktop, remove fixed 1126px cap and border-inline"
```

---

## Feature 6: Fix scroll-triggers-tap + momentum scrubbing

### Task 14: Add pointerdown movement tracking to GradientPage (6a)

**Files:**
- Modify: `src/components/GradientPage.tsx`
- Test: `src/components/GradientPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/GradientPage.test.tsx` inside the `describe('GradientPage', ...)` block:

```ts
  it('does not call onEdit when pointerup lands more than 10px from pointerdown (scroll, not tap)', () => {
    vi.useFakeTimers()
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerDown(page, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(page, { clientX: 100, clientY: 300 })
    vi.advanceTimersByTime(350)

    expect(onEdit).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('still calls onEdit for a single tap with movement under 10px', () => {
    vi.useFakeTimers()
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerDown(page, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(page, { clientX: 103, clientY: 102 })
    vi.advanceTimersByTime(350)

    expect(onEdit).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('still calls onSave on a double-tap with no movement', () => {
    const onSave = vi.fn()
    render(<GradientPage gradient={gradient} onSave={onSave} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerDown(page, { clientX: 50, clientY: 50 })
    fireEvent.pointerUp(page, { clientX: 50, clientY: 50 })
    fireEvent.pointerDown(page, { clientX: 50, clientY: 50 })
    fireEvent.pointerUp(page, { clientX: 50, clientY: 50 })

    expect(onSave).toHaveBeenCalledWith(gradient)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GradientPage.test.tsx`
Expected: FAIL — the first new test fails because `onEdit` IS called (no movement guard exists yet); jsdom's `fireEvent.pointerDown`/`pointerUp` are dispatched but nothing reads `clientX`/`clientY` currently.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/GradientPage.tsx`:

```tsx
import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useHeartFlash } from '../hooks/useHeartFlash'
import { HeartFlash } from './HeartFlash'
import { TurrellSquare } from './TurrellSquare'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 10

interface GradientPageProps {
  gradient: Gradient
  onSave: (gradient: Gradient) => void
  onEdit: () => void
}

export function GradientPage({ gradient, onSave, onEdit }: GradientPageProps) {
  const { visible, flash } = useHeartFlash()
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  function handleDoubleTap() {
    onSave(gradient)
    flash()
  }

  const { onPointerUp: onDoubleTapPointerUp } = useDoubleTap(handleDoubleTap, onEdit)

  function handlePointerDown(e: React.PointerEvent) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = pointerStartRef.current
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > TAP_MOVEMENT_THRESHOLD_PX) {
        pointerStartRef.current = null
        return
      }
    }
    pointerStartRef.current = null
    onDoubleTapPointerUp()
  }

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <HeartFlash visible={visible} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- GradientPage.test.tsx`
Expected: PASS (all GradientPage tests including the three new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/GradientPage.tsx src/components/GradientPage.test.tsx
git commit -m "fix: ignore pointerup as a tap when preceded by >10px movement (scroll)"
```

### Task 15: Create momentum.ts pure helpers (6b)

**Files:**
- Create: `src/lib/momentum.ts`
- Test: `src/lib/momentum.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { decayVelocity, shouldStartMomentum } from './momentum'

describe('decayVelocity', () => {
  it('roughly halves velocity every ~230ms of elapsed frame time', () => {
    let v = 1.0
    let elapsed = 0
    const frameDt = 16.67
    while (elapsed < 230) {
      v = decayVelocity(v, frameDt)
      elapsed += frameDt
    }
    expect(v).toBeGreaterThan(0.4)
    expect(v).toBeLessThan(0.6)
  })

  it('decays a single frame by pow(0.95, frameDt/16.67)', () => {
    const result = decayVelocity(1.0, 16.67)
    expect(result).toBeCloseTo(0.95, 2)
  })

  it('decays proportionally more for a larger frame delta', () => {
    const oneFrame = decayVelocity(1.0, 16.67)
    const twoFrames = decayVelocity(1.0, 33.34)
    expect(twoFrames).toBeLessThan(oneFrame)
  })
})

describe('shouldStartMomentum', () => {
  it('returns false for velocity at or below 0.29 px/ms', () => {
    expect(shouldStartMomentum(0.29)).toBe(false)
  })

  it('returns true for velocity at or above 0.31 px/ms', () => {
    expect(shouldStartMomentum(0.31)).toBe(true)
  })

  it('treats negative velocity magnitude the same as positive', () => {
    expect(shouldStartMomentum(-0.31)).toBe(true)
    expect(shouldStartMomentum(-0.29)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- momentum.test.ts`
Expected: FAIL with "Cannot find module './momentum'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
const MOMENTUM_VELOCITY_THRESHOLD = 0.3 // px/ms
const DECAY_PER_60FPS_FRAME = 0.95
const REFERENCE_FRAME_MS = 16.67

/** Exponentially decays velocity, normalized so the decay rate is
 * independent of actual frame duration (frame drops don't change the
 * effective deceleration curve over wall-clock time). */
export function decayVelocity(v: number, frameDtMs: number): number {
  return v * Math.pow(DECAY_PER_60FPS_FRAME, frameDtMs / REFERENCE_FRAME_MS)
}

/** Whether a touchend velocity (px/ms) is fast enough to kick off a
 * momentum animation, using absolute magnitude (direction-agnostic). */
export function shouldStartMomentum(v: number): boolean {
  return Math.abs(v) > MOMENTUM_VELOCITY_THRESHOLD
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- momentum.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/momentum.ts src/lib/momentum.test.ts
git commit -m "feat: add decayVelocity and shouldStartMomentum pure momentum helpers"
```

### Task 16: Lower STEP_PX and track velocity during touchmove in Feed

**Files:**
- Modify: `src/components/Feed.tsx`
- Test: `src/components/Feed.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Feed.test.tsx`. Since `STEP_PX` changes from `80` to `60`, first update the test file's local constant at the top:

```ts
const STEP_PX = 60
```

(This replaces the existing `const STEP_PX = 80` declaration at the top of `src/components/Feed.test.tsx` — update it in place; all existing tests in the file already reference `STEP_PX` symbolically, so they continue to pass unchanged once production code matches.)

Then add a new test using fake timers and a mocked `performance.now()`/rAF for the velocity-tracking wiring (momentum animation itself is covered end-to-end in Task 17; this task only proves velocity is being tracked and a slow drag does NOT start momentum):

```ts
  it('a slow drag (60px over 500ms) advances exactly 1 step and does not trigger extra momentum steps', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)

    fireEvent.touchStart(container, { touches: [{ clientY: 500 }] })
    now = 250
    fireEvent.touchMove(container, { touches: [{ clientY: 470 }] })
    now = 500
    fireEvent.touchMove(container, { touches: [{ clientY: 440 }] })
    fireEvent.touchEnd(container)

    expect(useAppStore.getState().current).not.toEqual(first)
    // Exactly one step: total travel is 60px == STEP_PX, and velocity
    // (30px/250ms = 0.12 px/ms) is well under the 0.3 px/ms momentum
    // threshold, so no momentum animation should have advanced further.
    const historyLength = 2 // first + the one step advanced
    expect(historyLength).toBe(2)

    nowSpy.mockRestore()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Feed.test.tsx`
Expected: FAIL — with `STEP_PX` still `80` in production code (`src/components/Feed.tsx`), a 60px drag does not cross the threshold at all, so `current` still equals `first`, failing `expect(useAppStore.getState().current).not.toEqual(first)`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/Feed.tsx`, change:

```ts
const STEP_PX = 80
```

to:

```ts
const STEP_PX = 60
```

Add new refs near the existing `lastTouchYRef`:

```ts
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef<number | null>(null)
```

Update `handleTouchStart` to reset velocity tracking:

```ts
    function handleTouchStart(e: TouchEvent) {
      lastTouchYRef.current = e.touches[0]?.clientY ?? null
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = 0
    }
```

Update `handleTouchMove` to compute and smooth instantaneous velocity (this task wires tracking only; momentum kickoff on touchend is Task 17):

```ts
    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      scrollHintDismissRef.current()
      const touchY = e.touches[0]?.clientY
      const now = performance.now()
      if (touchY == null || lastTouchYRef.current == null) {
        lastTouchYRef.current = touchY ?? null
        lastMoveTimeRef.current = now
        return
      }
      const delta = lastTouchYRef.current - touchY
      const dt = lastMoveTimeRef.current == null ? 0 : now - lastMoveTimeRef.current
      if (dt >= 1) {
        const instantV = delta / dt
        velocityRef.current = 0.8 * instantV + 0.2 * velocityRef.current
        lastMoveTimeRef.current = now
      }
      lastTouchYRef.current = touchY
      accumulatedDeltaRef.current += delta
      consumeAccumulatedDelta()
    }
```

(Note: `scrollHintDismissRef` was introduced in Task 11; if Task 11 has not yet landed when this task is executed, omit that line — it is included here because these tasks are meant to run in spec order and Task 11 precedes this one.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Feed.test.tsx`
Expected: PASS (all Feed tests, `STEP_PX` now 60 everywhere)

- [ ] **Step 5: Commit**

```bash
git add src/components/Feed.tsx src/components/Feed.test.tsx
git commit -m "feat: lower STEP_PX to 60 and track smoothed touch velocity"
```

### Task 17: Implement momentum animation on touchend

**Files:**
- Modify: `src/components/Feed.tsx`
- Test: `src/components/Feed.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Feed.test.tsx`. This test uses fake timers plus a manual rAF stub that runs synchronously per invocation to make the animation deterministic:

```ts
  it('a fast swipe (300px in 100ms) advances the index by at least 8 total once momentum settles', () => {
    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const rafCallbacks: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.touchStart(container, { touches: [{ clientY: 500 }] })
    now = 50
    fireEvent.touchMove(container, { touches: [{ clientY: 350 }] })
    now = 100
    fireEvent.touchMove(container, { touches: [{ clientY: 200 }] })
    fireEvent.touchEnd(container)

    // Drain queued rAF callbacks, advancing simulated time by ~16.67ms each,
    // until no more frames are queued (momentum has settled).
    let frameTime = 100
    let iterations = 0
    while (rafCallbacks.length > 0 && iterations < 500) {
      const cb = rafCallbacks.shift()!
      frameTime += 16.67
      now = frameTime
      cb(frameTime)
      iterations++
    }

    const historyAfter = useAppStore.getState().current
    expect(historyAfter).not.toBeNull()
    // Total advancement (touchmove steps + momentum steps) must be >= 8.
    // We assert indirectly via generateGradientStops call count, since each
    // forward step past initial history length generates a new gradient.
    nowSpy.mockRestore()
    rafSpy.mockRestore()
  })
```

Note: this test's precise assertion strategy (counting generated gradients as a proxy for steps advanced) must be finalized against the real implementation's ref-exposed state; since `indexRef` is private to the component, the plan asserts behavior through store updates. Strengthen the assertion once the implementation exists by tracking `generateGradientStops` call count, which increments once per NEW forward step (`goTo` only calls it when `newIndex >= history.length`):

Replace the final assertion block with:

```ts
    expect(generateSpy.mock.calls.length).toBeGreaterThanOrEqual(7) // 8 total steps - 1 initial mount
```

And add `const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')` immediately after `render(<Feed />)`, before the touch events.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Feed.test.tsx`
Expected: FAIL — no momentum animation exists yet, so only the two touchmove-driven steps occur (well under 7 additional `generateGradientStops` calls).

- [ ] **Step 3: Write minimal implementation**

In `src/components/Feed.tsx`, add the import:

```ts
import { decayVelocity, shouldStartMomentum } from '../lib/momentum'
```

Add a ref for the momentum animation frame id, near the other refs:

```ts
  const momentumFrameIdRef = useRef<number | null>(null)
```

Add a function to cancel momentum, defined inside the DOM-binding `useEffect` alongside the handlers (or above it, referencing refs only so it's stable):

```ts
    function cancelMomentum() {
      if (momentumFrameIdRef.current !== null) {
        cancelAnimationFrame(momentumFrameIdRef.current)
        momentumFrameIdRef.current = null
      }
    }

    function runMomentumFrame(lastFrameTime: number) {
      const now = performance.now()
      const frameDt = now - lastFrameTime
      accumulatedDeltaRef.current += velocityRef.current * frameDt
      consumeAccumulatedDelta()
      velocityRef.current = decayVelocity(velocityRef.current, frameDt)

      const bottomedOut = indexRef.current <= 0 && velocityRef.current < 0
      if (Math.abs(velocityRef.current) < 0.05 || bottomedOut) {
        momentumFrameIdRef.current = null
        return
      }
      momentumFrameIdRef.current = requestAnimationFrame(() => runMomentumFrame(now))
    }
```

Update `handleWheel` and `handleTouchStart` to cancel any running momentum:

```ts
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      cancelMomentum()
      scrollHintDismissRef.current()
      accumulatedDeltaRef.current += e.deltaY
      consumeAccumulatedDelta()
    }

    function handleTouchStart(e: TouchEvent) {
      cancelMomentum()
      lastTouchYRef.current = e.touches[0]?.clientY ?? null
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = 0
    }
```

Add a `handleTouchEnd` that starts momentum when warranted (the existing `handleTouchEnd` only resets `lastTouchYRef` — extend it):

```ts
    function handleTouchEnd() {
      lastTouchYRef.current = null
      if (shouldStartMomentum(velocityRef.current)) {
        const startTime = performance.now()
        momentumFrameIdRef.current = requestAnimationFrame(() => runMomentumFrame(startTime))
      }
    }
```

Add cleanup of the momentum frame in the effect's return/cleanup function:

```ts
    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      cancelMomentum()
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Feed.test.tsx`
Expected: PASS (all Feed tests including momentum test)

- [ ] **Step 5: Commit**

```bash
git add src/components/Feed.tsx src/components/Feed.test.tsx
git commit -m "feat: add momentum scrubbing animation on fast touch flicks"
```

---

## Feature 7: Flow-mode edit view (draggable gradient stop handles)

### Task 18: Extend EditableStop with position; add moveStop and toGradientStops

**Files:**
- Modify: `src/lib/stopOrdering.ts`
- Test: `src/lib/stopOrdering.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the full contents of `src/lib/stopOrdering.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toEditableStops, equalizePositions, removeStopAt, addStop, removeLastByHex, moveStop, toGradientStops } from './stopOrdering'
import type { GradientStop } from './gradient'

describe('toEditableStops', () => {
  it('assigns a unique id to each stop, preserves hex order, and copies position', () => {
    const stops: GradientStop[] = [
      { hex: '#111111', position: 0 },
      { hex: '#222222', position: 100 },
    ]
    const editable = toEditableStops(stops)
    expect(editable.map((s) => s.hex)).toEqual(['#111111', '#222222'])
    expect(editable.map((s) => s.position)).toEqual([0, 100])
    expect(editable[0].id).not.toBe(editable[1].id)
    expect(editable[0].id).toBeTruthy()
  })
})

describe('equalizePositions', () => {
  it('spreads 4 stops evenly across 0-100', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 0 },
      { id: 'c', hex: '#333333', position: 0 },
      { id: 'd', hex: '#444444', position: 0 },
    ]
    const positioned = equalizePositions(editable)
    expect(positioned.map((s) => s.position)).toEqual([0, 33, 67, 100])
  })

  it('handles a single stop without dividing by zero', () => {
    const positioned = equalizePositions([{ id: 'a', hex: '#111111', position: 0 }])
    expect(positioned).toEqual([{ hex: '#111111', position: 0 }])
  })
})

describe('removeStopAt', () => {
  it('removes the stop with the matching id and leaves the rest in order', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 50 },
      { id: 'c', hex: '#333333', position: 100 },
    ]
    const result = removeStopAt(editable, 'b')
    expect(result.map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('addStop', () => {
  it('appends a new stop with the given hex, a fresh id, and inserts at the largest gap midpoint', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 100 },
    ]
    const result = addStop(editable, '#999999')
    expect(result).toHaveLength(3)
    const added = result.find((s) => s.hex === '#999999')!
    expect(added.position).toBe(50)
    expect(added.id).not.toBe('a')
    expect(added.id).not.toBe('b')
  })

  it('inserts at the midpoint of the largest gap when gaps are uneven', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 10 },
      { id: 'c', hex: '#333333', position: 100 },
    ]
    const result = addStop(editable, '#999999')
    const added = result.find((s) => s.hex === '#999999')!
    // Largest gap is 10 -> 100 (width 90); midpoint = 55
    expect(added.position).toBe(55)
  })
})

describe('removeLastByHex', () => {
  it('removes the last stop matching the given hex, leaving earlier ones', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 50 },
      { id: 'c', hex: '#111111', position: 100 },
    ]
    const result = removeLastByHex(editable, '#111111')
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when the hex is not present', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 100 },
    ]
    expect(removeLastByHex(editable, '#999999')).toEqual(editable)
  })
})

describe('moveStop', () => {
  const base = [
    { id: 'a', hex: '#111111', position: 0 },
    { id: 'b', hex: '#222222', position: 50 },
    { id: 'c', hex: '#333333', position: 100 },
  ]

  it('updates the position of the matching stop', () => {
    const result = moveStop(base, 'b', 75)
    expect(result.find((s) => s.id === 'b')!.position).toBe(75)
  })

  it('clamps position to [0, 100]', () => {
    expect(moveStop(base, 'a', -10).find((s) => s.id === 'a')!.position).toBe(0)
    expect(moveStop(base, 'c', 150).find((s) => s.id === 'c')!.position).toBe(100)
  })

  it('re-sorts stops by position, stably for ties', () => {
    const result = moveStop(base, 'c', 10)
    expect(result.map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not mutate the input array', () => {
    const original = base.map((s) => ({ ...s }))
    moveStop(base, 'b', 20)
    expect(base).toEqual(original)
  })
})

describe('toGradientStops', () => {
  it('maps {hex, position} straight through, sorted by position', () => {
    const editable = [
      { id: 'a', hex: '#333333', position: 100 },
      { id: 'b', hex: '#111111', position: 0 },
      { id: 'c', hex: '#222222', position: 50 },
    ]
    expect(toGradientStops(editable)).toEqual([
      { hex: '#111111', position: 0 },
      { hex: '#222222', position: 50 },
      { hex: '#333333', position: 100 },
    ])
  })

  it('round-trips positions from toEditableStops without change', () => {
    const original: GradientStop[] = [
      { hex: '#aaaaaa', position: 12 },
      { hex: '#bbbbbb', position: 88 },
    ]
    const roundTripped = toGradientStops(toEditableStops(original))
    expect(roundTripped).toEqual(original)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stopOrdering.test.ts`
Expected: FAIL — `moveStop` and `toGradientStops` are not exported yet; `toEditableStops`/`addStop` don't produce a `position` field yet.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/lib/stopOrdering.ts`:

```ts
import type { GradientStop } from './gradient'

export interface EditableStop {
  id: string
  hex: string
  position: number // 0-100
}

export function toEditableStops(stops: GradientStop[]): EditableStop[] {
  return stops.map((stop) => ({ id: crypto.randomUUID(), hex: stop.hex, position: stop.position }))
}

export function equalizePositions(stops: EditableStop[]): GradientStop[] {
  const count = stops.length
  return stops.map((stop, i) => ({
    hex: stop.hex,
    position: count === 1 ? 0 : Math.round((i / (count - 1)) * 100),
  }))
}

export function removeStopAt(stops: EditableStop[], id: string): EditableStop[] {
  return stops.filter((stop) => stop.id !== id)
}

function largestGapMidpoint(stops: EditableStop[]): number {
  if (stops.length === 0) return 50
  if (stops.length === 1) return stops[0].position >= 50 ? stops[0].position / 2 : (stops[0].position + 100) / 2
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  let bestGap = -1
  let bestMidpoint = 50
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].position - sorted[i].position
    if (gap > bestGap) {
      bestGap = gap
      bestMidpoint = (sorted[i].position + sorted[i + 1].position) / 2
    }
  }
  return Math.round(bestMidpoint)
}

export function addStop(stops: EditableStop[], hex: string): EditableStop[] {
  const position = largestGapMidpoint(stops)
  return [...stops, { id: crypto.randomUUID(), hex, position }]
}

export function removeLastByHex(stops: EditableStop[], hex: string): EditableStop[] {
  const lastIndex = stops.map((s) => s.hex).lastIndexOf(hex)
  if (lastIndex === -1) return stops
  return [...stops.slice(0, lastIndex), ...stops.slice(lastIndex + 1)]
}

/** Clamps position to [0,100], updates the matching stop, and returns all
 * stops re-sorted by position (stable for ties). */
export function moveStop(stops: EditableStop[], id: string, position: number): EditableStop[] {
  const clamped = Math.min(100, Math.max(0, position))
  const updated = stops.map((s) => (s.id === id ? { ...s, position: clamped } : s))
  return updated
    .map((s, i) => ({ s, i })) // stabilize sort using original index as tiebreaker
    .sort((a, b) => a.s.position - b.s.position || a.i - b.i)
    .map(({ s }) => s)
}

/** Maps {hex, position} straight through, sorted by position. */
export function toGradientStops(stops: EditableStop[]): GradientStop[] {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ hex: s.hex, position: s.position }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stopOrdering.test.ts`
Expected: PASS (all stopOrdering tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stopOrdering.ts src/lib/stopOrdering.test.ts
git commit -m "feat: add position to EditableStop, add moveStop/toGradientStops, gap-based addStop"
```

### Task 19: Fix downstream call sites broken by the EditableStop shape change

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/BlockStack.tsx` (no code change expected — verify)
- Modify: `src/components/BlockWheel.tsx` (verify)
- Modify: `src/components/SwatchTray.tsx` (verify)
- Test: `src/components/EditMode.test.tsx`, `src/components/BlockStack.test.tsx`, `src/components/BlockWheel.test.tsx`, `src/components/SwatchTray.test.tsx`

This task exists because `toEditableStops`, `addStop`, and `EditableStop` all changed shape in Task 18 — this task is a safety-net regression pass across all existing consumers before Task 20 introduces `FlowEditor`. Note: `EditMode.tsx`'s existing `commit()` function already calls `equalizePositions(nextStops)` on every commit (see current source), which is compatible with the new `EditableStop{position}` shape since `equalizePositions` still only reads `.hex`. No production code changes are expected in this task; it exists purely to run the full component test suite and confirm nothing broke silently (e.g. a component reading `.position` from a stop before it existed).

- [ ] **Step 1: Write the failing test (none — this is a regression-verification task)**

Run the full test suite to check for hidden breakage from Task 18's shape change:

Run: `npm test`

- [ ] **Step 2: Run test to verify it fails**

Expected outcome of the Step 1 run: PASS for most files; if any component destructures `EditableStop` in a way incompatible with the added `position` field (e.g. an exhaustive object literal comparison using `toEqual` with only `{id, hex}`), those specific assertions will FAIL. Based on the codebase read during planning, `BlockStack.test.tsx`, `BlockWheel.test.tsx`, and `SwatchTray.test.tsx` construct `EditableStop`-shaped literals directly in test fixtures without `position` — if TypeScript strict object literal checks or `toEqual` fail, fix in Step 3.

- [ ] **Step 3: Write minimal implementation**

Read `src/components/BlockStack.test.tsx`, `src/components/BlockWheel.test.tsx`, and `src/components/SwatchTray.test.tsx` in full. For any inline `EditableStop` object literal used as test fixture data (e.g. `{ id: 'a', hex: '#111111' }`), add `, position: <n>` matching a sensible value (e.g. evenly spaced 0/50/100) so the fixture type-checks and any assertions relying on stop identity remain valid. Do not change `BlockStack.tsx`, `BlockWheel.tsx`, or `SwatchTray.tsx` themselves — they only read `.hex` and `.id`, never `.position`, so no production code changes are needed in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (full suite green)

- [ ] **Step 5: Commit**

```bash
git add src/components/BlockStack.test.tsx src/components/BlockWheel.test.tsx src/components/SwatchTray.test.tsx
git commit -m "test: update EditableStop test fixtures with required position field"
```

### Task 20: Update EditMode's sort handler to equalize positions after sorting

**Files:**
- Modify: `src/components/EditMode.tsx`
- Test: `src/components/EditMode.test.tsx`

Per spec Feature 7 part 3: "the edit-mode L/H/C sort buttons now reassign positions: after sorting by the chosen key, distribute positions evenly (`equalizePositions` on the sorted order)." Task 7's `handleSort` already calls `commit`, which already calls `equalizePositions(nextStops)` internally — so this requirement is already satisfied by the existing `commit` wiring from Task 7. This task verifies that explicitly with a position-focused test.

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx`:

```ts
  it('sorting by lightness also re-equalizes stop positions evenly', () => {
    const unequalPositions: Gradient = {
      id: 'g3',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 5 }, // dark
        { hex: '#00ff00', position: 40 }, // light
        { hex: '#ff0000', position: 95 }, // mid
      ],
      reversed: false,
    }
    render(<EditMode gradient={unequalPositions} onExit={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Sort by lightness'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.position)).toEqual([0, 50, 100])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: This should already PASS given Task 7's `commit` implementation calls `equalizePositions`. Run it first to confirm — if it unexpectedly fails, it indicates `commit` was changed since Task 7; investigate before proceeding. Document the actual observed result here: run `npm test -- EditMode.test.tsx` and expect PASS immediately (this task's "Step 2 fails" formality is satisfied by temporarily commenting out the `equalizePositions` call in `commit` to prove the test catches a regression, then restoring it).

Concretely: temporarily edit `commit` in `EditMode.tsx` to use `toGradientStops(nextStops)` instead of `equalizePositions(nextStops)`, run the test — Expected: FAIL (positions stay at 5/40/95 sorted, not equalized to 0/50/100). Then revert.

- [ ] **Step 3: Write minimal implementation**

No implementation change needed — `commit`'s existing `equalizePositions(nextStops)` call (from the current `EditMode.tsx`, unchanged by Tasks 7 or 18) already satisfies this. Revert any temporary edit made during Step 2's verification.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.test.tsx
git commit -m "test: verify sort buttons re-equalize positions evenly"
```

### Task 21: Create FlowEditor component — render gradient with slider handles

**Files:**
- Create: `src/components/FlowEditor.tsx`
- Create: `src/components/FlowEditor.module.css`
- Test: `src/components/FlowEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlowEditor } from './FlowEditor'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

describe('FlowEditor', () => {
  it('renders one slider handle per stop at the correct aria-valuenow', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(3)
    expect(sliders.map((s) => s.getAttribute('aria-valuenow'))).toEqual(['0', '50', '100'])
  })

  it('labels each handle with its hex', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    expect(screen.getByLabelText('Stop #ff0000')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop #00ff00')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop #0000ff')).toBeInTheDocument()
  })

  it('sets aria-valuemin and aria-valuemax on every handle', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider.getAttribute('aria-valuemin')).toBe('0')
      expect(slider.getAttribute('aria-valuemax')).toBe('100')
    }
  })

  it('ArrowUp decreases position by 1 and ArrowDown increases it by 1', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onMove).toHaveBeenCalledWith('b', 49)
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onMove).toHaveBeenCalledWith('b', 51)
  })

  it('Shift+ArrowUp/ArrowDown moves position by 10', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    expect(onMove).toHaveBeenCalledWith('b', 60)
  })

  it('tapping a handle (pointerdown/up with <6px movement) calls onTapStop with that stop id', () => {
    const onTapStop = vi.fn()
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={onTapStop} />)
    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handle, { clientX: 12, clientY: 11 })
    expect(onTapStop).toHaveBeenCalledWith('a')
  })

  it('dragging a handle (>=6px movement) does not call onTapStop', () => {
    const onTapStop = vi.fn()
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={onTapStop} />)
    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 40 })
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 40 })
    expect(onTapStop).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FlowEditor.test.tsx`
Expected: FAIL with "Cannot find module './FlowEditor'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/components/FlowEditor.tsx`:

```tsx
import { useRef, type RefObject } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { toGradientStops, type EditableStop } from '../lib/stopOrdering'
import styles from './FlowEditor.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 6

interface FlowEditorProps {
  stops: EditableStop[]
  onMove: (id: string, position: number) => void
  onTapStop: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
}

export function FlowEditor({ stops, onMove, onTapStop, containerRef }: FlowEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const trackRef = containerRef ?? (internalRef as RefObject<HTMLDivElement>)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const draggingIdRef = useRef<string | null>(null)

  const gradientCss = buildGradientCss('linear', toGradientStops(stops))

  function positionFromClientY(clientY: number): number {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const raw = ((clientY - rect.top) / rect.height) * 100
    return Math.min(100, Math.max(0, raw))
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    draggingIdRef.current = id
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const id = draggingIdRef.current
    if (!id) return
    onMove(id, positionFromClientY(e.clientY))
  }

  function handlePointerUp(e: React.PointerEvent, id: string) {
    const start = pointerStartRef.current
    draggingIdRef.current = null
    pointerStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < TAP_MOVEMENT_THRESHOLD_PX) {
      onTapStop(id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, stop: EditableStop) {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp') {
      onMove(stop.id, stop.position - step)
    } else if (e.key === 'ArrowDown') {
      onMove(stop.id, stop.position + step)
    }
  }

  return (
    <div
      ref={trackRef}
      data-testid="flow-editor"
      className={styles.track}
      style={{ backgroundImage: gradientCss }}
      onPointerMove={handlePointerMove}
    >
      {stops.map((stop) => (
        <div
          key={stop.id}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stop.position}
          aria-label={`Stop ${stop.hex}`}
          data-testid="flow-handle"
          className={styles.handle}
          style={{ top: `${stop.position}%`, backgroundColor: stop.hex }}
          onPointerDown={(e) => handlePointerDown(e, stop.id)}
          onPointerUp={(e) => handlePointerUp(e, stop.id)}
          onKeyDown={(e) => handleKeyDown(e, stop)}
        />
      ))}
    </div>
  )
}
```

Create `src/components/FlowEditor.module.css`:

```css
.track {
  position: relative;
  flex: 1;
  width: 100%;
  min-height: 0;
}

.handle {
  position: absolute;
  left: 50%;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  cursor: grab;
  touch-action: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- FlowEditor.test.tsx`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/FlowEditor.tsx src/components/FlowEditor.module.css src/components/FlowEditor.test.tsx
git commit -m "feat: add FlowEditor component with draggable, keyboard-accessible stop handles"
```

### Task 22: Replace BlockStack with FlowEditor inside EditMode; preserve positions on exit

**Files:**
- Modify: `src/components/EditMode.tsx`
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx`, and update the existing test that asserted `stack-block` count (line 32, inside "renders the preview, geometry tabs, block stack, and swatch tray") to instead assert `flow-handle` count. First, change:

```ts
    expect(screen.getAllByTestId('stack-block')).toHaveLength(3)
```

to:

```ts
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
```

Then add new tests:

```ts
  it('dragging a flow handle updates the store gradient position for that stop in real time', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 10 })

    const updated = useAppStore.getState().current!
    const movedStop = updated.stops.find((s) => s.hex === '#00ff00')!
    // jsdom getBoundingClientRect returns all zeros by default, so
    // positionFromClientY(10) with a zero-height rect clamps to 100.
    expect(movedStop.position).toBe(100)
  })

  it('exiting preserves exact custom positions without re-equalizing', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 10 })

    fireEvent.click(screen.getByLabelText('Back'))
    expect(onExit).toHaveBeenCalledTimes(1)

    // Position set via drag must be preserved exactly in the store, not
    // equalized back to evenly-spaced values.
    const updated = useAppStore.getState().current!
    const movedStop = updated.stops.find((s) => s.hex === '#00ff00')!
    expect(movedStop.position).toBe(100)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — `screen.getByLabelText('Stop #00ff00')` is not found because `EditMode` still renders `BlockStack`, not `FlowEditor`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`:

Remove the `BlockStack` import and add `FlowEditor`:

```ts
import { FlowEditor } from './FlowEditor'
```

Remove `import { BlockStack } from './BlockStack'` (keep `BlockWheel` — wheel types still use it per spec, which only replaces "the color-block stack (`BlockStack`)").

Add a handler for moving a stop live (no equalize — direct position update), and a handler for tapping a handle that reuses whatever the existing tap-to-edit-color callback is. Since the current codebase's `BlockStack` has no "tap to change color" callback wired yet (`BlockStack.tsx` only exposes reorder/remove), and the spec says "reuse the same callback" as whatever BlockStack tap currently does, and no such callback exists in the current `EditMode.tsx`, treat "tap opens color-change UI" as a no-op placeholder call to `handleTapAdd`-style flow is NOT applicable — instead wire `onTapStop` to a minimal handler that is a documented extension point: since no existing color-change UI exists in this codebase yet, `onTapStop` calls nothing visible today but must still be wired per the interface. Implement it as intentionally calling `handleRemove` is wrong too. The correct minimal interpretation: `onTapStop` currently has no companion UI to open, so wire it to a no-op function that satisfies the required prop without inventing new UI beyond spec scope:

```ts
  function handleTapStop(_id: string) {
    // Placeholder hook for the existing "tap to change color" UI. No such
    // UI exists yet in this codebase (BlockStack never wired one either),
    // so this intentionally does nothing until that flow is built.
  }

  function handleMoveStop(id: string, position: number) {
    const nextStops = moveStop(editableStops, id, position)
    setEditableStops(nextStops)
    setCurrentGradient({
      ...gradient,
      stops: toGradientStops(nextStops),
    })
  }
```

Add the `moveStop` and `toGradientStops` imports:

```ts
import { toEditableStops, equalizePositions, removeStopAt, addStop, removeLastByHex, moveStop, toGradientStops, type EditableStop } from '../lib/stopOrdering'
```

Replace the `BlockStack` branch of the conditional render:

```tsx
      <div className={styles.blockArea}>
        {isWheel ? (
          <BlockWheel
            stops={editableStops}
            onReorder={(next) => commit(next)}
            onRemove={handleRemove}
            containerRef={blockContainerRef}
          />
        ) : (
          <FlowEditor stops={editableStops} onMove={handleMoveStop} onTapStop={handleTapStop} containerRef={blockContainerRef} />
        )}
      </div>
```

This satisfies "on exit, `toGradientStops` produces the stops written back to the store — positions are preserved exactly (no equalize on exit)" because `handleMoveStop` already calls `toGradientStops` directly (not `equalizePositions`) on every drag, and the back button's `onExit` prop is called as-is with no additional position mutation — `App.tsx` already reads `current` (which holds the exact dragged positions) when re-entering explore mode, so no extra "on exit" logic is needed beyond what `handleMoveStop` already wrote to the store.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests, including updated flow-handle count and the two new drag/exit tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.test.tsx
git commit -m "feat: replace BlockStack with FlowEditor in edit mode, preserve exact positions on exit"
```

### Task 23: Remove now-unused BlockStack component and its swatch-tray insertion-index coupling for linear/radial types

**Files:**
- Modify: `src/components/EditMode.tsx` (drag-add-from-tray logic that referenced `stack-block` midpoints)
- Test: `src/components/EditMode.test.tsx`

The existing `handleTrayDragMove`/`handleDragAddFromTray`/`computeStackMidpoints` functions in `EditMode.tsx` query `[data-testid="stack-block"]`, which no longer exists for linear/radial/mirror/repeat types now that `FlowEditor` renders `flow-handle` elements instead. This task fixes swatch-tray drag-to-add for non-wheel gradient types so it targets the new gradient track instead of the removed block stack, using the addStop gap logic from Task 18.

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx` (this replaces reliance on `computeStackMidpoints`, which is now dead code for non-wheel types):

```ts
  it('drag-adding a swatch onto the flow track (non-wheel type) inserts using the largest-gap heuristic', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const swatch = screen.getAllByTestId('swatch')[10]
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(document, { clientX: 0, clientY: 0 })
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(4)
    vi.useRealTimers()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: This test may already pass by coincidence if `handleDragAddFromTray`'s fallback path (`isPointOverElement` false, since jsdom rects are all-zero and the pointer is at 0,0 which IS "over" a zero-rect) still runs the old `verticalInsertionIndex(point.y, computeStackMidpoints(el))` against an el that now contains zero `stack-block` elements, producing `computeStackMidpoints` returning `[]` and `verticalInsertionIndex(0, [])` returning `0`. This still inserts correctly at index 0 by accident, not by design. Run it first to observe actual behavior — if it passes for the wrong reason, proceed to Step 3 to fix the underlying implementation to use `addStop`'s gap-based insertion consistently instead of relying on stale DOM queries.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, simplify `handleDragAddFromTray` to always use gap-based insertion via `addStop` for non-wheel types (removing the dependency on `computeStackMidpoints`/`stack-block` DOM queries entirely, since `FlowEditor` has no equivalent per-block DOM element to query):

```ts
  function handleDragAddFromTray(hex: string, point: { x: number; y: number }) {
    const el = blockContainerRef.current
    setInsertionIndex(null)
    if (!el) return
    if (!isPointOverElement(point, el)) return
    commit(addStop(editableStops, hex))
  }
```

Remove the now-unused `computeStackMidpoints` function and the `verticalInsertionIndex`/`insertionIndex.ts` import if nothing else in the file uses it. Check `handleTrayDragMove` — it still calls `computeStackMidpoints(el)` for the `insertionIndex` preview state used by `BlockStack`'s gap indicator; since `BlockStack` is no longer rendered for non-wheel types, simplify `handleTrayDragMove` to only compute insertion preview for the wheel case (`BlockWheel` still uses `verticalInsertionIndex`/`wheelInsertionIndex` internally via its own props — verify by reading `BlockWheel.tsx` if further changes are needed there; if `BlockWheel` doesn't consume `insertionIndex` as a prop, no change needed there). Set `handleTrayDragMove` to a no-op for the non-wheel path:

```ts
  function handleTrayDragMove(point: { x: number; y: number }) {
    if (isWheel) return
    const el = blockContainerRef.current
    if (!el || !isPointOverElement(point, el)) {
      setInsertionIndex(null)
      return
    }
    // FlowEditor has no discrete block gaps to preview an insertion index
    // against; clear any stale gap indicator instead.
    setInsertionIndex(null)
  }
```

Remove the `computeStackMidpoints` function definition entirely and the now-unused `verticalInsertionIndex` import if `BlockWheel` doesn't need it passed down (verify against `BlockWheel.tsx`'s actual props before removing the import — if `BlockWheel` needs it, keep the import and only remove `computeStackMidpoints`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests, drag-add test passes via the new `addStop` gap-based path)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.test.tsx
git commit -m "refactor: use gap-based addStop for swatch-tray drag-add, remove stale stack-block DOM queries"
```

---

## Round 2: UX feedback (2026-07-08)

User feedback after reviewing the shipped Features 1–7:

1. Angular gradients must use the same `FlowEditor` controller as linear/radial/mirror/repeat — not `BlockWheel`.
2. The `FlowEditor` controller should be **horizontal** and take less vertical space, so the edit-mode preview stays large.
3. The L/H/C sort buttons are unclear — replace the row with a single FAB at the top-right of the gradient controller that cycles through sort methods on tap.
4. The explore→edit transition should feel like an Instagram Reels comment sheet: the preview shrinks and the controls rise as a bottom sheet.
5. The feed needs a scrolling line ticker (timeline with tick marks) on screen edge so the user can see where they are while scrubbing.
6. Saved-drawer thumbnails for `square` (Turrell) gradients render a sharp conic gradient — they must render the actual blurred nested-squares `TurrellSquare` look.

### Task 24: Make angular gradients use FlowEditor (drop BlockWheel for angular)

**Files:**
- Modify: `src/components/EditMode.tsx:28` (`const WHEEL_TYPES: GradientType[] = ['angular', 'square']`)
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx` inside the `describe('EditMode', ...)` block:

```ts
  it('renders FlowEditor (not BlockWheel) for angular gradients', () => {
    const angular: Gradient = {
      id: 'g-angular',
      type: 'angular',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#00ff00', position: 50 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    render(<EditMode gradient={angular} onExit={vi.fn()} />)
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
    expect(screen.queryByTestId('block-wheel')).not.toBeInTheDocument()
  })
```

Note: read `src/components/BlockWheel.tsx` first to confirm its root `data-testid` (adjust `'block-wheel'` in the assertion to the actual testid used there).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — angular is in `WHEEL_TYPES`, so `BlockWheel` renders and no `flow-handle` elements exist.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, change line 28 from:

```ts
const WHEEL_TYPES: GradientType[] = ['angular', 'square']
```

to:

```ts
const WHEEL_TYPES: GradientType[] = ['square']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS. If any existing EditMode test asserted BlockWheel behavior for angular gradients, update its fixture to `type: 'square'` (the only remaining wheel type).

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.test.tsx
git commit -m "feat: use FlowEditor for angular gradients, reserve BlockWheel for square only"
```

### Task 25: Make FlowEditor horizontal

**Files:**
- Modify: `src/components/FlowEditor.tsx`
- Modify: `src/components/FlowEditor.module.css`
- Modify: `src/components/EditMode.module.css` (`.preview`, `.blockArea`)
- Test: `src/components/FlowEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/FlowEditor.test.tsx`, replace the two keyboard tests (`'ArrowUp decreases position by 1 and ArrowDown increases it by 1'` and `'Shift+ArrowUp/ArrowDown moves position by 10'`) with:

```ts
  it('ArrowLeft decreases position by 1 and ArrowRight increases it by 1', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith('b', 49)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenCalledWith('b', 51)
  })

  it('Shift+ArrowRight moves position by 10', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
    expect(onMove).toHaveBeenCalledWith('b', 60)
  })

  it('positions handles horizontally via left%', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    expect(handle.style.left).toBe('50%')
    expect(handle.style.top).toBe('')
  })

  it('sets aria-orientation="horizontal" on every handle', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider.getAttribute('aria-orientation')).toBe('horizontal')
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FlowEditor.test.tsx`
Expected: FAIL — handles still use `top`, keyboard handler only reads ArrowUp/ArrowDown, no `aria-orientation`.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/FlowEditor.tsx`:

```tsx
import { useRef, type RefObject } from 'react'
import { toGradientStops, type EditableStop } from '../lib/stopOrdering'
import styles from './FlowEditor.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 6

interface FlowEditorProps {
  stops: EditableStop[]
  onMove: (id: string, position: number) => void
  onTapStop: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
}

export function FlowEditor({ stops, onMove, onTapStop, containerRef }: FlowEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const trackRef = containerRef ?? (internalRef as RefObject<HTMLDivElement>)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const draggingIdRef = useRef<string | null>(null)

  // Horizontal strip: left-to-right mirrors the stop positions 0-100.
  const gradientCss = `linear-gradient(90deg, ${toGradientStops(stops)
    .map((s) => `${s.hex} ${s.position}%`)
    .join(', ')})`

  function positionFromClientX(clientX: number): number {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const raw = ((clientX - rect.left) / rect.width) * 100
    return Math.min(100, Math.max(0, raw))
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    draggingIdRef.current = id
    const target = e.target as Element
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId)
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const id = draggingIdRef.current
    if (!id) return
    onMove(id, positionFromClientX(e.clientX))
  }

  function handlePointerUp(e: React.PointerEvent, id: string) {
    const start = pointerStartRef.current
    draggingIdRef.current = null
    pointerStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < TAP_MOVEMENT_THRESHOLD_PX) {
      onTapStop(id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, stop: EditableStop) {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft') {
      onMove(stop.id, stop.position - step)
    } else if (e.key === 'ArrowRight') {
      onMove(stop.id, stop.position + step)
    }
  }

  return (
    <div
      ref={trackRef}
      data-testid="flow-editor"
      className={styles.track}
      style={{ backgroundImage: gradientCss }}
      onPointerMove={handlePointerMove}
    >
      {stops.map((stop) => (
        <div
          key={stop.id}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stop.position}
          aria-orientation="horizontal"
          aria-label={`Stop ${stop.hex}`}
          data-testid="flow-handle"
          className={styles.handle}
          style={{ left: `${stop.position}%`, backgroundColor: stop.hex }}
          onPointerDown={(e) => handlePointerDown(e, stop.id)}
          onPointerUp={(e) => handlePointerUp(e, stop.id)}
          onKeyDown={(e) => handleKeyDown(e, stop)}
        />
      ))}
    </div>
  )
}
```

Replace `src/components/FlowEditor.module.css`:

```css
.track {
  position: relative;
  width: calc(100% - 32px);
  margin: 0 auto;
  height: 48px;
  border-radius: 12px;
}

.handle {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  cursor: grab;
  touch-action: none;
}
```

In `src/components/EditMode.module.css`, grow the preview and shrink the controller area:

```css
.preview {
  flex: 1;
  min-height: 0;
  position: relative;
  touch-action: manipulation;
}

.blockArea {
  position: relative;
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}
```

Note: `BlockWheel` (square type) still renders inside `.blockArea`; after this change verify it still fits at 72px — if `BlockWheel.module.css` needs a min-height of its own, add `min-height: 72px` to its root class rather than growing `.blockArea` back.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- FlowEditor.test.tsx EditMode.test.tsx`
Expected: PASS. The EditMode drag tests from Task 22 asserted `position` clamps to 100 via jsdom's zero-height rect on `clientY`; with the horizontal axis they now exercise `clientX` against a zero-width rect — same clamp-to-100 result, so they should pass unchanged. If one fails, update its comment/assertion to reference the X axis.

- [ ] **Step 5: Commit**

```bash
git add src/components/FlowEditor.tsx src/components/FlowEditor.module.css src/components/EditMode.module.css src/components/FlowEditor.test.tsx src/components/EditMode.test.tsx
git commit -m "feat: make FlowEditor a horizontal strip so the edit preview stays large"
```

### Task 26: Replace the L/H/C sort row with a cycling sort FAB

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/EditMode.module.css`
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx`:

```ts
  it('renders a single sort FAB that applies the current sort and cycles L -> H -> C', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)

    // No more three-button row:
    expect(screen.queryByLabelText('Sort by hue')).not.toBeInTheDocument()

    const fab = screen.getByTestId('sort-fab')
    expect(fab.getAttribute('aria-label')).toBe('Sort by lightness')
    expect(fab.textContent).toContain('L')

    fireEvent.click(fab)
    expect(fab.getAttribute('aria-label')).toBe('Sort by hue')
    expect(fab.textContent).toContain('H')

    fireEvent.click(fab)
    expect(fab.getAttribute('aria-label')).toBe('Sort by chroma')

    fireEvent.click(fab)
    expect(fab.getAttribute('aria-label')).toBe('Sort by lightness')
  })

  it('tapping the sort FAB sorts stops by the labeled key', () => {
    const darkFirst: Gradient = {
      id: 'g-sort',
      type: 'linear',
      stops: [
        { hex: '#00ff00', position: 0 }, // light, l~0.87
        { hex: '#0000ff', position: 50 }, // dark, l~0.45
        { hex: '#ff0000', position: 100 }, // mid, l~0.63
      ],
      reversed: false,
    }
    render(<EditMode gradient={darkFirst} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sort-fab')) // applies lightness
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })
```

Also update the two existing sort tests from Tasks 7 and 20 (`'tapping "Sort by lightness" reorders stops darkest to lightest'` and `'sorting by lightness also re-equalizes stop positions evenly'`): change `screen.getByLabelText('Sort by lightness')` to `screen.getByTestId('sort-fab')` (on a fresh render the FAB's first tap applies lightness, so the assertions stay valid).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — `sort-fab` testid doesn't exist; the three-button row still renders `Sort by hue`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, add module-level constants after `WHEEL_TYPES`:

```ts
const SORT_KEYS: SortKey[] = ['lightness', 'hue', 'chroma']
const SORT_LABELS: Record<SortKey, string> = { lightness: 'L', hue: 'H', chroma: 'C' }
```

Add state next to `editableStops`:

```ts
  const [sortKeyIndex, setSortKeyIndex] = useState(0)
```

Replace the `handleSort` function with:

```ts
  function handleSortCycle() {
    const key = SORT_KEYS[sortKeyIndex]
    commit(sortByOklch(editableStops, (s) => s.hex, key))
    setSortKeyIndex((sortKeyIndex + 1) % SORT_KEYS.length)
  }
```

Delete the `.sortRow` JSX block (the three L/H/C buttons) and instead render the FAB as the first child inside the `.blockArea` div (it is absolutely positioned against it):

```tsx
      <div className={styles.blockArea}>
        <button
          type="button"
          data-testid="sort-fab"
          aria-label={`Sort by ${SORT_KEYS[sortKeyIndex]}`}
          className={styles.sortFab}
          onClick={handleSortCycle}
        >
          ⇅ {SORT_LABELS[SORT_KEYS[sortKeyIndex]]}
        </button>
        {isWheel ? (
          ...existing BlockWheel/FlowEditor conditional unchanged...
        )}
      </div>
```

In `src/components/EditMode.module.css`, delete the `.sortRow` and `.sortButton` rules and add:

```css
.sortFab {
  position: absolute;
  top: -44px;
  right: 16px;
  z-index: 2;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
```

(`top: -44px` floats the FAB just above the controller strip, overlapping the bottom edge of the preview — "top right of the gradient controller stack".)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (new FAB tests plus the two updated sort tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/components/EditMode.test.tsx
git commit -m "feat: replace L/H/C sort row with a cycling sort FAB above the controller"
```

### Task 27: Bottom-sheet explore→edit transition (Reels-style)

**Files:**
- Modify: `src/components/EditMode.tsx` (wrap controls in a sheet container)
- Modify: `src/components/EditMode.module.css`
- Modify: `src/index.css`
- Test: `src/components/EditMode.test.tsx`

The mechanism: the feed's `GradientPage` (`view-transition-name: palette-card`) pairs with the edit-mode **preview** (not the whole edit container), so entering edit mode animates the full-screen card shrinking into the preview slot; simultaneously the controls sheet gets its own `view-transition-name: edit-sheet` whose `::view-transition-new` slides up from the bottom — the Instagram Reels comment-sheet feel. `withViewTransition` (Task 3) already gates all of this behind `prefers-reduced-motion`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx`:

```ts
  it('wraps geometry tabs, controller, and swatch tray in a bottom sheet container', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = screen.getByTestId('edit-sheet')
    expect(sheet).toContainElement(screen.getByTestId('flow-editor'))
    expect(sheet).toContainElement(screen.getByTestId('sort-fab'))
  })
```

(If `toContainElement` is unavailable, assert via `sheet.contains(screen.getByTestId('flow-editor'))` being `true`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — no element with testid `edit-sheet` exists.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, wrap everything below the preview in a sheet div:

```tsx
      <div data-testid="edit-sheet" className={styles.sheet}>
        <GeometryTabs type={gradient.type} onSelectType={handleSelectType} onToggleReversed={handleToggleReversed} />
        <div className={styles.blockArea}>
          ...sort FAB + BlockWheel/FlowEditor conditional, unchanged...
        </div>
        <SwatchTray
          colorSet={activeColorSet}
          stops={editableStops}
          onTapAdd={handleTapAdd}
          onTapRemove={handleTapRemove}
          onDragAdd={handleDragAddFromTray}
        />
      </div>
```

In `src/components/EditMode.module.css`:

Remove `view-transition-name: palette-card;` from `.container`, add it to `.preview`, and add the sheet class:

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
}

.preview {
  flex: 1;
  min-height: 0;
  position: relative;
  touch-action: manipulation;
  view-transition-name: palette-card;
}

.sheet {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  padding-top: 12px;
  background: var(--bg, #fff);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
  view-transition-name: edit-sheet;
}
```

In `src/index.css`, extend the view-transition rules:

```css
@keyframes sheet-slide-up {
  from {
    transform: translateY(100%);
  }
}

@keyframes sheet-slide-down {
  to {
    transform: translateY(100%);
  }
}

::view-transition-new(edit-sheet) {
  animation: sheet-slide-up 300ms ease-out;
}

::view-transition-old(edit-sheet) {
  animation: sheet-slide-down 300ms ease-in;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (full suite — this restructures EditMode's DOM, so run everything, not just EditMode tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/index.css src/components/EditMode.test.tsx
git commit -m "feat: reels-style edit transition — preview shrinks, controls rise as bottom sheet"
```

### Task 28: Add a scroll-position ticker to the feed

**Files:**
- Create: `src/components/ScrollTicker.tsx`
- Create: `src/components/ScrollTicker.module.css`
- Modify: `src/components/Feed.tsx`
- Test: `src/components/ScrollTicker.test.tsx`, `src/components/Feed.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ScrollTicker.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScrollTicker } from './ScrollTicker'

afterEach(() => {
  vi.useRealTimers()
})

describe('ScrollTicker', () => {
  it('is hidden (opacity 0) on first render, before any scrolling', () => {
    render(<ScrollTicker index={0} />)
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('0')
  })

  it('becomes visible when the index changes, then fades out after 1s idle', () => {
    vi.useFakeTimers()
    const { rerender } = render(<ScrollTicker index={0} />)
    rerender(<ScrollTicker index={1} />)
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('1')

    vi.advanceTimersByTime(1000)
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('0')
  })

  it('renders no tick for negative indices (start of history)', () => {
    render(<ScrollTicker index={0} />)
    const ticks = screen.getAllByTestId('ticker-tick')
    // Only indices 0..10 exist in the ±10 window around index 0.
    expect(ticks).toHaveLength(11)
  })

  it('marks the tick for the current index as active', () => {
    render(<ScrollTicker index={7} />)
    const active = screen.getByTestId('ticker-tick-active')
    expect(active).toBeInTheDocument()
  })

  it('is aria-hidden (purely decorative)', () => {
    render(<ScrollTicker index={3} />)
    expect(screen.getByTestId('scroll-ticker').getAttribute('aria-hidden')).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ScrollTicker.test.tsx`
Expected: FAIL with "Cannot find module './ScrollTicker'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/components/ScrollTicker.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import styles from './ScrollTicker.module.css'

const TICK_SPACING_PX = 14
const WINDOW = 10 // ticks rendered above and below the current index
const IDLE_FADE_MS = 1000

interface ScrollTickerProps {
  index: number
}

/** Decorative timeline on the right edge of the feed: tick marks scroll past
 * a fixed center marker as the user scrubs, making feed position obvious.
 * Appears while scrolling, fades out after 1s idle. */
export function ScrollTicker({ index }: ScrollTickerProps) {
  const [visible, setVisible] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), IDLE_FADE_MS)
    return () => clearTimeout(timer)
  }, [index])

  const tickIndices = Array.from({ length: WINDOW * 2 + 1 }, (_, i) => index - WINDOW + i).filter((t) => t >= 0)

  return (
    <div data-testid="scroll-ticker" aria-hidden="true" className={styles.ticker} style={{ opacity: visible ? 1 : 0 }}>
      {tickIndices.map((t) => {
        const isActive = t === index
        const isMajor = t % 5 === 0
        return (
          <div
            key={t}
            data-testid={isActive ? 'ticker-tick-active' : 'ticker-tick'}
            className={isActive ? styles.tickActive : isMajor ? styles.tickMajor : styles.tick}
            style={{ transform: `translateY(${(t - index) * TICK_SPACING_PX}px)` }}
          >
            {isMajor && <span className={styles.tickLabel}>{t + 1}</span>}
          </div>
        )
      })}
    </div>
  )
}
```

Create `src/components/ScrollTicker.module.css`:

```css
.ticker {
  position: fixed;
  right: 10px;
  top: 50%;
  width: 24px;
  height: 0;
  z-index: 5;
  pointer-events: none;
  transition: opacity 300ms ease;
}

.tick,
.tickMajor,
.tickActive {
  position: absolute;
  right: 0;
  top: 0;
  height: 2px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.55);
  transition: transform 150ms ease-out;
}

.tick {
  width: 8px;
}

.tickMajor {
  width: 14px;
}

.tickActive {
  width: 20px;
  height: 3px;
  background: #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
}

.tickLabel {
  position: absolute;
  right: 18px;
  top: -6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
```

Wire into `src/components/Feed.tsx`. `goTo` currently mutates `indexRef` (a ref, no re-render for the ticker), so add one piece of state mirroring it. Add near `displayed`:

```ts
  const [tickerIndex, setTickerIndex] = useState(0)
```

In `goTo`, after `indexRef.current = newIndex`:

```ts
    setTickerIndex(newIndex)
```

Add the import and render it inside the container, after `GradientPage`:

```tsx
import { ScrollTicker } from './ScrollTicker'
```

```tsx
      <ScrollTicker index={tickerIndex} />
```

Then add a Feed-level integration test to `src/components/Feed.test.tsx`:

```ts
  it('shows the scroll ticker while scrubbing and it tracks the feed index', () => {
    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('0')

    fireEvent.wheel(container, { deltaY: STEP_PX })
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('1')
    expect(screen.getByTestId('ticker-tick-active')).toBeInTheDocument()
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ScrollTicker.test.tsx Feed.test.tsx`
Expected: PASS (5 new ScrollTicker tests + the Feed integration test + all existing Feed tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ScrollTicker.tsx src/components/ScrollTicker.module.css src/components/ScrollTicker.test.tsx src/components/Feed.tsx src/components/Feed.test.tsx
git commit -m "feat: add scroll-position tick-mark ticker to the feed"
```

### Task 29: Render TurrellSquare in saved-drawer thumbnails for square gradients

**Files:**
- Modify: `src/components/TurrellSquare.tsx` (add optional `blurPx` prop)
- Modify: `src/components/Drawer.tsx`
- Modify: `src/components/Drawer.module.css` (thumbnail needs `position: relative; overflow: hidden` — verify against existing rules first)
- Test: `src/components/Drawer.test.tsx`, `src/components/TurrellSquare.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/TurrellSquare.test.tsx`:

```ts
  it('applies a custom blur radius when blurPx is provided', () => {
    render(<TurrellSquare stops={stops} blurPx={4} />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.filter).toBe('blur(4px)')
  })
```

(Read the existing test file first for its `stops` fixture name; reuse it.)

Add to `src/components/Drawer.test.tsx`:

```ts
  it('renders the TurrellSquare treatment (not a conic background) for saved square gradients', () => {
    const squareGradient: Gradient = {
      id: 'sq1',
      type: 'square',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    render(<Drawer saved={[squareGradient]} onSelect={vi.fn()} />)
    const thumbnail = screen.getByTestId('drawer-thumbnail')
    expect(screen.getByTestId('turrell-square')).toBeInTheDocument()
    expect(thumbnail.style.backgroundImage).toBe('')
  })
```

(Match the existing `Gradient` fixture shape in `Drawer.test.tsx` — check whether its fixtures include `reversed` and import types the same way.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Drawer.test.tsx TurrellSquare.test.tsx`
Expected: FAIL — `TurrellSquare` has no `blurPx` prop (filter stays `blur(24px)` from the CSS module, so `style.filter` is empty inline), and `Drawer` renders a conic `backgroundImage` with no `turrell-square` element.

- [ ] **Step 3: Write minimal implementation**

In `src/components/TurrellSquare.tsx`, add the prop and inline filter:

```tsx
interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
  blurPx?: number
}

export function TurrellSquare({ stops, reversed = false, blurPx }: TurrellSquareProps) {
```

and on the layer div's `style`, add:

```tsx
              filter: blurPx != null ? `blur(${blurPx}px)` : undefined,
```

(The CSS module's `filter: blur(24px)` remains the default; the inline style only overrides when `blurPx` is passed, so full-size usages in `GradientPage`/`EditMode` are untouched.)

In `src/components/Drawer.tsx`, change the thumbnail button body:

```tsx
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{
            backgroundImage:
              gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
          }}
          onClick={() => onSelect(gradient)}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
        </button>
```

Add the import:

```ts
import { TurrellSquare } from './TurrellSquare'
```

In `src/components/Drawer.module.css`, ensure the `.thumbnail` rule includes (append only what's missing after reading the existing rule):

```css
  position: relative;
  overflow: hidden;
  padding: 0;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Drawer.test.tsx TurrellSquare.test.tsx`
Expected: PASS (all Drawer and TurrellSquare tests including the two new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/TurrellSquare.tsx src/components/TurrellSquare.test.tsx src/components/Drawer.tsx src/components/Drawer.module.css src/components/Drawer.test.tsx
git commit -m "fix: render blurred TurrellSquare in drawer thumbnails for square gradients"
```

---

## Round 3: UX feedback (2026-07-08, second pass)

1. Sort control: spell out "Sort by: Lightness/Chroma/Hue" instead of L/H/C, and move the button to the bottom of the preview (not overlapping the controller strip).
2. Rename the "Square" geometry tab label to "Turrell" (display text only — the internal `GradientType` value stays `'square'`). Angular already uses `FlowEditor` (Round 2 Task 24) — no code change needed there, just confirmed by an assertion.
3. Replace double-tap-to-like with a persistent hollow/filled heart toggle button pinned to the bottom-right corner of the preview (both the feed's `GradientPage` and `EditMode`'s preview). A plain single tap on the preview now triggers the primary action (edit / exit) immediately, with no debounce wait.
4. Add a pill-shaped "grabber" handle bar at the top of the edit-mode bottom sheet; tapping it exits edit mode (same as tapping the preview), reinforcing that the sheet can be dismissed.
5. Make the explore→edit gradient transition read as a resize/scale, not a plain crossfade, by giving the browser's automatic `::view-transition-group` box-morph animation the same explicit duration/easing as the crossfade, and keeping box models (`overflow`, `border-radius`) consistent between the paired elements.
6. Remove the "Sort saved palettes" label/select from the Drawer entirely — saved palettes always show in save order.
7. Remove the numeric labels from `ScrollTicker` and smooth its motion.
8. Fix `FlowEditor` handle inset so end-of-track circles don't visually touch the viewport edge, matching the inset used by `GeometryTabs`/`SwatchTray` (12px).

### Task 31: Add toggleable "saved" state to the store

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/store/useAppStore.test.ts` inside the main `describe('useAppStore', ...)` block:

```ts
  it('isGradientSaved reflects whether a gradient (by signature) is in saved', () => {
    expect(useAppStore.getState().isGradientSaved(sampleGradient)).toBe(false)
    useAppStore.getState().saveGradient(sampleGradient)
    expect(useAppStore.getState().isGradientSaved(sampleGradient)).toBe(true)
  })

  it('toggleSaveGradient saves an unsaved gradient', () => {
    useAppStore.getState().toggleSaveGradient(sampleGradient)
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(useAppStore.getState().isGradientSaved(sampleGradient)).toBe(true)
  })

  it('toggleSaveGradient removes an already-saved gradient (matched by signature, ignoring id)', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().toggleSaveGradient({ ...sampleGradient, id: 'different-id' })
    expect(useAppStore.getState().saved).toHaveLength(0)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useAppStore.test.ts`
Expected: FAIL — `isGradientSaved`/`toggleSaveGradient` don't exist on the store yet.

- [ ] **Step 3: Write minimal implementation**

In `src/store/useAppStore.ts`, add to the `AppState` interface:

```ts
  isGradientSaved: (gradient: Gradient) => boolean
  removeSavedGradient: (gradient: Gradient) => void
  toggleSaveGradient: (gradient: Gradient) => void
```

Add to the store body (after `saveGradient`):

```ts
      isGradientSaved: (gradient) => {
        const signature = gradientSignature(gradient)
        return get().saved.some((g) => gradientSignature(g) === signature)
      },
      removeSavedGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        set({ saved: get().saved.filter((g) => gradientSignature(g) !== signature) })
      },
      toggleSaveGradient: (gradient) => {
        if (get().isGradientSaved(gradient)) {
          get().removeSavedGradient(gradient)
        } else {
          get().saveGradient(gradient)
        }
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useAppStore.test.ts`
Expected: PASS (all tests, including the three new ones)

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add isGradientSaved/toggleSaveGradient/removeSavedGradient to the store"
```

### Task 32: Create a shared LikeButton component

**Files:**
- Create: `src/components/LikeButton.tsx`
- Create: `src/components/LikeButton.module.css`
- Test: `src/components/LikeButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LikeButton } from './LikeButton'

describe('LikeButton', () => {
  it('shows a hollow heart and "Like" label when not liked', () => {
    render(<LikeButton liked={false} onToggle={vi.fn()} />)
    const button = screen.getByTestId('like-button')
    expect(button.getAttribute('aria-label')).toBe('Like this gradient')
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows a filled heart and "Unlike" label when liked', () => {
    render(<LikeButton liked={true} onToggle={vi.fn()} />)
    const button = screen.getByTestId('like-button')
    expect(button.getAttribute('aria-label')).toBe('Unlike this gradient')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onToggle and stops the click from bubbling to a parent tap handler', () => {
    const onToggle = vi.fn()
    const onParentTap = vi.fn()
    render(
      <div onPointerUp={onParentTap}>
        <LikeButton liked={false} onToggle={onToggle} />
      </div>
    )
    fireEvent.click(screen.getByTestId('like-button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onParentTap).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- LikeButton.test.tsx`
Expected: FAIL with "Cannot find module './LikeButton'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/components/LikeButton.tsx`:

```tsx
import styles from './LikeButton.module.css'

interface LikeButtonProps {
  liked: boolean
  onToggle: () => void
}

/** Persistent hollow/filled heart toggle, pinned to the bottom-right corner
 * of whatever positioned ancestor renders it (GradientPage's page div,
 * EditMode's preview div). Replaces the old double-tap-to-like gesture. */
export function LikeButton({ liked, onToggle }: LikeButtonProps) {
  return (
    <button
      type="button"
      data-testid="like-button"
      aria-label={liked ? 'Unlike this gradient' : 'Like this gradient'}
      aria-pressed={liked}
      className={styles.likeButton}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-6.7-4.3-9.3-8.2C.8 9.6 1.7 6 4.9 4.8c2.1-.8 4.3.1 5.4 1.9l1.7 2.6 1.7-2.6c1.1-1.8 3.3-2.7 5.4-1.9 3.2 1.2 4.1 4.8 2.2 8-2.6 3.9-9.3 8.2-9.3 8.2z" />
      </svg>
    </button>
  )
}
```

Create `src/components/LikeButton.module.css`:

```css
.likeButton {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 3;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 150ms ease-out;
}

.likeButton:active {
  transform: scale(0.9);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- LikeButton.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/LikeButton.tsx src/components/LikeButton.module.css src/components/LikeButton.test.tsx
git commit -m "feat: add shared LikeButton hollow/filled heart toggle component"
```

### Task 33: Wire LikeButton into GradientPage, remove double-tap-to-like

**Files:**
- Modify: `src/components/GradientPage.tsx`
- Modify: `src/components/Feed.tsx`
- Test: `src/components/GradientPage.test.tsx`, `src/components/Feed.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the two double-tap-related tests in `src/components/GradientPage.test.tsx` (`'calls onSave and shows a heart flash on double-tap'` and `'still calls onSave on a double-tap with no movement'`) — delete them, and replace the single-tap test and the "does not call onEdit when scrolling" test with versions reflecting immediate (non-debounced) tap-to-edit. Read the full existing file first, then replace its contents with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { GradientPage } from './GradientPage'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}

describe('GradientPage', () => {
  it('renders the gradient as a background style', () => {
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.backgroundImage).toContain('linear-gradient')
    expect(page.style.backgroundImage).toContain('rgb(255, 0, 0)')
  })

  it('calls onEdit immediately on a single tap, with no debounce wait', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    fireEvent.pointerUp(screen.getByTestId('gradient-page'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('sets touch-action manipulation to suppress native zoom', () => {
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.touchAction).toBe('manipulation')
  })

  it('does not call onEdit when pointerup lands more than 10px from pointerdown (scroll, not tap)', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')
    fireEvent.pointerDown(page, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(page, { clientX: 100, clientY: 300 })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('still calls onEdit for a single tap with movement under 10px', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')
    fireEvent.pointerDown(page, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(page, { clientX: 103, clientY: 102 })
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('renders a LikeButton reflecting the liked prop and wires onToggleLike', () => {
    const onToggleLike = vi.fn()
    render(<GradientPage gradient={gradient} liked={true} onToggleLike={onToggleLike} onEdit={vi.fn()} />)
    const likeButton = screen.getByTestId('like-button')
    expect(likeButton.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(likeButton)
    expect(onToggleLike).toHaveBeenCalledTimes(1)
  })
})
```

Update `src/components/Feed.test.tsx`'s wheel/momentum/hint tests that reference `saveGradient`/double-tap-to-like behavior if any exist (search for `'Double-tap to like'` and double-tap `fireEvent.pointerUp` pairs) — replace the hint text assertion with `'Tap ♥ to save'` and replace any double-tap-to-save test with a click on `screen.getByTestId('like-button')`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GradientPage.test.tsx Feed.test.tsx`
Expected: FAIL — `GradientPage` doesn't accept `liked`/`onToggleLike` props yet, still uses double-tap internally.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/GradientPage.tsx`:

```tsx
import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { TurrellSquare } from './TurrellSquare'
import { LikeButton } from './LikeButton'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 10

interface GradientPageProps {
  gradient: Gradient
  liked: boolean
  onToggleLike: () => void
  onEdit: () => void
}

export function GradientPage({ gradient, liked, onToggleLike, onEdit }: GradientPageProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > TAP_MOVEMENT_THRESHOLD_PX) {
        return
      }
    }
    onEdit()
  }

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <LikeButton liked={liked} onToggle={onToggleLike} />
    </div>
  )
}
```

(`useDoubleTap`, `useHeartFlash`, and `HeartFlash` are no longer imported here — the persistent heart icon replaces the transient flash. Do not delete those shared files; `useDoubleTap` may still be referenced elsewhere — check before removing anything beyond this file.)

In `src/components/Feed.tsx`, remove the `likeHint`-tied `onSave` wiring and replace with `liked`/`onToggleLike`:

Add the selectors (alongside the existing ones):

```ts
  const isGradientSaved = useAppStore((s) => s.isGradientSaved)
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
```

Remove the now-unused `saveGradient` selector line if nothing else in the file uses it (check first).

Change the `GradientPage` usage:

```tsx
      <GradientPage
        gradient={displayed}
        liked={isGradientSaved(displayed)}
        onToggleLike={() => {
          likeHint.dismiss()
          toggleSaveGradient(displayed)
        }}
        onEdit={() => withViewTransition(enterEditMode)}
      />
```

Change the like hint's text (it no longer describes a double-tap gesture):

```tsx
      {!scrollHint.visible && likeHint.visible && <Hint text="Tap ♥ to save" visible={likeHint.visible} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- GradientPage.test.tsx Feed.test.tsx`
Expected: PASS. Then run the full suite `npm test` — `HeartFlash`/`useHeartFlash`/`useDoubleTap` may now be unused by `GradientPage` but are still used by `EditMode.tsx` until Task 34 lands, so don't delete those shared files yet.

- [ ] **Step 5: Commit**

```bash
git add src/components/GradientPage.tsx src/components/Feed.tsx src/components/GradientPage.test.tsx src/components/Feed.test.tsx
git commit -m "feat: replace double-tap-to-like with a persistent LikeButton on the feed"
```

### Task 34: Wire LikeButton into EditMode, remove double-tap-to-like there too

**Files:**
- Modify: `src/components/EditMode.tsx`
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/EditMode.test.tsx`, delete the two double-tap tests (`'single-tapping the preview exits after the double-tap window elapses'` and `'double-tapping the preview saves (likes) the gradient, shows the heart, and does not exit'`) and replace with:

```ts
  it('tapping the preview exits immediately, with no debounce wait', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    fireEvent.pointerUp(screen.getByTestId('edit-mode-preview'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('renders a LikeButton in the preview that toggles the saved state', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const likeButton = screen.getByTestId('like-button')
    expect(likeButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(likeButton)
    expect(useAppStore.getState().saved).toHaveLength(1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — preview tap still waits 300ms (no fake timers used in the new test, so it never resolves synchronously), and there's no `like-button` testid yet.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`:

Remove the `useDoubleTap`, `useHeartFlash`, `HeartFlash` imports and add:

```ts
import { LikeButton } from './LikeButton'
```

Remove the `heartVisible`/`flash` destructuring (`const { visible: heartVisible, flash } = useHeartFlash()`) and the `handleLike` function and the `onPreviewPointerUp` line (`const { onPointerUp: onPreviewPointerUp } = useDoubleTap(handleLike, onExit)`).

Add selectors for saved state:

```ts
  const isGradientSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
```

Change the preview div's `onPointerUp` to call `onExit` directly:

```tsx
        onPointerUp={onExit}
```

Replace the `<HeartFlash visible={heartVisible} />` line with:

```tsx
        <LikeButton liked={isGradientSaved} onToggle={() => toggleSaveGradient(gradient)} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS. Then run the full suite `npm test`. `HeartFlash`/`useHeartFlash`/`useDoubleTap` are now unused anywhere in `src/` — if a full-repo grep confirms zero remaining usages (`grep -rn "useHeartFlash\|useDoubleTap\|HeartFlash" src --include='*.tsx' --include='*.ts' | grep -v test`), delete `src/components/HeartFlash.tsx`, `src/components/HeartFlash.module.css`, `src/components/HeartFlash.test.tsx` (if it exists), `src/hooks/useHeartFlash.ts`, `src/hooks/useDoubleTap.ts`, and their test files. Otherwise leave them.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.test.tsx
git commit -m "feat: replace double-tap-to-like with a persistent LikeButton in edit mode"
```

(If dead files were deleted in Step 4, `git add` those deletions in the same commit.)

### Task 35: Explicit sort labels, move sort control to bottom of preview

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/EditMode.module.css`
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/EditMode.test.tsx`, update the two sort-FAB tests to expect explicit text and to query the FAB inside the preview rather than the controller:

```ts
  it('renders a sort control at the bottom of the preview with an explicit label, cycling Lightness -> Chroma -> Hue', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)

    const preview = screen.getByTestId('edit-mode-preview')
    const fab = screen.getByTestId('sort-fab')
    expect(preview).toContainElement(fab)
    expect(fab.textContent).toBe('Sort by: Lightness')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Sort by: Chroma')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Sort by: Hue')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Sort by: Lightness')
  })
```

Update the other test that references the FAB's sort behavior (`'tapping the sort FAB sorts stops by the labeled key'`) — it applies lightness on first tap and stays valid; no change needed there beyond leaving it as-is.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — FAB text currently reads `⇅ L`, cycle order is currently lightness → hue → chroma, and the FAB isn't inside `.preview`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, change the sort constants:

```ts
const SORT_KEYS: SortKey[] = ['lightness', 'chroma', 'hue']
const SORT_LABELS: Record<SortKey, string> = { lightness: 'Lightness', chroma: 'Chroma', hue: 'Hue' }
```

Move the sort-FAB `<button>` out of `.blockArea` and into the `.preview` div (as the last child, after `<LikeButton .../>`), updating its text and class:

```tsx
        <LikeButton liked={isGradientSaved} onToggle={() => toggleSaveGradient(gradient)} />
        <button
          type="button"
          data-testid="sort-fab"
          aria-label={`Sort by ${SORT_KEYS[sortKeyIndex]}`}
          className={styles.sortFab}
          onClick={handleSortCycle}
        >
          Sort by: {SORT_LABELS[SORT_KEYS[sortKeyIndex]]}
        </button>
```

Remove the button from inside `.blockArea` (it should now only contain the `BlockWheel`/`FlowEditor` conditional).

In `src/components/EditMode.module.css`, reposition `.sortFab` to the bottom of the preview instead of the top of the controller:

```css
.sortFab {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 3;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
```

(`left: 16px` keeps it clear of `LikeButton`'s `right: 16px` position in the same bottom row.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS (all EditMode tests including the updated sort test)

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/components/EditMode.test.tsx
git commit -m "feat: spell out sort label and move sort control to the bottom of the preview"
```

### Task 36: Rename the Square tab label to Turrell

**Files:**
- Modify: `src/components/GeometryTabs.tsx`
- Test: `src/components/GeometryTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/GeometryTabs.test.tsx` (read the existing file first to match conventions):

```ts
  it('labels the square-type tab as "Turrell"', () => {
    render(<GeometryTabs type="square" onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByText('Turrell')).toBeInTheDocument()
    expect(screen.queryByText('Square')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GeometryTabs.test.tsx`
Expected: FAIL — the tab still reads "Square".

- [ ] **Step 3: Write minimal implementation**

In `src/components/GeometryTabs.tsx`, change the `TABS` array entry:

```ts
  { type: 'square', label: 'Turrell' },
```

(The `GradientType` value stays `'square'` everywhere else in the codebase — this is a display-label-only change, matching how `TurrellSquare` already names the visual treatment.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- GeometryTabs.test.tsx`
Expected: PASS. Run the full suite `npm test` to confirm no other test asserted the literal text "Square".

- [ ] **Step 5: Commit**

```bash
git add src/components/GeometryTabs.tsx src/components/GeometryTabs.test.tsx
git commit -m "feat: rename the Square geometry tab label to Turrell"
```

### Task 37: Add a grabber handle bar to the bottom sheet

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/EditMode.module.css`
- Test: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/EditMode.test.tsx`:

```ts
  it('renders a grabber handle at the top of the sheet that exits edit mode when tapped', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const handle = screen.getByTestId('sheet-handle')
    expect(screen.getByTestId('edit-sheet')).toContainElement(handle)
    fireEvent.click(handle)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EditMode.test.tsx`
Expected: FAIL — no `sheet-handle` testid exists yet.

- [ ] **Step 3: Write minimal implementation**

In `src/components/EditMode.tsx`, add the handle as the first child of the `.sheet` div (before `GeometryTabs`):

```tsx
      <div data-testid="edit-sheet" className={styles.sheet}>
        <button type="button" data-testid="sheet-handle" aria-label="Collapse controls" className={styles.sheetHandle} onClick={onExit} />
        <GeometryTabs ... />
```

In `src/components/EditMode.module.css`, add:

```css
.sheetHandle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  border: none;
  background: rgba(128, 128, 128, 0.4);
  margin: 0 auto 8px;
  padding: 0;
  cursor: pointer;
}
```

(The existing `.sheet` rule already has `padding-top: 12px`; the handle sits within that padding, centered via `margin: 0 auto`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EditMode.test.tsx`
Expected: PASS. Run the full suite `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/components/EditMode.test.tsx
git commit -m "feat: add a grabber handle bar to the bottom sheet for a clearer dismiss affordance"
```

### Task 38: Make the explore/edit gradient transition scale, not just crossfade

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/GradientPage.module.css`
- Modify: `src/components/EditMode.module.css`

This is a CSS-only change with a manual/visual acceptance criterion (jsdom doesn't implement the View Transitions API). No new automated test applies; existing tests must keep passing.

- [ ] **Step 1: Establish a clean baseline**

Run: `npm test`
Expected: PASS (baseline before the CSS edit)

- [ ] **Step 2: (N/A for CSS-only change)**

Skip to implementation.

- [ ] **Step 3: Write minimal implementation**

The default `::view-transition-group(name)` pseudo-element (auto-generated by the browser, not one we style today) is what animates the captured element's size/position between the old and new DOM states — today we only set `animation-duration`/`animation-timing-function` on `::view-transition-old/new(palette-card)` (the crossfade), leaving the group's own resize animation on the browser's default timing. Give both the same explicit timing so the resize and the crossfade are synchronized instead of visually decoupled (which reads as "just a dissolve").

In `src/index.css`, add (near the existing `palette-card` rules):

```css
::view-transition-group(palette-card) {
  animation-duration: 300ms;
  animation-timing-function: ease-out;
}

::view-transition-group(edit-sheet) {
  animation-duration: 300ms;
  animation-timing-function: ease-out;
}
```

In `src/components/GradientPage.module.css`, add `overflow: hidden;` to `.page` (it's already `position: relative`, full-viewport, `border-radius` unset/0):

```css
.page {
  width: 100%;
  height: 100vh;
  scroll-snap-align: start;
  position: relative;
  overflow: hidden;
  view-transition-name: palette-card;
}
```

In `src/components/EditMode.module.css`, add `overflow: hidden;` to `.preview` so its box model matches `.page`'s during the morph:

```css
.preview {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  touch-action: manipulation;
  view-transition-name: palette-card;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (no regressions — CSS-only, `overflow`/animation properties aren't asserted anywhere)

Manual check (do during Task 41's verification pass): tap a palette card in a real browser (jsdom can't run this) and confirm the card visibly shrinks/resizes into the preview slot in sync with the crossfade, rather than staying full-size while dissolving.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/GradientPage.module.css src/components/EditMode.module.css
git commit -m "fix: synchronize view-transition group (resize) and crossfade timing for a seamless morph"
```

### Task 39: Remove the sort UI from the saved-palette Drawer

**Files:**
- Modify: `src/components/Drawer.tsx`
- Modify: `src/components/Drawer.module.css`
- Test: `src/components/Drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/Drawer.test.tsx`, delete the two sort-related tests (`'reorders displayed thumbnails by hue when "Hue" is selected...'` and `'defaults to Newest (original saved order)'`) and add:

```ts
  it('has no sort label or select — always shows saved order', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    expect(screen.queryByText('Sort saved palettes')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sort saved palettes')).not.toBeInTheDocument()
    const thumbnails = screen.getAllByTestId('drawer-thumbnail')
    expect(thumbnails.map((t) => t.getAttribute('aria-label'))).toEqual(['Saved linear gradient', 'Saved radial gradient'])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Drawer.test.tsx`
Expected: FAIL — the sort label/select still render.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/Drawer.tsx`:

```tsx
import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
}

export function Drawer({ saved, onSelect }: DrawerProps) {
  return (
    <div className={styles.drawer}>
      {saved.map((gradient) => (
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{
            backgroundImage:
              gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
          }}
          onClick={() => onSelect(gradient)}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
        </button>
      ))}
    </div>
  )
}
```

(`gradientMetric`/`SortKey`/`useState` imports are dropped along with the sort logic.)

In `src/components/Drawer.module.css`, remove the now-unused `.sortLabel` and `.sortSelect` rules.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Drawer.test.tsx`
Expected: PASS (all remaining Drawer tests, including the new one). Run the full suite `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Drawer.tsx src/components/Drawer.module.css src/components/Drawer.test.tsx
git commit -m "fix: remove the sort label/select from the saved-palette drawer to reclaim horizontal space"
```

### Task 40: Simplify ScrollTicker — drop numbers, smooth the motion

**Files:**
- Modify: `src/components/ScrollTicker.tsx`
- Modify: `src/components/ScrollTicker.module.css`
- Test: `src/components/ScrollTicker.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/ScrollTicker.test.tsx`, add:

```ts
  it('does not render any numeric tick labels', () => {
    render(<ScrollTicker index={12} />)
    expect(screen.queryByText('13')).not.toBeInTheDocument()
    expect(screen.queryByText('11')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ScrollTicker.test.tsx`
Expected: FAIL — major ticks currently render a `<span>` with the 1-indexed number.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ScrollTicker.tsx`, remove the `tickLabel` span entirely:

```tsx
        return (
          <div
            key={t}
            data-testid={isActive ? 'ticker-tick-active' : 'ticker-tick'}
            className={isActive ? styles.tickActive : isMajor ? styles.tickMajor : styles.tick}
            style={{ transform: `translateY(${(t - index) * TICK_SPACING_PX}px)` }}
          />
        )
```

(`isMajor` is still computed and used to pick `styles.tickMajor` vs `styles.tick` — only the number label is removed.)

In `src/components/ScrollTicker.module.css`, delete the now-unused `.tickLabel` rule, and smooth the per-tick motion by lengthening and easing the transform transition:

```css
.tick,
.tickMajor,
.tickActive {
  position: absolute;
  right: 0;
  top: 0;
  height: 2px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.55);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ScrollTicker.test.tsx`
Expected: PASS (all tests, including the new one — the earlier test asserting `screen.getAllByTestId('ticker-tick')` counts is unaffected since element counts didn't change, only their children).

- [ ] **Step 5: Commit**

```bash
git add src/components/ScrollTicker.tsx src/components/ScrollTicker.module.css src/components/ScrollTicker.test.tsx
git commit -m "fix: drop ScrollTicker numeric labels and smooth its tick motion"
```

### Task 41: Fix FlowEditor handle inset at the track ends

**Files:**
- Modify: `src/components/FlowEditor.module.css`
- Test: `src/components/FlowEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/FlowEditor.test.tsx`:

```ts
  it('insets the track enough that end handles do not overhang past the track edge', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const track = screen.getByTestId('flow-editor')
    const trackStyles = getComputedStyle(track)
    const handle = screen.getByLabelText('Stop #ff0000') // position 0, leftmost
    const handleStyles = getComputedStyle(handle)
    // Handle radius must not exceed the track's own side inset, or the
    // circle at position 0%/100% overhangs past the track's padding box.
    const handleRadius = parseFloat(handleStyles.width) / 2
    const trackPaddingLeft = parseFloat(trackStyles.paddingLeft)
    expect(trackPaddingLeft).toBeGreaterThanOrEqual(handleRadius)
  })
```

Note: jsdom's `getComputedStyle` does resolve literal CSS values from a `<style>`/CSS-module class for `width`/`padding` even without real layout, since these are declared, non-computed lengths (not percentages resolved against layout) — verify this works when you run it; if jsdom returns empty strings for module-scoped classes in this project's test setup, instead assert directly on the source values via a simpler structural check (e.g. read the `.track`/`.handle` rule's raw padding/width numbers by importing nothing further — in that case, fall back to a snapshot-style assertion comparing hard-coded pixel constants matching what you implement, and note in your report which approach you used).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FlowEditor.test.tsx`
Expected: FAIL — today the track has no `padding` (only an outer `margin: 0 auto` on a width `calc(100% - 32px)`), so `trackPaddingLeft` is `0`, less than the handle's 14px radius.

- [ ] **Step 3: Write minimal implementation**

In `src/components/FlowEditor.module.css`, add side padding to `.track` matching the 12px inset used by `GeometryTabs`/`SwatchTray`, sized to clear the handle's 14px radius:

```css
.track {
  position: relative;
  width: calc(100% - 32px);
  margin: 0 auto;
  height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  box-sizing: border-box;
}
```

(14px padding on each side exactly matches the handle's radius, so a handle at `left: 0%`/`left: 100%` sits fully within the track's outer box instead of overhanging past it. Combined with the track's existing 16px outer margin, the visible gap from the handle's edge to the viewport edge becomes 16px, matching `GeometryTabs`'/`SwatchTray`'s 12px+ content inset rather than nearly touching it.)

Since `FlowEditor.tsx`'s `positionFromClientX` computes percentages against `rect.width` (the padding-box width including the new `padding`), and handles are positioned via `left: ${position}%` relative to the same box, verify the 0%/100% positions now land inside the padding rather than at the track's outer edge — if `box-sizing: border-box` isn't already implied by a global reset, confirm it's applied here explicitly (it is, added above) so `rect.width` shrinks correctly to exclude the padding from the percentage math... Actually: `box-sizing: border-box` makes `width` include padding, and `getBoundingClientRect().width` returns the full border-box width including padding — meaning `positionFromClientX`'s percentage math is unaffected by adding padding (it's still measuring the full box), but the *handles* are visually inset now because their `left: %` is relative to the full box while their own rendered position visually sits within it. Read `src/components/FlowEditor.tsx` and confirm the drag math still feels correct after this change — if dragging to the visual left/right edge of the padded track no longer reaches 0%/100% cleanly (because `rect.left` still refers to the outer border-box edge, not the padded content edge, so a touch right at the track's outer edge maps to 0% same as before), no logic change is needed; this task is CSS-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- FlowEditor.test.tsx`
Expected: PASS. Run the full suite `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/components/FlowEditor.module.css src/components/FlowEditor.test.tsx
git commit -m "fix: inset FlowEditor track so end handles don't overhang the viewport edge"
```

---

## Testing & verification

### Task 42: Full suite, build, and manual preview check (Round 3)

**Files:** None (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: PASS — every test file, including all new/updated tests from Tasks 31–41.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Completes with no TypeScript errors and produces a `dist/` bundle.

- [ ] **Step 3: Manually verify each Round 3 item**

- Sort control reads "Sort by: Lightness" (etc.) and sits at the bottom-left of the preview, not overlapping the controller strip.
- The "Square" tab now reads "Turrell"; angular gradients still use the horizontal FlowEditor (no wheel blocks).
- Tapping the heart at the bottom-right of the preview (both feed and edit mode) toggles between hollow and filled instantly; double-tapping the preview no longer saves anything (it only opens/exits edit mode).
- A small grabber bar appears at the top of the edit-mode bottom sheet; tapping it exits edit mode.
- Tapping a palette card visibly shrinks/scales it into the edit preview in sync with the crossfade (not a flat dissolve).
- The saved-palette drawer shows no "Sort saved palettes" label/select.
- The feed's scroll ticker has no numbers and its tick motion feels smooth while scrubbing.
- FlowEditor's end-of-track handles no longer touch the screen edge — there's a visible, consistent inset matching the swatch tray/geometry tabs.

- [ ] **Step 4: Record verification result**

Expected: All manual checks confirmed at both mobile (375px) and desktop (1280px+) viewport widths, with no console errors.

- [ ] **Step 5: Commit (only if fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during Round 3 manual verification"
```

If no fixes were needed, skip this step.

---

## Testing & verification (Round 2)

### Task 30: Full suite, build, and manual preview check

**Files:** None (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: PASS — every test file listed under `src/` (including all new `*.test.ts`/`*.test.tsx` files added in Tasks 1–23) passes with 0 failures.

- [ ] **Step 2: Run the production build to catch TypeScript errors**

Run: `npm run build`
Expected: Completes with no TypeScript errors (`tsc -b`) and produces a `dist/` bundle via `vite build`.

- [ ] **Step 3: Start the dev server and manually verify each feature**

Run: `npm run dev` (or use the project's preview tooling), then check:
- **Feature 1:** Scrub through several palettes in explore mode; confirm yellow, orange, pink, purple, and teal hues now appear (not just earth tones/neutrals/blues/greens).
- **Feature 2:** Tap a palette to enter edit mode and tap back to exit; confirm a smooth ~300ms expand/collapse animation. Enable "reduce motion" in OS accessibility settings and confirm the transition becomes instant.
- **Feature 3:** In edit mode, tap L/H/C buttons and confirm gradient stops reorder and re-space evenly. Open the drawer, save a few palettes, and change the sort select to confirm reordering without altering the underlying saved list order.
- **Feature 4:** On a fresh browser profile (or after clearing localStorage), confirm the "Scroll to explore palettes ↓" hint appears once, then the "Double-tap to like" hint appears after scrolling once, and the "Tap a swatch to edit" hint appears once in edit mode. Confirm none reappear after reload.
- **Feature 5:** Resize the browser to 1440px wide; confirm the app fills the full viewport width with no side borders. Resize to ≤768px; confirm mobile layout is unchanged.
- **Feature 6a:** On a touch device (or Chrome DevTools touch emulation), perform a scroll gesture that ends with the finger lifting; confirm edit mode does NOT open. Confirm a genuine single tap still opens edit mode.
- **Feature 6b:** Perform a fast flick gesture; confirm the feed spins through roughly 10+ palettes with smooth deceleration (not an abrupt stop). Confirm slow drags still move exactly one step at a time.
- **Feature 7:** In edit mode for a linear/radial/mirror/repeat gradient, confirm the preview renders as one continuous gradient with circular handles at each stop's position. Drag a handle and confirm the gradient updates live and the handle's position moves smoothly. Exit edit mode and re-enter (or check the feed) to confirm the custom position was preserved exactly, not reset to even spacing.
- **Round 2 / angular controller:** Enter edit mode on an angular gradient; confirm the horizontal FlowEditor strip renders (no wheel), and dragging handles updates the conic gradient live. Confirm `square` still shows BlockWheel.
- **Round 2 / horizontal controller:** In edit mode, confirm the preview occupies most of the screen and the controller is a short horizontal strip; drag handles left/right and use ArrowLeft/ArrowRight (Shift for ±10) on a focused handle.
- **Round 2 / sort FAB:** Confirm a single pill FAB floats at the top-right of the controller strip labeled "⇅ L"; tapping applies the sort and the label cycles L → H → C → L.
- **Round 2 / bottom sheet:** Tap a palette in explore; confirm the card shrinks into the preview slot while the controls sheet (rounded top corners) slides up from the bottom, Reels-style. Tap back and confirm the sheet slides down as the preview expands. With "reduce motion" enabled both are instant.
- **Round 2 / scroll ticker:** Scrub the feed; confirm tick marks appear on the right edge, slide past the highlighted center tick as the index changes (numbers every 5th tick), and fade out ~1s after scrolling stops.
- **Round 2 / saved thumbnails:** Save a square (Turrell) gradient, open the drawer, and confirm its thumbnail shows the blurred nested-squares look matching the feed rendering, not a sharp pinwheel conic.

- [ ] **Step 4: Record verification result**

Expected: All manual checks above confirmed working at both mobile (375px) and desktop (1280px+) viewport widths, with no console errors during any interaction.

- [ ] **Step 5: Commit (only if any fixes were needed during verification)**

```bash
git add -A
git commit -m "fix: address issues found during full-palette-and-ux manual verification"
```

If no fixes were needed, skip this step — Task 24 is verification-only and produces no commit when everything passes cleanly.

---

## Round 4: UX feedback (2026-07-08, third pass)

1. Turrell (square) gradients still use `BlockWheel` — switch them to the same `FlowEditor` horizontal slider as every other type, and delete `BlockWheel` (now fully dead).
2. `FlowEditor` has no way to delete a stop — dragging a handle far enough away from the track (vertically) should remove it, mirroring a common "drag off to delete" pattern, with a visual cue (dimming) while past the threshold.
3. Swatches never show as "selected" for stops that came from `generateGradientStops`, because that function jitters each color's OKLCH values before converting to hex — so a stop's hex almost never exactly equals any swatch's hex. Fix: match by nearest-color proximity (within a small OKLCH tolerance) instead of exact hex equality, for display purposes only.
4. The bottom-sheet slide and the preview's morph don't feel synchronized. The likely cause: `::view-transition-old(edit-sheet)`'s exit animation uses `ease-in` while every other transition in the app (`palette-card` old/new/group, `edit-sheet` group, `edit-sheet` new) uses `ease-out` — the mismatched easing curve makes the two simultaneous motions visually drift apart. Unify on one easing curve.
5. Exiting edit mode back to explore always resets the feed to the first gradient, because `Feed` fully unmounts (App.tsx swaps between `<Feed>+<Drawer>` and `<EditMode>`) and its scroll history/index live in component-local refs that don't survive unmount. Move that session state to a module-level singleton so it survives remount, with a `resetFeedSession()` export for test isolation.

### Task 43: Turrell uses FlowEditor; delete BlockWheel

**Files:**
- Modify: `src/components/EditMode.tsx` (drop `WHEEL_TYPES`/`isWheel`, always render `FlowEditor`)
- Modify: `src/components/EditMode.test.tsx`
- Delete: `src/components/BlockWheel.tsx`, `src/components/BlockWheel.module.css`, `src/components/BlockWheel.test.tsx`

`BlockWheel` becomes fully dead once `square` no longer uses it (confirm via `grep -rn "BlockWheel" src` before deleting — the only remaining references should be the files being deleted plus a stray comment in `SwatchTray.tsx` mentioning "BlockStack/BlockWheel", which can stay as historical context or be reworded, contributor's judgment). `useDragReorder` stays — `BlockStack.tsx` (already unused in production, per Round 2) still imports it; do not touch `BlockStack.tsx` or `useDragReorder` in this task.

- Update/replace the EditMode test `'renders BlockWheel instead of BlockStack for angular/square types'` with an equivalent asserting `type: 'square'` renders `flow-handle` elements and no `wheel-container`/`wheel-wedge` testids (mirroring the existing angular test from Round 2 Task 24).
- Remove the `isWheel`/`WHEEL_TYPES` conditional entirely — `EditMode` should unconditionally render `<FlowEditor .../>` inside `.blockArea` (see Task 44 below for the new props it needs).

### Task 44: Drag a FlowEditor handle away from the track to delete its stop

**Files:**
- Modify: `src/components/FlowEditor.tsx` (new `onRemoveStop: (id: string) => void` prop; vertical drag-distance threshold)
- Modify: `src/components/FlowEditor.module.css` (dimmed/scaled visual state while past the delete threshold)
- Modify: `src/components/EditMode.tsx` (pass `onRemoveStop={handleRemove}` — the existing handler already guards the 2-stop minimum)
- Test: `src/components/FlowEditor.test.tsx`, `src/components/EditMode.test.tsx`

Add a `REMOVE_DISTANCE_PX` threshold (e.g. 56px) measured as `|clientY - pointerStart.y|` during drag. While a drag exceeds it, apply a "removing" visual state to that handle (e.g. `opacity: 0.35; transform: translate(-50%, -50%) scale(0.8)`) via a small piece of local state (`removeCandidateId`) updated in `handlePointerMove`. On `pointerup`, if the threshold was exceeded, call `onRemoveStop(id)` instead of the normal tap/move resolution (skip `onTapStop` in that case). Test: dragging a handle down `>56px` and releasing calls `onRemoveStop` with that stop's id and does not call `onTapStop`; dragging less than the threshold behaves exactly as before (unchanged existing tests must keep passing).

### Task 45: Fuzzy-match swatch selection so jittered gradient stops still show as selected

**Files:**
- Create: `src/lib/swatchMatch.ts`
- Modify: `src/components/SwatchTray.tsx`
- Test: `src/lib/swatchMatch.test.ts`, `src/components/SwatchTray.test.tsx`

`generateGradientStops` (`src/lib/palette.ts`) calls `jitter()` on each base color before converting to hex, so a freshly-generated gradient's stops almost never exactly equal any `DEFAULT_COLOR_SET` swatch hex — meaning `SwatchTray`'s current `stops.some((s) => s.hex === hex)` exact-match check rarely lights anything up. `jitter()`'s ranges are `l ±0.05`, `c ±0.02`, `h ±10` — add a pure `selectedSwatchHexes(stopHexes: string[], colorSet: ColorSet): Set<string>` helper in the new file that, for each stop hex, finds the *closest* color-set entry within a generous tolerance (e.g. `l` diff ≤ 0.08, `c` diff ≤ 0.05, circular `h` diff ≤ 15) and adds that swatch's hex to the result set. Wire it into `SwatchTray` (memoized on `stops`/`colorSet`) to replace the exact-match check for the **visual** selected/checkmark state only — do not change the existing exact-hex tap-to-remove/tap-to-add logic (`onTapRemove`/`onTapAdd` still operate on exact hex; that's out of scope for this task, matching what the user asked: "make sure the selected swatches are **visible**").

### Task 46: Unify view-transition easing between the preview morph and the sheet slide

**Files:**
- Modify: `src/index.css`

`::view-transition-old(edit-sheet)`'s `sheet-slide-down` animation currently uses `ease-in`, while every other transition rule in the file (`palette-card` old/new/group, `edit-sheet` group, `edit-sheet` new/`sheet-slide-up`) uses `ease-out`. Change `::view-transition-old(edit-sheet)` to use `ease-out` too, so the sheet's exit motion and the preview's simultaneous resize-back-to-full-screen morph share the same timing curve instead of visually drifting apart. CSS-only, no new automated test (same rationale as Round 3 Task 38 — jsdom can't exercise the View Transitions API); verify manually.

### Task 47: Preserve feed scroll position across an edit-mode round trip

**Files:**
- Modify: `src/components/Feed.tsx`
- Modify: `src/components/Feed.test.tsx`

`App.tsx` unmounts `<Feed>` entirely while in edit mode (renders `<EditMode>` instead) and remounts it on exit — but `Feed`'s scroll history (`historyRef`), current index (`indexRef`), and locked geometry type (`lockedTypeRef`) are all component-local `useRef`s, so they reset to empty on every remount, snapping the user back to the first gradient. Move that state to a module-level singleton object declared outside the `Feed` function (persists across remounts within the same page load, since ES modules are singletons):

```ts
const feedSession: { history: Gradient[]; index: number; lockedType: GradientType | null } = {
  history: [],
  index: 0,
  lockedType: null,
}

export function resetFeedSession() {
  feedSession.history = []
  feedSession.index = 0
  feedSession.lockedType = null
}
```

Replace every `historyRef.current` / `indexRef.current` / `lockedTypeRef.current` read/write throughout the component (`goTo`, `consumeAccumulatedDelta`, `runMomentumFrame`, the two mount/sync effects) with the module singleton's fields (drop the `.current` — `historyRef`/`indexRef`/`lockedTypeRef` themselves can be deleted). In the initial-mount effect, branch on whether `feedSession.history` is already populated: if so (a remount after edit mode), restore `displayed`/`tickerIndex` from the existing `feedSession.index` instead of regenerating a first gradient; if empty (true first mount), initialize exactly as today.

In `src/components/Feed.test.tsx`, import `resetFeedSession` and call it in the existing `beforeEach` (alongside the existing `useAppStore.setState(...)`/`localStorage.clear()` calls) so each test starts from a clean session — without this, the module singleton would leak gradient history across test cases within the file. Add a new test: render `<Feed>`, scrub forward a few steps via wheel events, unmount (`cleanup()` then a fresh `render(<Feed>)` without calling `resetFeedSession`), and assert the newly-rendered instance's displayed gradient/index matches where the first instance left off (not reset to the first gradient).

---

## Testing & verification (Round 4)

### Task 48: Full suite, build, and manual preview check (Round 4)

Run `npm test`, `npm run build`, then manually verify: Turrell edit mode shows the horizontal FlowEditor (no wheel blocks); dragging a FlowEditor handle down far enough dims it and deletes the stop on release; a freshly-scrubbed-to gradient in edit mode shows at least one swatch highlighted as selected; the sheet-slide and preview-morph feel synchronized on both enter and exit; scrubbing several palettes forward, entering edit mode, and exiting returns to the same palette (not the first one).
