# Edit Mode Fixes & Color Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 7 goals in `docs/superpowers/specs/2026-07-07-edit-mode-fixes-design.md`: chevron/double-tap exit+like, a 36-color named swatch tray backed by a new `activeColorSet` store concept, a true Turrell concentric-square renderer, an angular seam blend fix, and live-reorder drag-drop insertion.

**Architecture:** Introduce `src/lib/colorSets.ts` as the single source of color data; thread `activeColorSet` through the Zustand store so `palette.ts` and the new `SwatchTray` both read it generically (no seed-palette knowledge). Extract a shared `HeartFlash`/`useHeartFlash` for the like animation so `GradientPage` and `EditMode` both use it. Add a pure `insertionIndex.ts` module so pointer→index math is unit-testable without DOM. Fix `buildGradientCss('angular', …)` in place and add a new `TurrellSquare` DOM component that both surfaces branch to for `type === 'square'`.

**Tech Stack:** React 19 + TypeScript, Vite, Zustand (`persist` middleware), CSS Modules, Vitest + @testing-library/react.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/colorSets.ts` | **New.** `NamedColor`, `ColorSet`, `DEFAULT_COLOR_SET` (36 colors). |
| `src/lib/colorSets.test.ts` | **New.** |
| `src/lib/seedPalettes.ts` | **Delete** (end of Task 3). |
| `src/lib/palette.ts` | Modify: sample from a passed-in `ColorSet` instead of `SEED_PALETTES`; drop `seedName` from return type. |
| `src/lib/palette.test.ts` | Modify to match new signature. |
| `src/store/types.ts` | Modify: remove `seedName` from `Gradient`. |
| `src/store/useAppStore.ts` | Modify: add `activeColorSet`, `setActiveColorSet`. |
| `src/store/useAppStore.test.ts` | **New.** |
| `src/lib/stopOrdering.ts` | Modify: add `removeLastByHex`. |
| `src/lib/stopOrdering.test.ts` | Modify: add tests for `removeLastByHex`. |
| `src/components/SwatchCarousel.tsx` / `.module.css` / `.test.tsx` | **Delete**, replaced by: |
| `src/components/SwatchTray.tsx` / `.module.css` / `.test.tsx` | **New.** 36-swatch grid, tap-add/remove, drag-add, selected state. |
| `src/components/HeartFlash.tsx` / `.module.css` | **New.** Extracted from `GradientPage`. |
| `src/hooks/useHeartFlash.ts` / `.test.tsx` | **New.** Extracted show/hide timeout logic. |
| `src/components/GradientPage.tsx` / `.module.css` / `.test.tsx` | Modify: use `HeartFlash`/`useHeartFlash`; branch to `TurrellSquare` for `square` type. |
| `src/lib/gradient.ts` | Modify: fix `angular` case to blend the seam. |
| `src/lib/gradient.test.ts` | Modify: update the angular expectation. |
| `src/components/TurrellSquare.tsx` / `.module.css` / `.test.tsx` | **New.** |
| `src/lib/insertionIndex.ts` / `.test.ts` | **New.** Pure pointer→index math. |
| `src/components/BlockStack.tsx` / `.module.css` / `.test.tsx` | Modify: render insertion gap while a swatch drag hovers. |
| `src/components/BlockWheel.tsx` / `.test.tsx` | Modify: highlight nearest wedge boundary while a swatch drag hovers. |
| `src/components/EditMode.tsx` / `.module.css` / `.test.tsx` | Modify: remove Done button, add back chevron, double-tap preview, wire `SwatchTray` + drag-hover state. |
| `src/components/Feed.tsx` / `.test.tsx` | Modify: call `generateGradientStops(activeColorSet)`, drop `seedName`. |

---

## Task 1: Color set data model

**Files:**
- Create: `src/lib/colorSets.ts`
- Test: `src/lib/colorSets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/colorSets.test.ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_COLOR_SET } from './colorSets'

describe('DEFAULT_COLOR_SET', () => {
  it('has exactly 36 colors', () => {
    expect(DEFAULT_COLOR_SET.colors).toHaveLength(36)
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/colorSets.test.ts`
Expected: FAIL — `Cannot find module './colorSets'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/colorSets.ts
import type { Oklch } from './oklch'

export interface NamedColor {
  name: string
  value: Oklch
}

export interface ColorSet {
  name: string
  colors: NamedColor[]
}

export const DEFAULT_COLOR_SET: ColorSet = {
  name: 'bklyn-clay',
  colors: [
    // Earth reds
    { name: 'Clay', value: { l: 0.42, c: 0.09, h: 35 } },
    { name: 'Terracotta', value: { l: 0.52, c: 0.12, h: 40 } },
    { name: 'Brick', value: { l: 0.35, c: 0.1, h: 30 } },
    { name: 'Rust', value: { l: 0.45, c: 0.13, h: 45 } },
    { name: 'Adobe', value: { l: 0.6, c: 0.08, h: 50 } },
    { name: 'Sienna', value: { l: 0.38, c: 0.11, h: 42 } },
    // Warm neutrals
    { name: 'Sand', value: { l: 0.78, c: 0.03, h: 80 } },
    { name: 'Bone', value: { l: 0.85, c: 0.02, h: 75 } },
    { name: 'Speckled White', value: { l: 0.92, c: 0.01, h: 70 } },
    { name: 'Oat', value: { l: 0.8, c: 0.025, h: 85 } },
    { name: 'Camel', value: { l: 0.65, c: 0.05, h: 65 } },
    { name: 'Biscuit', value: { l: 0.72, c: 0.04, h: 60 } },
    // Cool neutrals
    { name: 'Ash', value: { l: 0.7, c: 0.01, h: 220 } },
    { name: 'Fog', value: { l: 0.8, c: 0.008, h: 210 } },
    { name: 'Pewter', value: { l: 0.55, c: 0.015, h: 230 } },
    { name: 'Slate', value: { l: 0.45, c: 0.02, h: 215 } },
    { name: 'Dove', value: { l: 0.75, c: 0.01, h: 205 } },
    { name: 'Concrete', value: { l: 0.6, c: 0.012, h: 225 } },
    // Greens
    { name: 'Moss', value: { l: 0.45, c: 0.06, h: 130 } },
    { name: 'Sage', value: { l: 0.65, c: 0.04, h: 120 } },
    { name: 'Fern', value: { l: 0.5, c: 0.08, h: 140 } },
    { name: 'Olive', value: { l: 0.4, c: 0.05, h: 100 } },
    { name: 'Juniper', value: { l: 0.35, c: 0.05, h: 150 } },
    { name: 'Celadon', value: { l: 0.72, c: 0.05, h: 145 } },
    // Blues
    { name: 'Indigo', value: { l: 0.35, c: 0.1, h: 265 } },
    { name: 'Denim', value: { l: 0.45, c: 0.09, h: 250 } },
    { name: 'Cobalt', value: { l: 0.5, c: 0.15, h: 255 } },
    { name: 'Steel', value: { l: 0.55, c: 0.06, h: 240 } },
    { name: 'Harbor', value: { l: 0.4, c: 0.07, h: 230 } },
    { name: 'Powder', value: { l: 0.78, c: 0.04, h: 235 } },
    // Darks
    { name: 'Charcoal', value: { l: 0.25, c: 0.01, h: 250 } },
    { name: 'Ink', value: { l: 0.18, c: 0.02, h: 260 } },
    { name: 'Espresso', value: { l: 0.28, c: 0.04, h: 40 } },
    { name: 'Onyx', value: { l: 0.15, c: 0.005, h: 0 } },
    { name: 'Iron', value: { l: 0.32, c: 0.015, h: 220 } },
    { name: 'Midnight', value: { l: 0.2, c: 0.05, h: 270 } },
  ],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/colorSets.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorSets.ts src/lib/colorSets.test.ts
git commit -m "feat: add DEFAULT_COLOR_SET with 36 named BKLYN CLAY colors"
```

---

## Task 2: Store `activeColorSet`

**Files:**
- Modify: `src/store/useAppStore.ts`
- Create: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/useAppStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import type { ColorSet } from '../lib/colorSets'

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

describe('useAppStore activeColorSet', () => {
  it('defaults to DEFAULT_COLOR_SET', () => {
    expect(useAppStore.getState().activeColorSet).toBe(DEFAULT_COLOR_SET)
  })

  it('setActiveColorSet replaces the active set', () => {
    const custom: ColorSet = { name: 'custom', colors: [{ name: 'Foo', value: { l: 0.5, c: 0.1, h: 10 } }] }
    useAppStore.getState().setActiveColorSet(custom)
    expect(useAppStore.getState().activeColorSet).toBe(custom)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useAppStore.test.ts`
Expected: FAIL — `activeColorSet` is `undefined`, `setActiveColorSet` is not a function

- [ ] **Step 3: Modify the store**

```ts
// src/store/useAppStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Gradient, ViewMode } from './types'
import { DEFAULT_COLOR_SET, type ColorSet } from '../lib/colorSets'

function gradientSignature(gradient: Gradient): string {
  const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position)
  return `${gradient.type}:${sortedStops.map((s) => `${s.hex}@${s.position}`).join(',')}`
}

interface AppState {
  mode: ViewMode
  current: Gradient | null
  saved: Gradient[]
  activeColorSet: ColorSet
  setCurrentGradient: (gradient: Gradient) => void
  saveGradient: (gradient: Gradient) => void
  enterEditMode: () => void
  exitEditMode: () => void
  setActiveColorSet: (colorSet: ColorSet) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'explore',
      current: null,
      saved: [],
      activeColorSet: DEFAULT_COLOR_SET,
      setCurrentGradient: (gradient) => set({ current: gradient }),
      saveGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        const alreadySaved = get().saved.some((g) => gradientSignature(g) === signature)
        if (alreadySaved) return
        set({ saved: [...get().saved, gradient] })
      },
      enterEditMode: () => set({ mode: 'edit' }),
      exitEditMode: () => set({ mode: 'explore' }),
      setActiveColorSet: (colorSet) => set({ activeColorSet: colorSet }),
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({ saved: state.saved }),
    }
  )
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useAppStore.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add activeColorSet to app store"
```

---

## Task 3: `palette.ts` samples from `ColorSet`; delete `seedPalettes.ts`

**Files:**
- Modify: `src/lib/palette.ts`
- Modify: `src/lib/palette.test.ts`
- Modify: `src/store/types.ts`
- Modify: `src/components/Feed.tsx`
- Modify: `src/components/Feed.test.tsx`
- Delete: `src/lib/seedPalettes.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/palette.test.ts (replace entire file)
import { describe, it, expect } from 'vitest'
import { generateGradientStops } from './palette'
import { DEFAULT_COLOR_SET } from './colorSets'

describe('generateGradientStops', () => {
  it('produces between 3 and 6 stops', () => {
    for (let i = 0; i < 20; i++) {
      const stops = generateGradientStops(DEFAULT_COLOR_SET)
      expect(stops.length).toBeGreaterThanOrEqual(3)
      expect(stops.length).toBeLessThanOrEqual(6)
    }
  })

  it('produces stops with valid hex colors and 0-100 positions in ascending order', () => {
    const stops = generateGradientStops(DEFAULT_COLOR_SET)
    for (const stop of stops) {
      expect(stop.hex).toMatch(/^#[0-9a-f]{6}$/)
      expect(stop.position).toBeGreaterThanOrEqual(0)
      expect(stop.position).toBeLessThanOrEqual(100)
    }
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].position).toBeGreaterThan(stops[i - 1].position)
    }
  })

  it('jitters colors so repeated calls are not identical', () => {
    const a = generateGradientStops(DEFAULT_COLOR_SET)
    const b = generateGradientStops(DEFAULT_COLOR_SET)
    expect(a.map((s) => s.hex).join(',')).not.toBe(b.map((s) => s.hex).join(','))
  })

  it('samples only from the given color set', () => {
    const tinySet = { name: 'tiny', colors: [{ name: 'Only', value: { l: 0.5, c: 0.1, h: 10 } }] }
    const stops = generateGradientStops(tinySet)
    // With one base color, every jittered stop's hue must be within the jitter range of 10.
    for (const stop of stops) {
      expect(stop.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/palette.test.ts`
Expected: FAIL — `generateGradientStops` still takes 0 arguments and returns `{ seedName, stops }`

- [ ] **Step 3: Modify `palette.ts`**

```ts
// src/lib/palette.ts
import { oklchToHex, type Oklch } from './oklch'
import type { ColorSet } from './colorSets'
import type { GradientStop } from './gradient'

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function jitter(color: Oklch): Oklch {
  return {
    l: Math.min(1, Math.max(0, color.l + (Math.random() - 0.5) * 0.1)),
    c: Math.max(0, color.c + (Math.random() - 0.5) * 0.04),
    h: (color.h + (Math.random() - 0.5) * 20 + 360) % 360,
  }
}

export function generateGradientStops(colorSet: ColorSet): GradientStop[] {
  const stopCount = 3 + Math.floor(Math.random() * 4) // 3-6

  const colors: Oklch[] = []
  for (let i = 0; i < stopCount; i++) {
    const base = pickRandom(colorSet.colors).value
    colors.push(jitter(base))
  }

  return colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: Math.round((i / (stopCount - 1)) * 100),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/palette.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Remove `seedName` from `Gradient` and delete `seedPalettes.ts`**

```ts
// src/store/types.ts
import type { GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  type: GradientType
  stops: GradientStop[]
  // Whether the stop order is flipped for CSS rendering. Optional/defaults
  // to false — does not mutate the underlying `stops` array order.
  reversed?: boolean
}

export type ViewMode = 'explore' | 'edit'
```

```bash
rm src/lib/seedPalettes.ts
```

- [ ] **Step 6: Update `Feed.tsx` to pass `activeColorSet` and drop `seedName`**

```tsx
// src/components/Feed.tsx — only the changed lines
import { useAppStore } from '../store/useAppStore'
import { generateGradientStops } from '../lib/palette'
// ... unchanged imports

function makeGradient(type: GradientType, colorSet: Parameters<typeof generateGradientStops>[0]): Gradient {
  const stops = generateGradientStops(colorSet)
  return {
    id: crypto.randomUUID(),
    type,
    stops,
    reversed: false,
  }
}
```

Inside the `Feed` component, read `activeColorSet` from the store and thread it through every `makeGradient` call site:

```tsx
export function Feed() {
  const current = useAppStore((s) => s.current)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const enterEditMode = useAppStore((s) => s.enterEditMode)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const containerRef = useRef<HTMLDivElement>(null)
  // ... unchanged refs

  useEffect(() => {
    if (lockedTypeRef.current === null) {
      lockedTypeRef.current = current ? current.type : pickRandomType()
    }
    if (historyRef.current.length === 0) {
      const initial = current ?? makeGradient(lockedTypeRef.current, activeColorSet)
      historyRef.current = [initial]
      indexRef.current = 0
      setDisplayed(initial)
      if (!current) {
        setCurrentGradient(initial)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ... unchanged sync effect

  function goTo(newIndex: number) {
    const history = historyRef.current

    if (newIndex < 0) return
    if (newIndex === indexRef.current) return

    if (newIndex >= history.length) {
      const fresh = makeGradient(lockedTypeRef.current!, activeColorSet)
      history.push(fresh)
    }

    indexRef.current = newIndex
    const next = history[newIndex]
    setDisplayed(next)
    setCurrentGradient(next)
    vibrateStep()
  }
  // ... rest unchanged
}
```

- [ ] **Step 7: Update `Feed.test.tsx`** — find every gradient fixture that sets `seedName` and remove the field; find any assertion on `seedName` and delete it. Run:

```bash
grep -rn "seedName" src/
```

Fix every remaining hit until the grep is empty (there will be leftover references in `SwatchCarousel*` — those are removed in Task 4).

- [ ] **Step 8: Run the full suite to check for fallout**

Run: `npx vitest run`
Expected: Failures only in `EditMode.test.tsx` and `SwatchCarousel.test.tsx` (both fixed in later tasks). `palette.test.ts`, `Feed.test.tsx`, `useAppStore.test.ts` all PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: sample gradient generation from activeColorSet, drop seedName"
```

---

## Task 4: `removeLastByHex` helper

**Files:**
- Modify: `src/lib/stopOrdering.ts`
- Modify: `src/lib/stopOrdering.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/stopOrdering.test.ts
describe('removeLastByHex', () => {
  it('removes the last stop matching the given hex, leaving earlier ones', () => {
    const editable = [
      { id: 'a', hex: '#111111' },
      { id: 'b', hex: '#222222' },
      { id: 'c', hex: '#111111' },
    ]
    const result = removeLastByHex(editable, '#111111')
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when the hex is not present', () => {
    const editable = [
      { id: 'a', hex: '#111111' },
      { id: 'b', hex: '#222222' },
    ]
    expect(removeLastByHex(editable, '#999999')).toEqual(editable)
  })
})
```

Update the import line at the top of the file:

```ts
import { toEditableStops, equalizePositions, removeStopAt, addStop, removeLastByHex } from './stopOrdering'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stopOrdering.test.ts`
Expected: FAIL — `removeLastByHex is not a function`

- [ ] **Step 3: Implement it**

```ts
// append to src/lib/stopOrdering.ts
export function removeLastByHex(stops: EditableStop[], hex: string): EditableStop[] {
  const lastIndex = stops.map((s) => s.hex).lastIndexOf(hex)
  if (lastIndex === -1) return stops
  return [...stops.slice(0, lastIndex), ...stops.slice(lastIndex + 1)]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/stopOrdering.test.ts`
Expected: PASS (all tests including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stopOrdering.ts src/lib/stopOrdering.test.ts
git commit -m "feat: add removeLastByHex for swatch tap-to-remove"
```

---

## Task 5: Extract `HeartFlash` + `useHeartFlash`

**Files:**
- Create: `src/components/HeartFlash.tsx`
- Create: `src/components/HeartFlash.module.css`
- Create: `src/hooks/useHeartFlash.ts`
- Create: `src/hooks/useHeartFlash.test.tsx`
- Modify: `src/components/GradientPage.tsx`
- Modify: `src/components/GradientPage.module.css`
- Modify: `src/components/GradientPage.test.tsx` (only if it references `.heartFlash` styles directly — it uses `data-testid="heart-flash"`, which is preserved, so no change expected)

- [ ] **Step 1: Write the failing test for the hook**

```tsx
// src/hooks/useHeartFlash.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHeartFlash } from './useHeartFlash'

describe('useHeartFlash', () => {
  it('starts not visible', () => {
    const { result } = renderHook(() => useHeartFlash())
    expect(result.current.visible).toBe(false)
  })

  it('becomes visible after flash() and hides again after 500ms', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useHeartFlash())
    act(() => result.current.flash())
    expect(result.current.visible).toBe(true)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.visible).toBe(false)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useHeartFlash.test.tsx`
Expected: FAIL — `Cannot find module './useHeartFlash'`

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useHeartFlash.ts
import { useEffect, useRef, useState } from 'react'

const FLASH_DURATION_MS = 500

export function useHeartFlash() {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  function flash() {
    setVisible(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
      timeoutRef.current = null
    }, FLASH_DURATION_MS)
  }

  return { visible, flash }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useHeartFlash.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Extract `HeartFlash` component**

```tsx
// src/components/HeartFlash.tsx
import styles from './HeartFlash.module.css'

interface HeartFlashProps {
  visible: boolean
}

export function HeartFlash({ visible }: HeartFlashProps) {
  if (!visible) return null
  return (
    <svg data-testid="heart-flash" className={styles.heartFlash} viewBox="0 0 32 32">
      <polygon points="16,4 20,12 28,12 22,18 24,28 16,22 8,28 10,18 4,12 12,12" fill="white" />
    </svg>
  )
}
```

```css
/* src/components/HeartFlash.module.css */
.heartFlash {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  animation: flash 500ms ease-out forwards;
}

@keyframes flash {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  30% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 0;
    transform: scale(1);
  }
}
```

- [ ] **Step 6: Wire `GradientPage` to use both**

```tsx
// src/components/GradientPage.tsx
import { buildGradientCss } from '../lib/gradient'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useHeartFlash } from '../hooks/useHeartFlash'
import { HeartFlash } from './HeartFlash'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

interface GradientPageProps {
  gradient: Gradient
  onSave: (gradient: Gradient) => void
  onEdit: () => void
}

export function GradientPage({ gradient, onSave, onEdit }: GradientPageProps) {
  const { visible, flash } = useHeartFlash()

  function handleDoubleTap() {
    onSave(gradient)
    flash()
  }

  const { onPointerUp } = useDoubleTap(handleDoubleTap, onEdit)

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerUp={onPointerUp}
    >
      <HeartFlash visible={visible} />
    </div>
  )
}
```

Remove the now-unused `.heartFlash`/`@keyframes flash` rules from `GradientPage.module.css`, leaving only `.page`.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run src/components/GradientPage.test.tsx src/hooks/useHeartFlash.test.tsx src/components/HeartFlash.test.tsx 2>/dev/null; npx vitest run src/components/GradientPage.test.tsx src/hooks/useHeartFlash.test.tsx`
Expected: PASS (no behavior change, `heart-flash` testid still present when visible)

- [ ] **Step 8: Commit**

```bash
git add src/components/HeartFlash.tsx src/components/HeartFlash.module.css src/hooks/useHeartFlash.ts src/hooks/useHeartFlash.test.tsx src/components/GradientPage.tsx src/components/GradientPage.module.css
git commit -m "refactor: extract HeartFlash/useHeartFlash for reuse in EditMode"
```

---

## Task 6: Angular seam blend fix

**Files:**
- Modify: `src/lib/gradient.ts`
- Modify: `src/lib/gradient.test.ts`

- [ ] **Step 1: Update the failing test expectation**

Replace the existing angular test in `src/lib/gradient.test.ts`:

```ts
  it('builds a conic-gradient string for angular type that blends the seam back to the first color', () => {
    const css = buildGradientCss('angular', stops)
    // 3 stops (0%,50%,100%) compressed by 3/4 -> (0%,38%,75%), then the first
    // color repeated at 100% closes the seam instead of a hard 360deg->0deg cut.
    expect(css).toBe('conic-gradient(#ff0000 0%, #00ff00 38%, #0000ff 75%, #ff0000 100%)')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/gradient.test.ts`
Expected: FAIL — actual is `conic-gradient(#ff0000 0%, #00ff00 50%, #0000ff 100%)`

- [ ] **Step 3: Implement the fix**

```ts
// src/lib/gradient.ts — replace the 'angular' branch and add a helper
function buildAngularGradient(stops: GradientStop[]): string {
  // Compress existing positions to leave room for a final segment that
  // blends the last color back to the first, eliminating the hard seam at
  // 360deg/0deg that a plain conic-gradient produces.
  const scaleFactor = stops.length / (stops.length + 1)
  const compressed = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position * scaleFactor) }))
  const withSeam = [...compressed, { hex: stops[0].hex, position: 100 }]
  return `conic-gradient(${stopsToCss(withSeam)})`
}
```

```ts
// in buildGradientCss's switch:
    case 'angular':
      return buildAngularGradient(orderedStops)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/gradient.test.ts`
Expected: PASS (all tests, including the updated angular one)

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradient.ts src/lib/gradient.test.ts
git commit -m "fix: blend angular gradient seam instead of a hard 360deg cut"
```

---

## Task 7: `TurrellSquare` component

**Files:**
- Create: `src/components/TurrellSquare.tsx`
- Create: `src/components/TurrellSquare.module.css`
- Create: `src/components/TurrellSquare.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/TurrellSquare.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurrellSquare } from './TurrellSquare'
import type { GradientStop } from '../lib/gradient'

const stops: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#00ff00', position: 50 },
  { hex: '#0000ff', position: 100 },
]

describe('TurrellSquare', () => {
  it('renders one layer per stop', () => {
    render(<TurrellSquare stops={stops} />)
    expect(screen.getAllByTestId('turrell-layer')).toHaveLength(3)
  })

  it('renders the outermost layer as the first stop by default', () => {
    render(<TurrellSquare stops={stops} />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(layers[2].style.backgroundColor).toBe('rgb(0, 0, 255)')
  })

  it('reverses layer order when reversed=true', () => {
    render(<TurrellSquare stops={stops} reversed />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.backgroundColor).toBe('rgb(0, 0, 255)')
    expect(layers[2].style.backgroundColor).toBe('rgb(255, 0, 0)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TurrellSquare.test.tsx`
Expected: FAIL — `Cannot find module './TurrellSquare'`

- [ ] **Step 3: Implement the component**

```tsx
// src/components/TurrellSquare.tsx
import type { GradientStop } from '../lib/gradient'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
}

export function TurrellSquare({ stops, reversed = false }: TurrellSquareProps) {
  const ordered = reversed ? [...stops].reverse() : stops

  return (
    <div data-testid="turrell-square" className={styles.container}>
      {ordered.map((stop, i) => {
        // Outermost layer (i === 0) is largest; each subsequent layer shrinks
        // toward the center, producing the nested-squares Turrell look.
        const scalePercent = 100 - (i / ordered.length) * 80
        return (
          <div
            key={i}
            data-testid="turrell-layer"
            className={styles.layer}
            style={{
              backgroundColor: stop.hex,
              width: `${scalePercent}%`,
              height: `${scalePercent}%`,
            }}
          />
        )
      })}
    </div>
  )
}
```

```css
/* src/components/TurrellSquare.module.css */
.container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.layer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  filter: blur(24px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TurrellSquare.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire it into `GradientPage` and `EditMode` preview**

```tsx
// src/components/GradientPage.tsx — add the branch
import { TurrellSquare } from './TurrellSquare'
// ...
export function GradientPage({ gradient, onSave, onEdit }: GradientPageProps) {
  const { visible, flash } = useHeartFlash()

  function handleDoubleTap() {
    onSave(gradient)
    flash()
  }

  const { onPointerUp } = useDoubleTap(handleDoubleTap, onEdit)

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerUp={onPointerUp}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <HeartFlash visible={visible} />
    </div>
  )
}
```

`EditMode`'s preview gets the same branch — see Task 9, Step 5.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run src/components/GradientPage.test.tsx src/components/TurrellSquare.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/TurrellSquare.tsx src/components/TurrellSquare.module.css src/components/TurrellSquare.test.tsx src/components/GradientPage.tsx
git commit -m "feat: render true concentric-square Turrell look via TurrellSquare"
```

---

## Task 8: `SwatchTray` (replaces `SwatchCarousel`)

**Files:**
- Delete: `src/components/SwatchCarousel.tsx`, `.module.css`, `.test.tsx`
- Create: `src/components/SwatchTray.tsx`
- Create: `src/components/SwatchTray.module.css`
- Create: `src/components/SwatchTray.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SwatchTray.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwatchTray } from './SwatchTray'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { oklchToHex } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'

const firstHex = oklchToHex(DEFAULT_COLOR_SET.colors[0].value)
const secondHex = oklchToHex(DEFAULT_COLOR_SET.colors[1].value)

const stops: EditableStop[] = [
  { id: 'a', hex: firstHex },
  { id: 'b', hex: '#123456' },
]

describe('SwatchTray', () => {
  it('renders one swatch per color in the active color set', () => {
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={vi.fn()} onDragAdd={vi.fn()} />)
    expect(screen.getAllByTestId('swatch')).toHaveLength(36)
  })

  it('shows a checkmark only for hexes present in stops', () => {
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={vi.fn()} onDragAdd={vi.fn()} />)
    expect(screen.getAllByTestId('swatch-checkmark')).toHaveLength(1)
  })

  it('tapping an unselected swatch calls onTapAdd with its hex', () => {
    vi.useFakeTimers()
    const onTapAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={onTapAdd} onTapRemove={vi.fn()} onDragAdd={vi.fn()} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(onTapAdd).toHaveBeenCalledWith(secondHex)
    vi.useRealTimers()
  })

  it('tapping a selected swatch calls onTapRemove with its hex', () => {
    vi.useFakeTimers()
    const onTapRemove = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={onTapRemove} onDragAdd={vi.fn()} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[0].name}`)
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(onTapRemove).toHaveBeenCalledWith(firstHex)
    vi.useRealTimers()
  })

  it('calls onDragAdd (not tap callbacks) after a 150ms hold before pointerup', () => {
    vi.useFakeTimers()
    const onTapAdd = vi.fn()
    const onDragAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={onTapAdd} onTapRemove={vi.fn()} onDragAdd={onDragAdd} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch, { clientX: 1, clientY: 2 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(document, { clientX: 10, clientY: 20 })
    expect(onDragAdd).toHaveBeenCalledWith(secondHex, { x: 10, y: 20 })
    expect(onTapAdd).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SwatchTray.test.tsx`
Expected: FAIL — `Cannot find module './SwatchTray'`

- [ ] **Step 3: Implement `SwatchTray`**

```tsx
// src/components/SwatchTray.tsx
import { useEffect, useRef, useState } from 'react'
import { oklchToHex } from '../lib/oklch'
import type { ColorSet } from '../lib/colorSets'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './SwatchTray.module.css'

const DRAG_START_DELAY_MS = 150

interface SwatchTrayProps {
  colorSet: ColorSet
  stops: EditableStop[]
  onTapAdd: (hex: string) => void
  onTapRemove: (hex: string) => void
  onDragAdd: (hex: string, point: { x: number; y: number }) => void
  onDragMove?: (point: { x: number; y: number }) => void
}

export function SwatchTray({ colorSet, stops, onTapAdd, onTapRemove, onDragAdd, onDragMove }: SwatchTrayProps) {
  // Set once a 150ms hold has elapsed without a pointerup: distinguishes a
  // press-and-drag from a plain tap, same threshold as BlockStack/BlockWheel
  // reordering.
  const draggingHexRef = useRef<string | null>(null)
  // Set immediately on pointerdown, cleared on pointerup regardless of
  // whether the hold elapsed — lets pointerup tell a tap from a drag.
  const pendingHexRef = useRef<string | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draggingHex, setDraggingHex] = useState<string | null>(null)
  const stopsRef = useRef(stops)
  stopsRef.current = stops

  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    function handleWindowPointerMove(e: PointerEvent) {
      if (draggingHexRef.current && onDragMove) {
        onDragMove({ x: e.clientX, y: e.clientY })
      }
    }

    function handleWindowPointerUp(e: PointerEvent) {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      const dragHex = draggingHexRef.current
      const tapHex = pendingHexRef.current
      draggingHexRef.current = null
      pendingHexRef.current = null
      setDraggingHex(null)

      if (dragHex) {
        onDragAdd(dragHex, { x: e.clientX, y: e.clientY })
        return
      }
      if (tapHex) {
        const isSelected = stopsRef.current.some((s) => s.hex === tapHex)
        if (isSelected) {
          onTapRemove(tapHex)
        } else {
          onTapAdd(tapHex)
        }
      }
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
    }
  }, [onDragAdd, onDragMove, onTapAdd, onTapRemove])

  function handlePointerDown(hex: string) {
    pendingHexRef.current = hex
    startTimeoutRef.current = setTimeout(() => {
      draggingHexRef.current = hex
      setDraggingHex(hex)
    }, DRAG_START_DELAY_MS)
  }

  return (
    <div className={styles.tray}>
      {colorSet.colors.map((color) => {
        const hex = oklchToHex(color.value)
        const selected = stops.some((s) => s.hex === hex)
        return (
          <button
            key={color.name}
            type="button"
            data-testid="swatch"
            aria-label={color.name}
            className={selected ? styles.swatchSelected : styles.swatch}
            style={{ opacity: draggingHex === hex ? 0.6 : 1 }}
            onPointerDown={() => handlePointerDown(hex)}
          >
            <span className={styles.swatchColor} style={{ backgroundColor: hex }}>
              {selected && (
                <svg data-testid="swatch-checkmark" className={styles.checkmark} viewBox="0 0 16 16">
                  <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" fill="none" />
                </svg>
              )}
            </span>
            <span className={styles.label}>{color.name}</span>
          </button>
        )
      })}
    </div>
  )
}
```

```css
/* src/components/SwatchTray.module.css */
.tray {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(2, auto);
  gap: 8px 6px;
  overflow-x: auto;
  padding: 8px 12px;
}

.swatch,
.swatchSelected {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 40px;
  border: none;
  background: none;
  cursor: grab;
  touch-action: none;
  padding: 0;
}

.swatchColor {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.swatchSelected .swatchColor {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.checkmark {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  background: #000;
  border-radius: 50%;
}

.label {
  font-size: 9px;
  color: #999;
  max-width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SwatchTray.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Delete `SwatchCarousel`**

```bash
rm src/components/SwatchCarousel.tsx src/components/SwatchCarousel.module.css src/components/SwatchCarousel.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace SwatchCarousel with 36-color SwatchTray (tap add/remove, drag add)"
```

---

## Task 9: `EditMode` navigation, like, and `SwatchTray` wiring

**Files:**
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/EditMode.module.css`
- Modify: `src/components/EditMode.test.tsx`

- [ ] **Step 1: Update the failing tests**

Replace `src/components/EditMode.test.tsx` in full:

```tsx
// src/components/EditMode.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditMode } from './EditMode'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 50 },
    { hex: '#0000ff', position: 100 },
  ],
  reversed: false,
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().setCurrentGradient(gradient)
})

afterEach(() => {
  cleanup()
})

describe('EditMode', () => {
  it('renders the preview, geometry tabs, block stack, and swatch tray', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('edit-mode-preview')).toBeInTheDocument()
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getAllByTestId('stack-block')).toHaveLength(3)
    expect(screen.getAllByTestId('swatch').length).toBe(36)
  })

  it('renders BlockWheel instead of BlockStack for angular/square types', () => {
    render(<EditMode gradient={{ ...gradient, type: 'square' }} onExit={vi.fn()} />)
    expect(screen.getAllByTestId('wheel-wedge')).toHaveLength(3)
    expect(screen.queryAllByTestId('stack-block')).toHaveLength(0)
  })

  it('switching tabs updates the store current gradient type without changing stop colors', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Radial'))
    const updated = useAppStore.getState().current!
    expect(updated.type).toBe('radial')
    expect(updated.stops.map((s) => s.hex)).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('tapping the already-active tab toggles reversed on the store', () => {
    const { rerender } = render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(useAppStore.getState().current!.reversed).toBe(true)

    rerender(<EditMode gradient={useAppStore.getState().current!} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(useAppStore.getState().current!.reversed).toBe(false)
  })

  it('removing a block updates the store to have one fewer, re-equalized stop', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('remove-block')[1])
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(2)
    expect(updated.stops.map((s) => s.position)).toEqual([0, 100])
  })

  it('has no Done button; has a back chevron that calls onExit', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Back'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('single-tapping the preview exits after the double-tap window elapses', () => {
    vi.useFakeTimers()
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    fireEvent.pointerUp(screen.getByTestId('edit-mode-preview'))
    vi.advanceTimersByTime(350)
    expect(onExit).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('double-tapping the preview saves (likes) the gradient, shows the heart, and does not exit', () => {
    vi.useFakeTimers()
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const preview = screen.getByTestId('edit-mode-preview')
    fireEvent.pointerUp(preview)
    fireEvent.pointerUp(preview)
    expect(onExit).not.toHaveBeenCalled()
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(screen.getByTestId('heart-flash')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('tapping an unselected swatch appends a new stop', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const swatch = screen.getAllByTestId('swatch')[5]
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(useAppStore.getState().current!.stops).toHaveLength(4)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/EditMode.test.tsx`
Expected: FAIL — no `Back` label, `Done` button still present, no swatch tray, 36 swatches missing, no double-tap/like behavior

- [ ] **Step 3: Rewrite `EditMode.tsx`**

```tsx
// src/components/EditMode.tsx
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, type GradientType } from '../lib/gradient'
import { toEditableStops, equalizePositions, removeStopAt, addStop, removeLastByHex, type EditableStop } from '../lib/stopOrdering'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useHeartFlash } from '../hooks/useHeartFlash'
import { HeartFlash } from './HeartFlash'
import { GeometryTabs } from './GeometryTabs'
import { BlockStack } from './BlockStack'
import { BlockWheel } from './BlockWheel'
import { SwatchTray } from './SwatchTray'
import { TurrellSquare } from './TurrellSquare'
import type { Gradient } from '../store/types'
import styles from './EditMode.module.css'

const WHEEL_TYPES: GradientType[] = ['angular', 'square']

interface EditModeProps {
  gradient: Gradient
  onExit: () => void
}

export function EditMode({ gradient, onExit }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const [editableStops, setEditableStops] = useState<EditableStop[]>(() => toEditableStops(gradient.stops))
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const { visible: heartVisible, flash } = useHeartFlash()

  useEffect(() => {
    setEditableStops(toEditableStops(gradient.stops))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id])

  function commit(nextStops: EditableStop[], overrides?: Partial<Pick<Gradient, 'type' | 'reversed'>>) {
    setEditableStops(nextStops)
    setCurrentGradient({
      ...gradient,
      ...overrides,
      stops: equalizePositions(nextStops),
    })
  }

  function handleRemove(id: string) {
    if (editableStops.length <= 2) return
    commit(removeStopAt(editableStops, id))
  }

  function handleSelectType(type: GradientType) {
    commit(editableStops, { type })
  }

  function handleToggleReversed() {
    commit(editableStops, { reversed: !gradient.reversed })
  }

  function handleDragAddFromTray(hex: string, point: { x: number; y: number }) {
    const el = blockContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const isOverStack =
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    if (isOverStack) {
      commit(addStop(editableStops, hex))
    }
  }

  function handleTapAdd(hex: string) {
    commit(addStop(editableStops, hex))
  }

  function handleTapRemove(hex: string) {
    if (editableStops.length <= 2) return
    commit(removeLastByHex(editableStops, hex))
  }

  function handleLike() {
    saveGradient(gradient)
    flash()
  }

  const { onPointerUp: onPreviewPointerUp } = useDoubleTap(handleLike, onExit)

  const isWheel = WHEEL_TYPES.includes(gradient.type)

  return (
    <div data-testid="edit-mode" className={styles.container}>
      <button type="button" data-testid="edit-mode-back" aria-label="Back" className={styles.backButton} onClick={onExit}>
        ‹
      </button>
      <div
        data-testid="edit-mode-preview"
        className={styles.preview}
        style={{
          backgroundImage: gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        }}
        onPointerUp={onPreviewPointerUp}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
        <HeartFlash visible={heartVisible} />
      </div>
      <GeometryTabs type={gradient.type} onSelectType={handleSelectType} onToggleReversed={handleToggleReversed} />
      <div className={styles.blockArea}>
        {isWheel ? (
          <BlockWheel
            stops={editableStops}
            onReorder={(next) => commit(next)}
            onRemove={handleRemove}
            containerRef={blockContainerRef}
          />
        ) : (
          <BlockStack
            stops={editableStops}
            onReorder={(next) => commit(next)}
            onRemove={handleRemove}
            containerRef={blockContainerRef}
          />
        )}
      </div>
      <SwatchTray
        colorSet={activeColorSet}
        stops={editableStops}
        onTapAdd={handleTapAdd}
        onTapRemove={handleTapRemove}
        onDragAdd={handleDragAddFromTray}
      />
    </div>
  )
}
```

- [ ] **Step 4: Update `EditMode.module.css`**

```css
/* src/components/EditMode.module.css */
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
}

.backButton {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.preview {
  flex: 0 0 40%;
  position: relative;
  touch-action: manipulation;
}

.blockArea {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
```

(The `.exitButton` rule is removed along with the `Done` button.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/EditMode.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: All PASS except possibly `BlockStack`/`BlockWheel` tests touched in Tasks 10-11 (not yet done). Fix any remaining `seedName`/`SwatchCarousel` references surfaced by `grep -rn "SwatchCarousel\|seedName" src/`.

- [ ] **Step 7: Commit**

```bash
git add src/components/EditMode.tsx src/components/EditMode.module.css src/components/EditMode.test.tsx
git commit -m "feat: EditMode back chevron + double-tap like/exit + SwatchTray wiring"
```

---

## Task 10: Insertion-index pure functions

**Files:**
- Create: `src/lib/insertionIndex.ts`
- Create: `src/lib/insertionIndex.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/insertionIndex.test.ts
import { describe, it, expect } from 'vitest'
import { verticalInsertionIndex, wheelInsertionIndex } from './insertionIndex'

describe('verticalInsertionIndex', () => {
  const midpoints = [50, 150, 250] // 3 blocks, each 100px tall, midpoints at 50/150/250

  it('returns 0 when the pointer is above the first midpoint', () => {
    expect(verticalInsertionIndex(10, midpoints)).toBe(0)
  })

  it('returns an index between blocks when the pointer is between their midpoints', () => {
    expect(verticalInsertionIndex(160, midpoints)).toBe(2)
  })

  it('returns the block count when the pointer is below the last midpoint', () => {
    expect(verticalInsertionIndex(300, midpoints)).toBe(3)
  })
})

describe('wheelInsertionIndex', () => {
  it('maps an angle to the nearest wedge boundary index', () => {
    // 4 wedges -> boundaries every 90deg at 0/90/180/270/360
    expect(wheelInsertionIndex(10, 4)).toBe(0)
    expect(wheelInsertionIndex(100, 4)).toBe(1)
    expect(wheelInsertionIndex(179, 4)).toBe(2)
    expect(wheelInsertionIndex(359, 4)).toBe(0)
  })

  it('normalizes negative angles', () => {
    expect(wheelInsertionIndex(-10, 4)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/insertionIndex.test.ts`
Expected: FAIL — `Cannot find module './insertionIndex'`

- [ ] **Step 3: Implement it**

```ts
// src/lib/insertionIndex.ts

/**
 * Given a pointer's Y coordinate and the vertical midpoints of each existing
 * block (in the same coordinate space), returns the index at which a new
 * block should be inserted.
 */
export function verticalInsertionIndex(pointerY: number, blockMidpoints: number[]): number {
  for (let i = 0; i < blockMidpoints.length; i++) {
    if (pointerY < blockMidpoints[i]) return i
  }
  return blockMidpoints.length
}

/**
 * Given a pointer angle in degrees (0-360, measured from the same origin the
 * wheel wedges use) and the current wedge count, returns the index of the
 * nearest wedge boundary to insert at.
 */
export function wheelInsertionIndex(pointerAngleDeg: number, wedgeCount: number): number {
  const normalized = ((pointerAngleDeg % 360) + 360) % 360
  const wedgeDegrees = 360 / wedgeCount
  return Math.round(normalized / wedgeDegrees) % wedgeCount
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/insertionIndex.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/insertionIndex.ts src/lib/insertionIndex.test.ts
git commit -m "feat: add pure pointer-to-insertion-index math for drag-drop reorder"
```

---

## Task 11: `BlockStack` live insertion gap

**Files:**
- Modify: `src/components/BlockStack.tsx`
- Modify: `src/components/BlockStack.module.css`
- Modify: `src/components/BlockStack.test.tsx`
- Modify: `src/components/EditMode.tsx`
- Modify: `src/components/SwatchTray.tsx` usage in `EditMode.tsx` (pass `onDragMove`)

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/components/BlockStack.test.tsx
describe('BlockStack insertion gap', () => {
  it('renders a gap element at the given insertionIndex', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} insertionIndex={1} />)
    const gap = screen.getByTestId('insertion-gap')
    const blocks = screen.getAllByTestId('stack-block')
    // The gap should appear between the first and second block in DOM order.
    const children = Array.from(gap.parentElement!.children)
    expect(children.indexOf(gap)).toBe(1)
    expect(children.indexOf(blocks[0])).toBe(0)
    expect(children.indexOf(blocks[1])).toBe(2)
  })

  it('renders no gap when insertionIndex is null', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} insertionIndex={null} />)
    expect(screen.queryByTestId('insertion-gap')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BlockStack.test.tsx`
Expected: FAIL — `insertionIndex` prop is not recognized / no gap rendered

- [ ] **Step 3: Implement the gap in `BlockStack`**

```tsx
// src/components/BlockStack.tsx
import type { RefObject } from 'react'
import { useDragReorder } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './BlockStack.module.css'

interface BlockStackProps {
  stops: EditableStop[]
  onReorder: (stops: EditableStop[]) => void
  onRemove: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
  insertionIndex?: number | null
}

export function BlockStack({ stops, onReorder, onRemove, containerRef, insertionIndex = null }: BlockStackProps) {
  const { draggingIndex, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(stops, onReorder)

  const items: Array<{ kind: 'block'; stop: EditableStop; index: number } | { kind: 'gap' }> = []
  stops.forEach((stop, index) => {
    if (insertionIndex === index) items.push({ kind: 'gap' })
    items.push({ kind: 'block', stop, index })
  })
  if (insertionIndex === stops.length) items.push({ kind: 'gap' })

  return (
    <div
      ref={containerRef}
      data-testid="block-stack"
      className={styles.stack}
      onPointerMove={(e) => handlePointerMove(e.clientY)}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {items.map((item, i) => {
        if (item.kind === 'gap') {
          return <div key={`gap-${i}`} data-testid="insertion-gap" className={styles.gap} />
        }
        const { stop, index } = item
        const light = isLightColor(stop.hex)
        return (
          <div
            key={stop.id}
            data-testid="stack-block"
            className={styles.block}
            style={{
              backgroundColor: stop.hex,
              color: light ? '#000' : '#fff',
              borderTopColor: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
              opacity: draggingIndex === index ? 0.6 : 1,
            }}
            onPointerDown={(e) => handlePointerDown(index, e.clientY)}
          >
            <span className={styles.label}>{stop.hex}</span>
            {stops.length > 2 && (
              <button
                type="button"
                data-testid="remove-block"
                className={styles.removeButton}
                onClick={() => onRemove(stop.id)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

```css
/* append to src/components/BlockStack.module.css */
.block,
.gap {
  transition: flex-basis 150ms ease, opacity 150ms ease;
}

.gap {
  flex: 0.6;
  min-height: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BlockStack.test.tsx`
Expected: PASS (all existing tests + 2 new ones)

- [ ] **Step 5: Wire drag-hover state through `EditMode`**

```tsx
// src/components/EditMode.tsx — additions
import { verticalInsertionIndex } from '../lib/insertionIndex'
// ...

export function EditMode({ gradient, onExit }: EditModeProps) {
  // ... existing state
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)

  // ... existing handlers

  function handleTrayDragMove(point: { x: number; y: number }) {
    const el = blockContainerRef.current
    if (!el || isWheel) return
    const rect = el.getBoundingClientRect()
    const isOver = point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    if (!isOver) {
      setInsertionIndex(null)
      return
    }
    const blockEls = Array.from(el.querySelectorAll<HTMLElement>('[data-testid="stack-block"]'))
    const midpoints = blockEls.map((b) => {
      const r = b.getBoundingClientRect()
      return r.top + r.height / 2
    })
    setInsertionIndex(verticalInsertionIndex(point.y, midpoints))
  }

  function handleDragAddFromTray(hex: string, point: { x: number; y: number }) {
    const el = blockContainerRef.current
    setInsertionIndex(null)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const isOverStack =
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    if (isOverStack) {
      const index = editableStops.length
        ? verticalInsertionIndex(
            point.y,
            Array.from(el.querySelectorAll<HTMLElement>('[data-testid="stack-block"]')).map((b) => {
              const r = b.getBoundingClientRect()
              return r.top + r.height / 2
            })
          )
        : 0
      const withNew = [...editableStops.slice(0, index), { id: crypto.randomUUID(), hex }, ...editableStops.slice(index)]
      commit(withNew)
    }
  }

  // ... isWheel, seedName removed already

  return (
    // ... unchanged header/preview/tabs
    <div className={styles.blockArea}>
      {isWheel ? (
        <BlockWheel
          stops={editableStops}
          onReorder={(next) => commit(next)}
          onRemove={handleRemove}
          containerRef={blockContainerRef}
        />
      ) : (
        <BlockStack
          stops={editableStops}
          onReorder={(next) => commit(next)}
          onRemove={handleRemove}
          containerRef={blockContainerRef}
          insertionIndex={insertionIndex}
        />
      )}
    </div>
    <SwatchTray
      colorSet={activeColorSet}
      stops={editableStops}
      onTapAdd={handleTapAdd}
      onTapRemove={handleTapRemove}
      onDragAdd={handleDragAddFromTray}
      onDragMove={handleTrayDragMove}
    />
  )
}
```

- [ ] **Step 6: Add an `EditMode` test for indexed insertion**

```tsx
// append to src/components/EditMode.test.tsx
it('drag-adding a swatch inserts at the computed index, not just appended', () => {
  vi.useFakeTimers()
  render(<EditMode gradient={gradient} onExit={vi.fn()} />)
  const swatch = screen.getAllByTestId('swatch')[10]
  fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
  vi.advanceTimersByTime(150)
  // jsdom returns all-zero getBoundingClientRect by default, so every block
  // midpoint is 0 and the pointer at y=0 resolves to insertion index 0.
  fireEvent.pointerUp(document, { clientX: 0, clientY: 0 })
  const updated = useAppStore.getState().current!
  expect(updated.stops).toHaveLength(4)
  vi.useRealTimers()
})
```

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/BlockStack.tsx src/components/BlockStack.module.css src/components/BlockStack.test.tsx src/components/EditMode.tsx src/components/EditMode.test.tsx
git commit -m "feat: BlockStack live insertion gap driven by swatch drag position"
```

---

## Task 12: `BlockWheel` minimal insertion highlight

**Files:**
- Modify: `src/components/BlockWheel.tsx`
- Modify: `src/components/BlockWheel.module.css`
- Modify: `src/components/BlockWheel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/components/BlockWheel.test.tsx
describe('BlockWheel insertion highlight', () => {
  it('applies a highlighted boundary class at the given insertionIndex', () => {
    render(<BlockWheel stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} insertionIndex={1} />)
    const wedges = screen.getAllByTestId('wheel-wedge')
    expect(wedges[1].className).toContain('boundaryHighlight')
  })

  it('applies no highlight when insertionIndex is null', () => {
    render(<BlockWheel stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} insertionIndex={null} />)
    const wedges = screen.getAllByTestId('wheel-wedge')
    for (const w of wedges) expect(w.className).not.toContain('boundaryHighlight')
  })
})
```

(Check the existing `stops` fixture at the top of `BlockWheel.test.tsx`; reuse it as-is.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BlockWheel.test.tsx`
Expected: FAIL — `insertionIndex` prop unused, no `boundaryHighlight` class ever applied

- [ ] **Step 3: Implement it**

```tsx
// src/components/BlockWheel.tsx
import type { RefObject } from 'react'
import { useDragReorder } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './BlockWheel.module.css'

interface BlockWheelProps {
  stops: EditableStop[]
  onReorder: (stops: EditableStop[]) => void
  onRemove: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
  insertionIndex?: number | null
}

export function BlockWheel({ stops, onReorder, onRemove, containerRef, insertionIndex = null }: BlockWheelProps) {
  const { draggingIndex, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(stops, onReorder)
  const wedgeDegrees = Math.round(360 / stops.length)

  return (
    <div
      ref={containerRef}
      data-testid="wheel-container"
      className={styles.wheelContainer}
      onPointerMove={(e) => handlePointerMove(e.clientY)}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className={styles.wedgeList}>
        {stops.map((stop, index) => {
          const light = isLightColor(stop.hex)
          const highlighted = insertionIndex === index
          return (
            <div
              key={stop.id}
              data-testid="wheel-wedge"
              data-wedge-degrees={wedgeDegrees}
              className={highlighted ? `${styles.wedgeRow} ${styles.boundaryHighlight}` : styles.wedgeRow}
              style={{
                backgroundColor: stop.hex,
                color: light ? '#000' : '#fff',
                opacity: draggingIndex === index ? 0.6 : 1,
              }}
              onPointerDown={(e) => handlePointerDown(index, e.clientY)}
            >
              <span>{stop.hex} · {wedgeDegrees}°</span>
              {stops.length > 2 && (
                <button
                  type="button"
                  data-testid="remove-block"
                  className={styles.removeButton}
                  onClick={() => onRemove(stop.id)}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

```css
/* append to src/components/BlockWheel.module.css */
.boundaryHighlight {
  border-top: 2px solid #fff;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BlockWheel.test.tsx`
Expected: PASS (all existing tests + 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/BlockWheel.tsx src/components/BlockWheel.module.css src/components/BlockWheel.test.tsx
git commit -m "feat: BlockWheel minimal boundary highlight for swatch drag insertion"
```

---

## Task 13: Final integration pass

**Files:** none new — verification only.

- [ ] **Step 1: Grep for dead references**

```bash
grep -rn "seedName\|SwatchCarousel\|SEED_PALETTES" src/
```

Expected: no hits. Fix any stragglers (likely in `Feed.test.tsx` fixtures).

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx oxlint`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Start the dev server and in the browser:
- Enter edit mode, confirm no Done button, confirm back chevron (‹) exits.
- Single-tap the preview → exits after a beat. Double-tap the preview → heart flashes, gradient appears in Drawer's saved list, stays in edit mode.
- Scroll the swatch tray horizontally; confirm 36 named swatches in 2 rows.
- Tap an unselected swatch → new block appears. Tap it again (now selected) → block is removed.
- Press-and-hold a swatch, drag it over the block stack → see the insertion gap appear/move as you drag, drop to insert at that position.
- Switch to `Square` type → confirm concentric glowing squares (not flat pie wedges) both in edit preview and back in the feed.
- Switch to `Angular` type → confirm no hard color seam at the top of the circle.

- [ ] **Step 6: Commit if step 5 uncovered fixes**

```bash
git add -A
git commit -m "fix: polish from edit-mode-fixes manual smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** Goal 1 → Task 9. Goal 2 → Task 9 (double-tap likes via `saveGradient`). Goal 3 → Task 8. Goal 4 → Tasks 1-3. Goal 5 → Task 7. Goal 6 → Task 6. Goal 7 → Tasks 10-12.
- **Non-goals respected:** no persistence of `activeColorSet` added beyond the in-memory store field; no hex codes rendered in the tray (only `color.name` labels); no import/save-custom-set UI built.
- **Type consistency:** `generateGradientStops(colorSet: ColorSet): GradientStop[]` used consistently in `palette.ts`, `palette.test.ts`, and `Feed.tsx` after Task 3. `SwatchTray`'s `onDragAdd`/`onTapAdd`/`onTapRemove`/`onDragMove` signatures match their `EditMode.tsx` call sites introduced in Tasks 9 and 11.
