# Exploration Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Palette app's main exploration screen — a swipeable full-screen feed of OKLCH-generated gradients with double-tap-to-save, a persistent saved drawer, and a tap-to-edit transition into a stubbed Edit Mode.

**Architecture:** Vite + React + TypeScript SPA. A minimal OKLCH↔sRGB color library and a palette generator produce gradient stop data; a pure gradient-string builder turns stop data + geometry type into CSS. A Zustand store holds exploration and saved-drawer state (drawer synced to localStorage). React components render the scroll-snap feed, the drawer, and the double-tap/tap-to-edit gesture handling.

**Tech Stack:** Vite, React 18, TypeScript, Zustand, Vitest + React Testing Library + jsdom for tests.

**Spec:** `docs/superpowers/specs/2026-07-05-exploration-screen-design.md`

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- Create: `.gitignore`

- [ ] **Step 1: Scaffold with Vite's React-TS template**

Run:
```bash
cd /Users/matthewlewair/Documents/palette
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install runtime and test dependencies**

Run:
```bash
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
```

- [ ] **Step 4: Create `src/setupTests.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

Add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 6: Write a trivial smoke test to verify the runner works**

Create `src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 7: Run the test suite and verify it passes**

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 8: Delete the smoke test and verify dev server boots**

Run:
```bash
rm src/smoke.test.ts
npm run dev -- --port 5173 &
sleep 2
curl -sf http://localhost:5173 > /dev/null && echo "OK"
kill %1
```
Expected: `OK`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project with Vitest"
```

---

## Task 2: OKLCH ↔ sRGB color math

**Files:**
- Create: `src/lib/oklch.ts`
- Test: `src/lib/oklch.test.ts`

- [ ] **Step 1: Write failing round-trip test**

Create `src/lib/oklch.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { oklchToSrgb, srgbToOklch } from './oklch'

describe('oklch <-> srgb conversion', () => {
  it('round-trips a mid-lightness teal within tolerance', () => {
    const original = { l: 0.7, c: 0.1, h: 200 }
    const rgb = oklchToSrgb(original)
    const back = srgbToOklch(rgb)
    expect(back.l).toBeCloseTo(original.l, 1)
    expect(back.c).toBeCloseTo(original.c, 1)
    expect(back.h).toBeCloseTo(original.h, 0)
  })

  it('converts OKLCH black to rgb(0,0,0)', () => {
    const rgb = oklchToSrgb({ l: 0, c: 0, h: 0 })
    expect(rgb.r).toBeCloseTo(0, 1)
    expect(rgb.g).toBeCloseTo(0, 1)
    expect(rgb.b).toBeCloseTo(0, 1)
  })

  it('converts OKLCH white to rgb(255,255,255)', () => {
    const rgb = oklchToSrgb({ l: 1, c: 0, h: 0 })
    expect(rgb.r).toBeCloseTo(255, 0)
    expect(rgb.g).toBeCloseTo(255, 0)
    expect(rgb.b).toBeCloseTo(255, 0)
  })

  it('produces a valid hex string', () => {
    const rgb = oklchToSrgb({ l: 0.6, c: 0.15, h: 30 })
    expect(rgbToHex(rgb)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- oklch`
Expected: FAIL — `Cannot find module './oklch'`

- [ ] **Step 3: Implement `src/lib/oklch.ts`**

```ts
export interface Oklch {
  l: number // 0-1
  c: number // chroma, typically 0-0.4
  h: number // hue degrees, 0-360
}

export interface Srgb {
  r: number // 0-255
  g: number // 0-255
  b: number // 0-255
}

function oklchToOklab(oklch: Oklch): { L: number; a: number; b: number } {
  const hRad = (oklch.h * Math.PI) / 180
  return {
    L: oklch.l,
    a: oklch.c * Math.cos(hRad),
    b: oklch.c * Math.sin(hRad),
  }
}

function oklabToOklch(oklab: { L: number; a: number; b: number }): Oklch {
  const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b)
  let h = (Math.atan2(oklab.b, oklab.a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: oklab.L, c, h }
}

function oklabToLinearSrgb(oklab: { L: number; a: number; b: number }): { r: number; g: number; b: number } {
  const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b
  const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b
  const s_ = oklab.L - 0.0894841775 * oklab.a - 1.291485548 * oklab.b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

function linearSrgbToOklab(linear: { r: number; g: number; b: number }): { L: number; a: number; b: number } {
  const l = 0.4122214708 * linear.r + 0.5363325363 * linear.g + 0.0514459929 * linear.b
  const m = 0.2119034982 * linear.r + 0.6806995451 * linear.g + 0.1073969566 * linear.b
  const s = 0.0883024619 * linear.r + 0.2817188376 * linear.g + 0.6299787005 * linear.b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

function linearToGamma(c: number): number {
  const abs = Math.abs(c)
  if (abs <= 0.0031308) return 12.92 * c
  return (c < 0 ? -1 : 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055)
}

function gammaToLinear(c: number): number {
  const abs = Math.abs(c)
  if (abs <= 0.04045) return c / 12.92
  return (c < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.4)
}

export function oklchToSrgb(oklch: Oklch): Srgb {
  const oklab = oklchToOklab(oklch)
  const linear = oklabToLinearSrgb(oklab)
  return {
    r: linearToGamma(linear.r) * 255,
    g: linearToGamma(linear.g) * 255,
    b: linearToGamma(linear.b) * 255,
  }
}

export function srgbToOklch(srgb: Srgb): Oklch {
  const linear = {
    r: gammaToLinear(srgb.r / 255),
    g: gammaToLinear(srgb.g / 255),
    b: gammaToLinear(srgb.b / 255),
  }
  const oklab = linearSrgbToOklab(linear)
  return oklabToOklch(oklab)
}

export function oklchToHex(oklch: Oklch): string {
  const { r, g, b } = oklchToSrgb(oklch)
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- oklch`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/oklch.ts src/lib/oklch.test.ts
git commit -m "feat: add OKLCH <-> sRGB color conversion"
```

---

## Task 3: Gradient CSS string builder

**Files:**
- Create: `src/lib/gradient.ts`
- Test: `src/lib/gradient.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/gradient.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildGradientCss, type GradientStop, type GradientType } from './gradient'

const stops: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#00ff00', position: 50 },
  { hex: '#0000ff', position: 100 },
]

describe('buildGradientCss', () => {
  it('builds a linear-gradient string', () => {
    const css = buildGradientCss('linear', stops)
    expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a radial-gradient string', () => {
    const css = buildGradientCss('radial', stops)
    expect(css).toBe('radial-gradient(circle, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a conic-gradient string for angular type', () => {
    const css = buildGradientCss('angular', stops)
    expect(css).toBe('conic-gradient(#ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a nested conic-gradient with hard stops sized to the stop count for square type', () => {
    const css = buildGradientCss('square', stops)
    expect(css).toContain('conic-gradient(from 0deg')
    expect(css).toContain('#ff0000 0deg 120deg')
    expect(css).toContain('#00ff00 120deg 240deg')
  })

  it('scales square-type wedge width down as more stops are added (3-12 stop range)', () => {
    const sixStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#ff8800', position: 20 },
      { hex: '#ffff00', position: 40 },
      { hex: '#00ff00', position: 60 },
      { hex: '#0000ff', position: 80 },
      { hex: '#8800ff', position: 100 },
    ]
    const css = buildGradientCss('square', sixStops)
    expect(css).toContain('#ff0000 0deg 60deg')
    expect(css).toContain('#8800ff 300deg 360deg')
  })

  it('throws for fewer than 2 stops', () => {
    expect(() => buildGradientCss('linear', [stops[0]])).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gradient`
Expected: FAIL — `Cannot find module './gradient'`

- [ ] **Step 3: Implement `src/lib/gradient.ts`**

```ts
export type GradientType = 'linear' | 'radial' | 'angular' | 'square'

export interface GradientStop {
  hex: string
  position: number // 0-100
}

function assertStops(stops: GradientStop[]): void {
  if (stops.length < 2) {
    throw new Error('A gradient requires at least 2 stops')
  }
}

function stopsToCss(stops: GradientStop[]): string {
  return stops.map((s) => `${s.hex} ${s.position}%`).join(', ')
}

function buildSquareGradient(stops: GradientStop[]): string {
  const segmentCount = stops.length
  const degreesPerSegment = 360 / segmentCount
  const segments = stops.map((stop, i) => {
    const start = i * degreesPerSegment
    const end = (i + 1) * degreesPerSegment
    return `${stop.hex} ${start}deg ${end}deg`
  })
  return `conic-gradient(from 0deg, ${segments.join(', ')})`
}

export function buildGradientCss(type: GradientType, stops: GradientStop[]): string {
  assertStops(stops)

  switch (type) {
    case 'linear':
      return `linear-gradient(180deg, ${stopsToCss(stops)})`
    case 'radial':
      return `radial-gradient(circle, ${stopsToCss(stops)})`
    case 'angular':
      return `conic-gradient(${stopsToCss(stops)})`
    case 'square':
      return buildSquareGradient(stops)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gradient`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradient.ts src/lib/gradient.test.ts
git commit -m "feat: add CSS gradient string builder for all 4 geometries"
```

---

## Task 4: Seed palettes and palette generator

**Files:**
- Create: `src/lib/seedPalettes.ts`
- Create: `src/lib/palette.ts`
- Test: `src/lib/palette.test.ts`

- [ ] **Step 1: Create seed palette data**

Create `src/lib/seedPalettes.ts`:
```ts
import type { Oklch } from './oklch'

export interface SeedPalette {
  name: string
  colors: Oklch[]
}

export const SEED_PALETTES: SeedPalette[] = [
  {
    name: 'bklyn-clay',
    colors: [
      { l: 0.35, c: 0.06, h: 40 }, // clay red-brown
      { l: 0.55, c: 0.08, h: 60 }, // terracotta
      { l: 0.75, c: 0.03, h: 90 }, // sand
      { l: 0.45, c: 0.05, h: 200 }, // slate teal
      { l: 0.25, c: 0.02, h: 250 }, // charcoal
    ],
  },
  {
    name: 'modern-brand-cool',
    colors: [
      { l: 0.55, c: 0.18, h: 250 }, // brand blue
      { l: 0.65, c: 0.14, h: 200 }, // cyan accent
      { l: 0.3, c: 0.05, h: 260 }, // deep navy
      { l: 0.85, c: 0.02, h: 220 }, // pale neutral
    ],
  },
  {
    name: 'modern-brand-warm',
    colors: [
      { l: 0.6, c: 0.2, h: 30 }, // coral
      { l: 0.7, c: 0.15, h: 80 }, // amber
      { l: 0.4, c: 0.1, h: 20 }, // rust
      { l: 0.88, c: 0.03, h: 60 }, // cream
    ],
  },
]
```

- [ ] **Step 2: Write failing tests for the generator**

Create `src/lib/palette.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateGradientStops } from './palette'

describe('generateGradientStops', () => {
  it('produces between 3 and 6 stops', () => {
    for (let i = 0; i < 20; i++) {
      const stops = generateGradientStops()
      expect(stops.length).toBeGreaterThanOrEqual(3)
      expect(stops.length).toBeLessThanOrEqual(6)
    }
  })

  it('produces stops with valid hex colors and 0-100 positions in ascending order', () => {
    const stops = generateGradientStops()
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
    const a = generateGradientStops()
    const b = generateGradientStops()
    const aHexes = a.map((s) => s.hex).join(',')
    const bHexes = b.map((s) => s.hex).join(',')
    expect(aHexes).not.toBe(bHexes)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- palette`
Expected: FAIL — `Cannot find module './palette'`

- [ ] **Step 4: Implement `src/lib/palette.ts`**

```ts
import { oklchToHex, type Oklch } from './oklch'
import { SEED_PALETTES } from './seedPalettes'
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

export function generateGradientStops(): GradientStop[] {
  const seed = pickRandom(SEED_PALETTES)
  const stopCount = 3 + Math.floor(Math.random() * 4) // 3-6

  const colors: Oklch[] = []
  for (let i = 0; i < stopCount; i++) {
    const base = seed.colors[i % seed.colors.length]
    colors.push(jitter(base))
  }

  return colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: Math.round((i / (stopCount - 1)) * 100),
  }))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- palette`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/seedPalettes.ts src/lib/palette.ts src/lib/palette.test.ts
git commit -m "feat: add seed palettes and OKLCH-jittered gradient stop generator"
```

---

## Task 5: Zustand store — exploration and saved-drawer state

**Files:**
- Create: `src/store/types.ts`
- Create: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Define shared types**

Create `src/store/types.ts`:
```ts
import type { GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  type: GradientType
  stops: GradientStop[]
}

export type ViewMode = 'explore' | 'edit'
```

- [ ] **Step 2: Write failing store tests**

Create `src/store/useAppStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Gradient } from './types'

const sampleGradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('useAppStore', () => {
  it('starts in explore mode with no saved gradients', () => {
    const state = useAppStore.getState()
    expect(state.mode).toBe('explore')
    expect(state.saved).toEqual([])
  })

  it('sets the current gradient', () => {
    useAppStore.getState().setCurrentGradient(sampleGradient)
    expect(useAppStore.getState().current).toEqual(sampleGradient)
  })

  it('saves a gradient to the drawer', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(useAppStore.getState().saved[0]).toEqual(sampleGradient)
  })

  it('dedupes saving the same gradient signature twice', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().saveGradient({ ...sampleGradient, id: 'g1-dup' })
    expect(useAppStore.getState().saved).toHaveLength(1)
  })

  it('persists saved gradients to localStorage', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    const raw = localStorage.getItem('palette-saved-gradients')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).state.saved).toHaveLength(1)
  })

  it('switches to edit mode', () => {
    useAppStore.getState().enterEditMode()
    expect(useAppStore.getState().mode).toBe('edit')
  })

  it('switches back to explore mode', () => {
    useAppStore.getState().enterEditMode()
    useAppStore.getState().exitEditMode()
    expect(useAppStore.getState().mode).toBe('explore')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- useAppStore`
Expected: FAIL — `Cannot find module './useAppStore'`

- [ ] **Step 4: Implement `src/store/useAppStore.ts`**

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Gradient, ViewMode } from './types'

function gradientSignature(gradient: Gradient): string {
  return `${gradient.type}:${gradient.stops.map((s) => `${s.hex}@${s.position}`).join(',')}`
}

interface AppState {
  mode: ViewMode
  current: Gradient | null
  saved: Gradient[]
  setCurrentGradient: (gradient: Gradient) => void
  saveGradient: (gradient: Gradient) => void
  enterEditMode: () => void
  exitEditMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'explore',
      current: null,
      saved: [],
      setCurrentGradient: (gradient) => set({ current: gradient }),
      saveGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        const alreadySaved = get().saved.some((g) => gradientSignature(g) === signature)
        if (alreadySaved) return
        set({ saved: [...get().saved, gradient] })
      },
      enterEditMode: () => set({ mode: 'edit' }),
      exitEditMode: () => set({ mode: 'explore' }),
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({ saved: state.saved }),
    }
  )
)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- useAppStore`
Expected: `7 passed`

- [ ] **Step 6: Commit**

```bash
git add src/store/types.ts src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add Zustand store for exploration/edit mode and saved drawer"
```

---

## Task 6: Double-tap detection hook

**Files:**
- Create: `src/hooks/useDoubleTap.ts`
- Test: `src/hooks/useDoubleTap.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useDoubleTap.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useDoubleTap } from './useDoubleTap'

function TestTarget({ onDoubleTap, onSingleTap }: { onDoubleTap: () => void; onSingleTap?: () => void }) {
  const handlers = useDoubleTap(onDoubleTap, onSingleTap)
  return <div data-testid="target" {...handlers} />
}

describe('useDoubleTap', () => {
  it('fires onDoubleTap when two pointerups occur within 300ms', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<TestTarget onDoubleTap={onDoubleTap} />)
    const target = getByTestId('target')

    fireEvent.pointerUp(target)
    fireEvent.pointerUp(target)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
  })

  it('does not fire onDoubleTap when pointerups are more than 300ms apart', async () => {
    vi.useFakeTimers()
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<TestTarget onDoubleTap={onDoubleTap} />)
    const target = getByTestId('target')

    fireEvent.pointerUp(target)
    vi.advanceTimersByTime(400)
    fireEvent.pointerUp(target)

    expect(onDoubleTap).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('fires onSingleTap after the debounce window if no second tap occurs', () => {
    vi.useFakeTimers()
    const onSingleTap = vi.fn()
    const { getByTestId } = render(<TestTarget onDoubleTap={vi.fn()} onSingleTap={onSingleTap} />)
    const target = getByTestId('target')

    fireEvent.pointerUp(target)
    vi.advanceTimersByTime(350)

    expect(onSingleTap).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useDoubleTap`
Expected: FAIL — `Cannot find module './useDoubleTap'`

- [ ] **Step 3: Implement `src/hooks/useDoubleTap.ts`**

```ts
import { useRef } from 'react'

const DOUBLE_TAP_WINDOW_MS = 300

export function useDoubleTap(onDoubleTap: () => void, onSingleTap?: () => void) {
  const lastTapRef = useRef<number>(0)
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onPointerUp() {
    const now = Date.now()
    const elapsed = now - lastTapRef.current

    if (elapsed > 0 && elapsed < DOUBLE_TAP_WINDOW_MS) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current)
        singleTapTimeoutRef.current = null
      }
      lastTapRef.current = 0
      onDoubleTap()
      return
    }

    lastTapRef.current = now
    if (onSingleTap) {
      singleTapTimeoutRef.current = setTimeout(() => {
        onSingleTap()
        singleTapTimeoutRef.current = null
      }, DOUBLE_TAP_WINDOW_MS)
    }
  }

  return { onPointerUp }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useDoubleTap`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDoubleTap.ts src/hooks/useDoubleTap.test.tsx
git commit -m "feat: add pointer-based double-tap/single-tap detection hook"
```

---

## Task 7: GradientPage component (single gradient view + save flash)

**Files:**
- Create: `src/components/GradientPage.tsx`
- Create: `src/components/GradientPage.module.css`
- Test: `src/components/GradientPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/GradientPage.test.tsx`:
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
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.backgroundImage).toContain('linear-gradient')
    expect(page.style.backgroundImage).toContain('#ff0000')
  })

  it('calls onSave and shows a heart flash on double-tap', () => {
    const onSave = vi.fn()
    render(<GradientPage gradient={gradient} onSave={onSave} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    fireEvent.pointerUp(page)

    expect(onSave).toHaveBeenCalledWith(gradient)
    expect(screen.getByTestId('heart-flash')).toBeInTheDocument()
  })

  it('calls onEdit on a single tap after the debounce window', () => {
    vi.useFakeTimers()
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    vi.advanceTimersByTime(350)

    expect(onEdit).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('sets touch-action manipulation to suppress native zoom', () => {
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.touchAction).toBe('manipulation')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GradientPage`
Expected: FAIL — `Cannot find module './GradientPage'`

- [ ] **Step 3: Implement `src/components/GradientPage.module.css`**

```css
.page {
  width: 100%;
  height: 100vh;
  scroll-snap-align: start;
  position: relative;
}

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

- [ ] **Step 4: Implement `src/components/GradientPage.tsx`**

```tsx
import { useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useDoubleTap } from '../hooks/useDoubleTap'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

interface GradientPageProps {
  gradient: Gradient
  onSave: (gradient: Gradient) => void
  onEdit: () => void
}

export function GradientPage({ gradient, onSave, onEdit }: GradientPageProps) {
  const [showHeart, setShowHeart] = useState(false)

  function handleDoubleTap() {
    onSave(gradient)
    setShowHeart(true)
    setTimeout(() => setShowHeart(false), 500)
  }

  const { onPointerUp } = useDoubleTap(handleDoubleTap, onEdit)

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: buildGradientCss(gradient.type, gradient.stops),
        touchAction: 'manipulation',
      }}
      onPointerUp={onPointerUp}
    >
      {showHeart && (
        <svg data-testid="heart-flash" className={styles.heartFlash} viewBox="0 0 32 32">
          <polygon points="16,4 20,12 28,12 22,18 24,28 16,22 8,28 10,18 4,12 12,12" fill="white" />
        </svg>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- GradientPage`
Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/components/GradientPage.tsx src/components/GradientPage.module.css src/components/GradientPage.test.tsx
git commit -m "feat: add GradientPage with double-tap save and heart flash animation"
```

---

## Task 8: Feed component (scroll-snap generation, double-buffered)

**Files:**
- Create: `src/components/Feed.tsx`
- Create: `src/components/Feed.module.css`
- Test: `src/components/Feed.test.tsx`

**Note (post-review amendment):** The first implementation of this task rendered a single `GradientPage` (100vh) inside a 100vh container with `overflow-y: scroll`. Since content height equalled container height, `scrollHeight === clientHeight` always — there was nothing to scroll in a real browser, so the "swipe to generate" interaction from the spec did not actually work outside of unit tests that stub `scrollTop`/`scrollHeight`/`clientHeight` directly. The fix below double-buffers the feed: it renders the current gradient AND a pre-generated "next" gradient stacked below it, giving the container genuine `2 * 100vh` of scrollable content. Scrolling near the bottom promotes `next` to `current`, generates a fresh `next`, and resets `scrollTop` to 0 so the view snaps back to the top page — creating the illusion of an infinite single-page feed.

- [ ] **Step 1: Write failing tests**

Create `src/components/Feed.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Feed } from './Feed'
import { useAppStore } from '../store/useAppStore'
import * as paletteLib from '../lib/palette'

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

describe('Feed', () => {
  it('generates an initial gradient on mount if none exists', () => {
    render(<Feed />)
    expect(useAppStore.getState().current).not.toBeNull()
  })

  it('renders a GradientPage for the current gradient', () => {
    render(<Feed />)
    expect(screen.getAllByTestId('gradient-page').length).toBeGreaterThanOrEqual(1)
  })

  it('double-buffers by rendering both the current and next GradientPage, giving the container real scrollable content', () => {
    render(<Feed />)
    // jsdom doesn't compute real layout, so we can't assert pixel scrollHeight;
    // the meaningful assertion is that 2 stacked pages are rendered, which is
    // what makes scrollHeight > clientHeight possible in a real browser.
    expect(screen.getAllByTestId('gradient-page')).toHaveLength(2)
  })

  it('generates a new gradient when scrolled near the bottom boundary', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')

    Object.defineProperty(container, 'scrollTop', { value: 900, writable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, writable: true })
    container.dispatchEvent(new Event('scroll'))

    // Promoting `next` to `current` doesn't itself call generateGradientStops,
    // but replacing the now-consumed `next` with a fresh one does.
    expect(generateSpy).toHaveBeenCalled()
    expect(useAppStore.getState().current).not.toEqual(first)
  })

  it('resets scrollTop to 0 after promoting the next gradient, so the feed snaps back to the top page', () => {
    render(<Feed />)
    const container = screen.getByTestId('feed-container') as HTMLDivElement

    Object.defineProperty(container, 'scrollTop', { value: 900, writable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, writable: true })
    container.dispatchEvent(new Event('scroll'))

    expect(container.scrollTop).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Feed`
Expected: FAIL — `Cannot find module './Feed'`

- [ ] **Step 3: Implement `src/components/Feed.module.css`**

```css
.container {
  width: 100%;
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}
```

Note: the container CSS itself doesn't need to change for the double-buffer fix — `height: 100vh` and `overflow-y: scroll` are already correct. The fix is about content height (two stacked `GradientPage`s = `2 * 100vh`), not container styling.

- [ ] **Step 4: Implement `src/components/Feed.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { generateGradientStops } from '../lib/palette'
import { GradientPage } from './GradientPage'
import type { GradientType } from '../lib/gradient'
import type { Gradient } from '../store/types'
import styles from './Feed.module.css'

const GEOMETRY_TYPES: GradientType[] = ['linear', 'radial', 'angular', 'square']

function pickRandomType(): GradientType {
  return GEOMETRY_TYPES[Math.floor(Math.random() * GEOMETRY_TYPES.length)]
}

function makeGradient(): Gradient {
  return {
    id: crypto.randomUUID(),
    type: pickRandomType(),
    stops: generateGradientStops(),
  }
}

const SCROLL_BOUNDARY_PX = 100

export function Feed() {
  const current = useAppStore((s) => s.current)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const enterEditMode = useAppStore((s) => s.enterEditMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nextGradient, setNextGradient] = useState<Gradient>(() => makeGradient())

  useEffect(() => {
    if (!current) {
      setCurrentGradient(makeGradient())
    }
  }, [current, setCurrentGradient])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < SCROLL_BOUNDARY_PX) {
      setCurrentGradient(nextGradient)
      setNextGradient(makeGradient())
      el.scrollTop = 0
    }
  }

  if (!current) return null

  return (
    <div
      data-testid="feed-container"
      ref={containerRef}
      className={styles.container}
      onScroll={handleScroll}
    >
      <GradientPage gradient={current} onSave={saveGradient} onEdit={enterEditMode} />
      <GradientPage gradient={nextGradient} onSave={saveGradient} onEdit={enterEditMode} />
    </div>
  )
}
```

Rendering two stacked `GradientPage` instances (current + next) is what gives the container genuine `2 * 100vh` of content, so `scrollHeight > clientHeight` and the feed is actually scrollable in a real browser — not just in tests that stub layout properties.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- Feed`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add src/components/Feed.tsx src/components/Feed.module.css src/components/Feed.test.tsx
git commit -m "feat: add scroll-snap Feed that generates gradients on demand"
```

(Historical note: the initial commit for this task shipped the single-page version described above; a follow-up commit, `fix: double-buffer Feed so scroll container has real scrollable content`, applied the double-buffer fix documented in this section.)

---

## Task 9: Saved drawer component

**Files:**
- Create: `src/components/Drawer.tsx`
- Create: `src/components/Drawer.module.css`
- Test: `src/components/Drawer.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/Drawer.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'
import type { Gradient } from '../store/types'

const gradients: Gradient[] = [
  { id: 'a', type: 'linear', stops: [{ hex: '#ff0000', position: 0 }, { hex: '#00ff00', position: 100 }] },
  { id: 'b', type: 'radial', stops: [{ hex: '#0000ff', position: 0 }, { hex: '#ffff00', position: 100 }] },
]

describe('Drawer', () => {
  it('renders one thumbnail per saved gradient', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    expect(screen.getAllByTestId('drawer-thumbnail')).toHaveLength(2)
  })

  it('renders nothing but the container when there are no saved gradients', () => {
    render(<Drawer saved={[]} onSelect={vi.fn()} />)
    expect(screen.queryAllByTestId('drawer-thumbnail')).toHaveLength(0)
  })

  it('calls onSelect with the gradient when a thumbnail is tapped', () => {
    const onSelect = vi.fn()
    render(<Drawer saved={gradients} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByTestId('drawer-thumbnail')[1])
    expect(onSelect).toHaveBeenCalledWith(gradients[1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Drawer`
Expected: FAIL — `Cannot find module './Drawer'`

- [ ] **Step 3: Implement `src/components/Drawer.module.css`**

```css
.drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px;
  background: rgba(0, 0, 0, 0.6);
}

.thumbnail {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}
```

- [ ] **Step 4: Implement `src/components/Drawer.tsx`**

```tsx
import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
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
          data-testid="drawer-thumbnail"
          className={styles.thumbnail}
          style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops) }}
          onClick={() => onSelect(gradient)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- Drawer`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/components/Drawer.tsx src/components/Drawer.module.css src/components/Drawer.test.tsx
git commit -m "feat: add saved-gradients drawer"
```

---

## Task 10: Edit Mode stub and App wiring

**Files:**
- Create: `src/components/EditModeStub.tsx`
- Create: `src/components/EditModeStub.module.css`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/App.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './store/useAppStore'

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('App', () => {
  it('shows the Feed in explore mode', () => {
    render(<App />)
    expect(screen.getByTestId('feed-container')).toBeInTheDocument()
  })

  it('shows the EditModeStub after a single tap on the gradient', () => {
    vi.useFakeTimers()
    render(<App />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    vi.advanceTimersByTime(350)

    expect(screen.getByTestId('edit-mode-stub')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders the drawer with a saved gradient after double-tap', () => {
    render(<App />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    fireEvent.pointerUp(page)

    expect(screen.getAllByTestId('drawer-thumbnail')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL — `App` doesn't yet wire mode/drawer

- [ ] **Step 3: Implement `src/components/EditModeStub.module.css`**

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.preview {
  flex: 0 0 40%;
  transition: flex-basis 300ms ease;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}
```

- [ ] **Step 4: Implement `src/components/EditModeStub.tsx`**

```tsx
import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import styles from './EditModeStub.module.css'

interface EditModeStubProps {
  gradient: Gradient
  onExit: () => void
}

export function EditModeStub({ gradient, onExit }: EditModeStubProps) {
  return (
    <div data-testid="edit-mode-stub" className={styles.container}>
      <div
        className={styles.preview}
        style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops) }}
      />
      <div className={styles.placeholder} onClick={onExit}>
        Edit Mode coming soon — tap to go back
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement `src/App.tsx`**

```tsx
import { useAppStore } from './store/useAppStore'
import { Feed } from './components/Feed'
import { Drawer } from './components/Drawer'
import { EditModeStub } from './components/EditModeStub'

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)

  if (mode === 'edit' && current) {
    return <EditModeStub gradient={current} onExit={exitEditMode} />
  }

  return (
    <>
      <Feed />
      <Drawer
        saved={saved}
        onSelect={(gradient) => {
          setCurrentGradient(gradient)
        }}
      />
    </>
  )
}
```

- [ ] **Step 6: Update `src/main.tsx` to use the named `App` export**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- App`
Expected: `3 passed`

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all tests pass (oklch, gradient, palette, useAppStore, useDoubleTap, GradientPage, Feed, Drawer, App)

- [ ] **Step 9: Commit**

```bash
git add src/components/EditModeStub.tsx src/components/EditModeStub.module.css src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat: wire explore/edit mode transition with Edit Mode stub"
```

---

## Task 11: Manual verification pass

**Files:** none (manual QA step)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: In a mobile-width browser window (or device emulation), verify:**
  - Swiping down loads a new gradient each time you approach the bottom of the viewport.
  - Gradient geometry types vary across generations (linear, radial, angular, square).
  - Double-tapping a gradient flashes the heart icon and adds a thumbnail to the bottom drawer.
  - Native double-tap-to-zoom does NOT trigger (touch-action: manipulation is working).
  - A single tap on the gradient (not part of a double-tap) transitions to the Edit Mode stub after a brief delay.
  - Tapping "Edit Mode coming soon" returns to the feed.
  - Tapping a drawer thumbnail loads that gradient into view.
  - Reloading the page preserves the saved drawer contents (localStorage persistence).

- [ ] **Step 3: Fix any issues found, re-running the relevant test file after each fix**

- [ ] **Step 4: Final commit if fixes were made**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

---

## Self-Review Notes

- **Spec coverage:** Color engine (Task 2, 4), all 4 gradient geometries (Task 3), scroll-snap generate-on-demand feed (Task 8), double-tap save + heart flash + touch-action (Task 6, 7), drawer with localStorage persistence (Task 5, 9), tap-to-edit transition into a stubbed Edit Mode (Task 10) — all spec sections are covered.
- **Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code.
- **Type consistency:** `Gradient`, `GradientStop`, `GradientType` are defined once (`store/types.ts` re-exports the `lib/gradient.ts` shapes conceptually; `Feed.tsx` imports `GradientType` from `lib/gradient` and constructs `Gradient` objects matching `store/types.ts`'s shape) and used consistently across Feed, GradientPage, Drawer, and EditModeStub. `useAppStore` methods (`setCurrentGradient`, `saveGradient`, `enterEditMode`, `exitEditMode`) are named identically everywhere they're called.
