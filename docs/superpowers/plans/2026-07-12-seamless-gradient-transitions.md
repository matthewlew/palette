# Seamless Gradient Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Create feed's gradients flow into one another — neighbors share color proximity and the change between them animates — instead of cutting between unrelated colors.

**Architecture:** Two composable pure-logic modules plus thin wiring. `lib/drift.ts` generates each forward gradient as a bounded OKLCH random-walk from the previous one (preserving stop count/positions). `lib/morph.ts` interpolates two equal-length stop lists in OKLCH. A thin `hooks/useMorph.ts` drives the morph over rAF and hands the feed an interpolated gradient to render. Feed wiring swaps random generation for drift and renders the morphed gradient, skipping the morph during momentum / reduced-motion / stop-count mismatch.

**Tech Stack:** TypeScript, React, Vitest + Testing Library, existing `lib/oklch.ts` (`hexToOklch`, `oklchToHex`, `blendOklchHex`).

---

## File Structure

- Create: `src/lib/drift.ts` — `driftGradientStops(prev, rng?)`, pure.
- Create: `src/lib/drift.test.ts`
- Create: `src/lib/morph.ts` — `morphStops(from, to, t)`, pure.
- Create: `src/lib/morph.test.ts`
- Create: `src/hooks/useMorph.ts` — rAF controller returning the gradient to render.
- Create: `src/hooks/useMorph.test.tsx`
- Modify: `src/components/Feed.tsx` — drift on forward generation; render morphed gradient.

---

### Task 1: `driftGradientStops` — bounded OKLCH random-walk

**Files:**
- Create: `src/lib/drift.ts`
- Test: `src/lib/drift.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/drift.test.ts
import { describe, it, expect } from 'vitest'
import { driftGradientStops } from './drift'
import { hexToOklch } from './oklch'
import type { GradientStop } from './gradient'

const prev: GradientStop[] = [
  { hex: '#2e7d32', position: 0 },
  { hex: '#66bb6a', position: 100 },
]

// Deterministic RNG returning a fixed sequence, cycling.
function seqRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('driftGradientStops', () => {
  it('preserves stop count and positions', () => {
    const next = driftGradientStops(prev, seqRng([0.5]))
    expect(next).toHaveLength(prev.length)
    expect(next.map((s) => s.position)).toEqual([0, 100])
  })

  it('nudges each stop within the per-channel bounds (hue +/-20, L +/-0.05, C +/-0.04)', () => {
    // rng=1 pushes every channel to its positive extreme.
    const next = driftGradientStops(prev, seqRng([1]))
    next.forEach((s, i) => {
      const before = hexToOklch(prev[i].hex)
      const after = hexToOklch(s.hex)
      // Allow small round-trip error from hex quantization.
      expect(Math.abs(after.l - before.l)).toBeLessThanOrEqual(0.05 + 0.01)
      expect(Math.abs(after.c - before.c)).toBeLessThanOrEqual(0.04 + 0.01)
      let dh = Math.abs(after.h - before.h)
      if (dh > 180) dh = 360 - dh
      expect(dh).toBeLessThanOrEqual(20 + 1)
    })
  })

  it('returns a different palette than the input (it actually drifts)', () => {
    const next = driftGradientStops(prev, seqRng([1]))
    expect(next.map((s) => s.hex)).not.toEqual(prev.map((s) => s.hex))
  })

  it('is a pure function of prev + rng (no mutation of input)', () => {
    const snapshot = JSON.parse(JSON.stringify(prev))
    driftGradientStops(prev, seqRng([0.3, 0.7]))
    expect(prev).toEqual(snapshot)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/drift.test.ts`
Expected: FAIL — `driftGradientStops` is not defined / module missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/drift.ts
import type { GradientStop } from './gradient'
import { hexToOklch, oklchToHex } from './oklch'

const HUE_DELTA = 20 // degrees
const L_DELTA = 0.05
const C_DELTA = 0.04

// Map an rng() in [0,1) to a signed delta in [-mag, +mag].
function signed(rng: () => number, mag: number): number {
  return (rng() * 2 - 1) * mag
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Generate the next gradient's stops as a bounded random-walk from `prev` in
 * OKLCH space. Stop count and positions are preserved; only each stop's color
 * drifts, so consecutive gradients read as close color-neighbors and any morph
 * between them stays a valid gradient.
 */
export function driftGradientStops(
  prev: GradientStop[],
  rng: () => number = Math.random,
): GradientStop[] {
  return prev.map((stop) => {
    const c = hexToOklch(stop.hex)
    const next = {
      l: clamp(c.l + signed(rng, L_DELTA), 0, 1),
      c: clamp(c.c + signed(rng, C_DELTA), 0, 0.4),
      h: (c.h + signed(rng, HUE_DELTA) + 360) % 360,
    }
    return { ...stop, hex: oklchToHex(next) }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/drift.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drift.ts src/lib/drift.test.ts
git commit -m "feat: driftGradientStops - bounded OKLCH random-walk for feed sequencing"
```

---

### Task 2: Wire drift into the feed's forward generation

**Files:**
- Modify: `src/components/Feed.tsx` (`makeGradient` helper ~line 25, and `goTo` forward-generation branch ~line 204-209)

**Context:** `goTo` currently generates a fresh random gradient when scrolling past the end of history: `const fresh = makeGradient(feedSession.lockedType!, activeColorSet)`. We change this so that when a previous gradient exists, the fresh one drifts from it; the very first gradient of a session still seeds from `activeColorSet`.

- [ ] **Step 1: Add a drift-based generator next to `makeGradient`**

In `src/components/Feed.tsx`, add the import near the other `lib` imports (top of file, alongside `import { generateGradientStops } from '../lib/palette'`):

```typescript
import { driftGradientStops } from '../lib/drift'
```

Add this helper immediately after the existing `makeGradient` function (after `Feed.tsx:33`):

```typescript
/** The next forward gradient: same locked shape, colors drifted from `prev`
 * so the feed walks through nearby colors instead of jumping randomly. */
export function makeDriftedGradient(type: GradientType, prev: Gradient): Gradient {
  return {
    id: crypto.randomUUID(),
    type,
    stops: driftGradientStops(prev.stops),
    reversed: prev.reversed,
  }
}
```

- [ ] **Step 2: Use drift in `goTo`'s forward branch**

Replace the forward-generation block in `goTo` (currently `Feed.tsx:204-209`):

```typescript
    if (newIndex >= history.length) {
      // Forward past the end of history: generate a brand-new gradient,
      // keeping the same locked shape for this Feed session.
      const fresh = makeGradient(feedSession.lockedType!, activeColorSet)
      history.push(fresh)
    }
```

with:

```typescript
    if (newIndex >= history.length) {
      // Forward past the end of history: keep the locked shape. The first
      // gradient of a session seeds from the active color set; every one after
      // drifts from its predecessor so the feed walks through nearby colors.
      const prev = history[history.length - 1]
      const fresh = prev
        ? makeDriftedGradient(feedSession.lockedType!, prev)
        : makeGradient(feedSession.lockedType!, activeColorSet)
      history.push(fresh)
    }
```

- [ ] **Step 3: Run the existing Feed tests + typecheck**

Run: `npx vitest run src/components/Feed.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS / no type errors. (If a Feed test asserted random-color independence between consecutive gradients, update it to assert color *proximity* instead — neighbors should now be close in OKLCH.)

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run the dev server, scroll the Create feed, confirm consecutive gradients are color-adjacent (no wild jumps). No morph yet — swaps are still instant.

- [ ] **Step 5: Commit**

```bash
git add src/components/Feed.tsx
git commit -m "feat: feed forward generation drifts from previous gradient"
```

---

### Task 3: `morphStops` — interpolate two equal-length stop lists

**Files:**
- Create: `src/lib/morph.ts`
- Test: `src/lib/morph.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/morph.test.ts
import { describe, it, expect } from 'vitest'
import { morphStops } from './morph'
import type { GradientStop } from './gradient'

const from: GradientStop[] = [
  { hex: '#2e7d32', position: 0 },
  { hex: '#1565c0', position: 100 },
]
const to: GradientStop[] = [
  { hex: '#66bb6a', position: 0 },
  { hex: '#42a5f5', position: 100 },
]

describe('morphStops', () => {
  it('at t=0 returns the from colors', () => {
    expect(morphStops(from, to, 0).map((s) => s.hex)).toEqual(from.map((s) => s.hex))
  })

  it('at t=1 returns the to colors', () => {
    expect(morphStops(from, to, 1).map((s) => s.hex)).toEqual(to.map((s) => s.hex))
  })

  it('preserves positions from the target', () => {
    expect(morphStops(from, to, 0.5).map((s) => s.position)).toEqual([0, 100])
  })

  it('at t=0.5 each stop lands strictly between the endpoints', () => {
    const mid = morphStops(from, to, 0.5)
    mid.forEach((s, i) => {
      expect(s.hex).not.toEqual(from[i].hex)
      expect(s.hex).not.toEqual(to[i].hex)
    })
  })

  it('throws on mismatched lengths (callers must guard)', () => {
    expect(() => morphStops(from, [to[0]], 0.5)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/morph.test.ts`
Expected: FAIL — `morphStops` not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/morph.ts
import type { GradientStop } from './gradient'
import { blendOklchHex } from './oklch'

/**
 * Interpolate two equal-length stop lists in OKLCH at fraction `t` (0..1).
 * Positions come from `to` (drift keeps positions constant, so this is a no-op
 * for the feed's own steps but is correct if positions ever differ). Callers
 * MUST ensure equal lengths; mismatched lists throw.
 */
export function morphStops(
  from: GradientStop[],
  to: GradientStop[],
  t: number,
): GradientStop[] {
  if (from.length !== to.length) {
    throw new Error('morphStops requires equal-length stop lists')
  }
  return to.map((toStop, i) => ({
    ...toStop,
    hex: blendOklchHex(from[i].hex, toStop.hex, t),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/morph.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/morph.ts src/lib/morph.test.ts
git commit -m "feat: morphStops - OKLCH interpolation between two stop lists"
```

---

### Task 4: `useMorph` hook — drive the morph over rAF

**Files:**
- Create: `src/hooks/useMorph.ts`
- Test: `src/hooks/useMorph.test.tsx`

**Context:** The hook takes the target gradient plus a `skip` flag and returns the gradient to render. When the target changes and `skip` is false, both gradients have equal stop counts, and reduced-motion is off, it animates the rendered stops from the previously-rendered frame to the new target over `DURATION_MS`. On interruption (target changes mid-morph) it restarts from the current rendered frame. Otherwise it returns the target immediately (instant swap).

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/useMorph.test.tsx
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMorph } from './useMorph'
import type { Gradient } from '../store/types'

const g = (id: string, hexes: string[]): Gradient => ({
  id,
  type: 'linear',
  stops: hexes.map((hex, i) => ({ hex, position: i * 100 })),
  reversed: false,
})

const A = g('a', ['#2e7d32', '#1565c0'])
const B = g('b', ['#66bb6a', '#42a5f5'])

describe('useMorph', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Deterministic rAF ~16ms per frame.
    let now = 0
    vi.stubGlobal('performance', { now: () => now })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => {
        now += 16
        cb(now)
      }, 16) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns the target immediately when skip is true', () => {
    const { result, rerender } = renderHook(({ target, skip }) => useMorph(target, skip), {
      initialProps: { target: A, skip: true },
    })
    rerender({ target: B, skip: true })
    expect(result.current.stops.map((s) => s.hex)).toEqual(B.stops.map((s) => s.hex))
  })

  it('animates from A to B over the duration when not skipping', () => {
    const { result, rerender } = renderHook(({ target, skip }) => useMorph(target, skip), {
      initialProps: { target: A, skip: false },
    })
    rerender({ target: B, skip: false })
    // Mid-flight: not yet equal to B.
    act(() => { vi.advanceTimersByTime(48) })
    expect(result.current.stops.map((s) => s.hex)).not.toEqual(B.stops.map((s) => s.hex))
    // After the full duration: equal to B.
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current.stops.map((s) => s.hex)).toEqual(B.stops.map((s) => s.hex))
  })

  it('falls back to instant swap on stop-count mismatch', () => {
    const C = g('c', ['#ff0000', '#00ff00', '#0000ff'])
    const { result, rerender } = renderHook(({ target, skip }) => useMorph(target, skip), {
      initialProps: { target: A, skip: false },
    })
    rerender({ target: C, skip: false })
    expect(result.current.stops.map((s) => s.hex)).toEqual(C.stops.map((s) => s.hex))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useMorph.test.tsx`
Expected: FAIL — `useMorph` not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hooks/useMorph.ts
import { useEffect, useRef, useState } from 'react'
import type { Gradient } from '../store/types'
import { morphStops } from '../lib/morph'

const DURATION_MS = 300

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Returns the gradient to render for `target`. When `target` changes and `skip`
 * is false, both gradients share a stop count, and reduced-motion is off, the
 * returned gradient's stops animate (OKLCH) from the currently-rendered frame to
 * the target over DURATION_MS. Interrupting a morph restarts from the current
 * frame; mismatched stop counts or skip => instant swap.
 */
export function useMorph(target: Gradient, skip: boolean): Gradient {
  const [rendered, setRendered] = useState<Gradient>(target)
  const renderedRef = useRef(rendered)
  renderedRef.current = rendered
  const frameRef = useRef<number | null>(null)
  const prevTargetId = useRef(target.id)

  useEffect(() => {
    if (target.id === prevTargetId.current) {
      // Same identity, but stops may have mutated in place (shape flip etc.).
      setRendered(target)
      return
    }
    prevTargetId.current = target.id

    const from = renderedRef.current
    const canMorph =
      !skip &&
      !prefersReducedMotion() &&
      from.stops.length === target.stops.length

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    if (!canMorph) {
      setRendered(target)
      return
    }

    const fromStops = from.stops
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = easeOut(t)
      setRendered({ ...target, stops: morphStops(fromStops, target.stops, eased) })
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, skip])

  return rendered
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useMorph.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMorph.ts src/hooks/useMorph.test.tsx
git commit -m "feat: useMorph - rAF OKLCH morph controller with skip + mismatch fallback"
```

---

### Task 5: Render the morphed gradient in the feed

**Files:**
- Modify: `src/components/Feed.tsx` (import + the `GradientPage` render block ~line 509-519, using `momentumFrameIdRef`)

**Context:** The morph must be skipped during momentum scrolling. `momentumFrameIdRef.current !== null` is exactly "momentum is running." We compute a `skip` flag from it and feed `displayed` through `useMorph`, rendering the result.

- [ ] **Step 1: Import the hook**

Add near the other hook imports in `src/components/Feed.tsx`:

```typescript
import { useMorph } from '../hooks/useMorph'
```

- [ ] **Step 2: Derive the rendered gradient before the early return**

Immediately BEFORE `if (!displayed) return null` (`Feed.tsx:509`), add:

```typescript
  // Skip the morph during momentum flings so fast scrolling stays snappy; the
  // morph only plays when the user settles on a gradient. useMorph must run on
  // every render (hook rules), so it takes a possibly-null target safely.
  const morphSkip = momentumFrameIdRef.current !== null
  const rendered = useMorph(displayed ?? EMPTY_GRADIENT, morphSkip)
```

Add this module-level constant near the top of the file (after the imports):

```typescript
// Stable placeholder so useMorph can be called unconditionally even before the
// first gradient exists; it is never rendered (guarded by the null check below).
const EMPTY_GRADIENT: Gradient = {
  id: '__empty__',
  type: 'linear',
  stops: [
    { hex: '#000000', position: 0 },
    { hex: '#000000', position: 100 },
  ],
  reversed: false,
}
```

- [ ] **Step 3: Render `rendered` instead of `displayed`**

In the `GradientPage` block (`Feed.tsx:513-514`), change the `gradient` prop from `displayed` to `rendered`:

```typescript
      <GradientPage
        gradient={rendered}
```

Leave every other prop that references `displayed` (e.g. `liked={isGradientSaved(displayed)}`, save handlers) unchanged — those act on the *target* gradient the user is on, not the in-between morph frame.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/Feed.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 5: Manual smoke**

Dev server → scroll the Create feed one step at a time: the gradient should visibly flow (~300ms) from one to the next. Fast-fling: should stay snappy (no laggy morph). Toggle OS reduced-motion: swaps become instant.

- [ ] **Step 6: Commit**

```bash
git add src/components/Feed.tsx
git commit -m "feat: render morphed gradient in feed, skip during momentum"
```

---

## Self-Review

**Spec coverage:**
- Lever A (drift) → Tasks 1–2. ✓
- Lever B (morph) → Tasks 3–5. ✓
- Seeding from `activeColorSet` on first gradient → Task 2 Step 2. ✓
- Edge case 1 (momentum → skip) → Task 5 Steps 2. ✓
- Edge case 2 (interrupt → restart from current frame) → Task 4 impl (`renderedRef` as `from`) + covered implicitly. ✓
- Edge case 3 (stop-count mismatch → instant) → Task 4 (`canMorph` guard) + test. ✓
- `prefers-reduced-motion` → Task 4 (`prefersReducedMotion`). ✓
- Scope: only Feed forward generation + settle render touched; `cycleShape` untouched. ✓

**Placeholder scan:** none — all steps carry real code and commands.

**Type consistency:** `driftGradientStops(prev, rng?)`, `morphStops(from, to, t)`, `useMorph(target, skip)`, `makeDriftedGradient(type, prev)` are referenced consistently across tasks. `Gradient`/`GradientStop` imported from existing `store/types` and `lib/gradient`.
