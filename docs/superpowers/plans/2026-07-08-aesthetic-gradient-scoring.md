# Aesthetic Gradient Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `generateGradientStops` an internal quality bias so it favors palettes with wide lightness range, distinct hues, and enough saturation, without changing its public signature or adding any UI.

**Architecture:** A new pure module `src/lib/paletteScore.ts` exposes five OKLCH-based factor functions plus a weighted `scorePalette` combinator (0–100). `generateGradientStops` in `src/lib/palette.ts` builds 8 candidate color sets instead of 1, scores each, and weighted-randomly picks one using `score²` as the sampling weight.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

---

## Context for the engineer

- `src/lib/oklch.ts` defines `Oklch { l, c, h }` (l: 0-1, c: 0-0.4ish, h: 0-360 degrees) and `oklchToHex`.
- `src/lib/palette.ts` currently has `generateGradientStops(colorSet)`: picks 3-6 random colors from `colorSet.colors`, jitters each in OKLCH, converts to hex, assigns evenly-spaced 0-100 positions.
- Design doc: `docs/superpowers/specs/2026-07-08-aesthetic-gradient-scoring-design.md` — read it if anything below is ambiguous.
- Test runner: `npm test` runs `vitest run`. Run a single file with `npx vitest run src/lib/paletteScore.test.ts`.
- Existing test style: `describe`/`it`/`expect` from `vitest`, see `src/lib/palette.test.ts` for the pattern.

---

### Task 1: `saturationSpread` and `lightnessRange` factors

**Files:**
- Create: `src/lib/paletteScore.ts`
- Test: `src/lib/paletteScore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/paletteScore.test.ts
import { describe, it, expect } from 'vitest'
import { saturationSpread, lightnessRange } from './paletteScore'
import type { Oklch } from './oklch'

describe('saturationSpread', () => {
  it('returns 0 for identical chroma', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.1, h: 0 },
      { l: 0.5, c: 0.1, h: 120 },
      { l: 0.5, c: 0.1, h: 240 },
    ]
    expect(saturationSpread(colors)).toBe(0)
  })

  it('returns higher values for wider chroma spread', () => {
    const tight: Oklch[] = [
      { l: 0.5, c: 0.08, h: 0 },
      { l: 0.5, c: 0.09, h: 120 },
      { l: 0.5, c: 0.1, h: 240 },
    ]
    const wide: Oklch[] = [
      { l: 0.5, c: 0.01, h: 0 },
      { l: 0.5, c: 0.2, h: 120 },
      { l: 0.5, c: 0.35, h: 240 },
    ]
    expect(saturationSpread(wide)).toBeGreaterThan(saturationSpread(tight))
  })

  it('clamps to [0, 1]', () => {
    const extreme: Oklch[] = [
      { l: 0.5, c: 0, h: 0 },
      { l: 0.5, c: 0.4, h: 180 },
    ]
    const v = saturationSpread(extreme)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  })
})

describe('lightnessRange', () => {
  it('returns 0 for identical lightness', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.1, h: 0 },
      { l: 0.5, c: 0.1, h: 120 },
    ]
    expect(lightnessRange(colors)).toBe(0)
  })

  it('returns 1 for full dark-to-light spread', () => {
    const colors: Oklch[] = [
      { l: 0.1, c: 0.05, h: 30 },
      { l: 0.9, c: 0.05, h: 30 },
    ]
    expect(lightnessRange(colors)).toBe(1)
  })

  it('returns higher values for wider range than narrower range', () => {
    const narrow: Oklch[] = [
      { l: 0.4, c: 0.1, h: 0 },
      { l: 0.5, c: 0.1, h: 0 },
    ]
    const wide: Oklch[] = [
      { l: 0.2, c: 0.1, h: 0 },
      { l: 0.8, c: 0.1, h: 0 },
    ]
    expect(lightnessRange(wide)).toBeGreaterThan(lightnessRange(narrow))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: FAIL with "Failed to resolve import './paletteScore'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/paletteScore.ts
import type { Oklch } from './oklch'

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

// Normalizes chroma stddev against an empirically reasonable ceiling
// (0.22) — Bklyn Clay's glaze-saturation scoring used the same ceiling
// for an equivalent [0, 0.4]-range saturation field.
export function saturationSpread(colors: Oklch[]): number {
  const chromas = colors.map((c) => c.c)
  const mean = chromas.reduce((a, b) => a + b, 0) / chromas.length
  const variance = chromas.reduce((a, c) => a + (c - mean) ** 2, 0) / chromas.length
  const stddev = Math.sqrt(variance)
  return clamp01(stddev / 0.22)
}

export function lightnessRange(colors: Oklch[]): number {
  const lums = colors.map((c) => c.l)
  const range = Math.max(...lums) - Math.min(...lums)
  return clamp01(range)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paletteScore.ts src/lib/paletteScore.test.ts
git commit -m "feat: add saturationSpread and lightnessRange scoring factors"
```

---

### Task 2: `minPairwiseDistance` factor

**Files:**
- Modify: `src/lib/paletteScore.ts`
- Modify: `src/lib/paletteScore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/paletteScore.test.ts`:

```ts
import { minPairwiseDistance } from './paletteScore'

describe('minPairwiseDistance', () => {
  it('returns 1 for a single color (no pairs)', () => {
    expect(minPairwiseDistance([{ l: 0.5, c: 0.1, h: 0 }])).toBe(1)
  })

  it('returns near 0 for two identical colors', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.1, h: 30 },
      { l: 0.5, c: 0.1, h: 30 },
    ]
    expect(minPairwiseDistance(colors)).toBe(0)
  })

  it('returns 1 for two maximally distant colors', () => {
    const colors: Oklch[] = [
      { l: 0, c: 0, h: 0 },
      { l: 1, c: 0.4, h: 180 },
    ]
    expect(minPairwiseDistance(colors)).toBe(1)
  })

  it('rates a near-duplicate cluster lower than a well-spread set', () => {
    const nearDup: Oklch[] = [
      { l: 0.42, c: 0.09, h: 35 },
      { l: 0.52, c: 0.12, h: 40 },
      { l: 0.35, c: 0.1, h: 30 },
      { l: 0.45, c: 0.13, h: 45 },
    ]
    const spread: Oklch[] = [
      { l: 0.1, c: 0.02, h: 250 },
      { l: 0.35, c: 0.19, h: 345 },
      { l: 0.6, c: 0.15, h: 135 },
      { l: 0.88, c: 0.08, h: 95 },
    ]
    expect(minPairwiseDistance(spread)).toBeGreaterThan(minPairwiseDistance(nearDup))
  })

  it('is driven by the closest pair, not the average', () => {
    const oneCloseePair: Oklch[] = [
      { l: 0.5, c: 0.1, h: 30 },
      { l: 0.5, c: 0.1, h: 32 }, // near-duplicate of the first
      { l: 0.1, c: 0.3, h: 200 }, // far from both
    ]
    expect(minPairwiseDistance(oneCloseePair)).toBeLessThan(0.1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: FAIL with "minPairwiseDistance is not exported" / "is not a function"

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/paletteScore.ts`:

```ts
function circularHueDistance(a: number, h_b: number): number {
  const diff = Math.abs(a - h_b)
  return Math.min(diff, 360 - diff)
}

// Perceptual distance between two OKLCH colors, weighted the same shape
// as Bklyn Clay's glaze pairwise-distance metric: hue 0.35, lightness
// 0.45, chroma 0.20. Hue is normalized by 180 (max circular distance),
// chroma by 0.4 (this app's practical chroma ceiling).
function oklchDistance(a: Oklch, b: Oklch): number {
  return (
    (circularHueDistance(a.h, b.h) / 180) * 0.35 +
    Math.abs(a.l - b.l) * 0.45 +
    (Math.abs(a.c - b.c) / 0.4) * 0.2
  )
}

// Minimum pairwise perceptual distance across all color pairs, normalized
// to [0, 1] against a distance of 0.10 (below which colors read as
// near-duplicates) up to full separation. Single-color input has no
// pairs, so it can't be penalized — returns 1.
export function minPairwiseDistance(colors: Oklch[]): number {
  if (colors.length < 2) return 1
  let min = Infinity
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = oklchDistance(colors[i], colors[j])
      if (d < min) min = d
    }
  }
  return clamp01(min / 0.1)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paletteScore.ts src/lib/paletteScore.test.ts
git commit -m "feat: add minPairwiseDistance scoring factor"
```

---

### Task 3: `hueHarmony` and `achromaticPenalty` factors

**Files:**
- Modify: `src/lib/paletteScore.ts`
- Modify: `src/lib/paletteScore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/paletteScore.test.ts`:

```ts
import { hueHarmony, achromaticPenalty } from './paletteScore'

describe('hueHarmony', () => {
  it('returns 0 for fewer than 2 hues', () => {
    expect(hueHarmony([30])).toBe(0)
  })

  it('scores a tight analogous cluster highly', () => {
    expect(hueHarmony([30, 40, 45, 50])).toBeGreaterThan(0.8)
  })

  it('scores a clean complementary pair highly', () => {
    expect(hueHarmony([30, 210])).toBeGreaterThan(0.8)
  })

  it('scores a clean triadic triplet highly', () => {
    expect(hueHarmony([0, 120, 240])).toBeGreaterThan(0.8)
  })

  it('scores hues evenly scattered around the circle lower than a clean fit', () => {
    const scattered = hueHarmony([10, 95, 180, 265])
    const analogous = hueHarmony([30, 40, 45, 50])
    expect(scattered).toBeLessThan(analogous)
  })
})

describe('achromaticPenalty', () => {
  it('returns 1 for a fully saturated palette', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.15, h: 30 },
      { l: 0.5, c: 0.15, h: 120 },
    ]
    expect(achromaticPenalty(colors)).toBe(1)
  })

  it('returns 1 with exactly one near-gray color', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.15, h: 30 },
      { l: 0.7, c: 0.01, h: 220 },
    ]
    expect(achromaticPenalty(colors)).toBe(1)
  })

  it('penalizes two or more near-gray colors', () => {
    const colors: Oklch[] = [
      { l: 0.7, c: 0.01, h: 220 },
      { l: 0.8, c: 0.008, h: 210 },
      { l: 0.5, c: 0.15, h: 30 },
    ]
    expect(achromaticPenalty(colors)).toBeLessThan(1)
  })

  it('penalizes an all-muddy palette more than a mostly-muddy one', () => {
    const allMuddy: Oklch[] = [
      { l: 0.7, c: 0.01, h: 220 },
      { l: 0.8, c: 0.008, h: 210 },
      { l: 0.55, c: 0.015, h: 230 },
      { l: 0.75, c: 0.01, h: 205 },
    ]
    const mostlyMuddy: Oklch[] = [
      { l: 0.7, c: 0.01, h: 220 },
      { l: 0.8, c: 0.008, h: 210 },
      { l: 0.5, c: 0.15, h: 30 },
    ]
    expect(achromaticPenalty(allMuddy)).toBeLessThan(achromaticPenalty(mostlyMuddy))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: FAIL with "hueHarmony is not exported" / "achromaticPenalty is not exported"

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/paletteScore.ts`. This ports Bklyn Clay's `hd`/`circularSpan`/`harmonyScore` (`~/Documents/bklynclay-glaze/scoring.js`) directly — same math, operates on plain hue-degree numbers so it's portable as-is:

```ts
function hueDelta(a: number, b: number): number {
  return Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
}

function circularSpan(hues: number[]): number {
  if (hues.length <= 1) return 0
  const sorted = [...hues].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length] + (i + 1 === sorted.length ? 360 : 0)
    maxGap = Math.max(maxGap, next - sorted[i])
  }
  return 360 - maxGap
}

// Best-of analogous/complementary/triadic hue fit, 0-1. Ported from
// Bklyn Clay's harmonyScore (scoring.js) — this user's calibration
// demoted this factor's weight relative to Bklyn Clay's own presets,
// but the underlying formula tested well for what it measures.
export function hueHarmony(hues: number[]): number {
  if (hues.length < 2) return 0
  let best = 0
  const span = circularSpan(hues)
  best = Math.max(best, span < 60 ? 1 - (span / 60) * 0.2 : Math.max(0, 1 - (span - 60) / 150))
  for (const h of hues) {
    const comp = (h + 180) % 360
    const devs = hues.map((hh) => Math.min(hueDelta(hh, h), hueDelta(hh, comp)) / 90)
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length)
  }
  for (const h of hues) {
    const h2 = (h + 120) % 360
    const h3 = (h + 240) % 360
    const devs = hues.map((hh) => Math.min(hueDelta(hh, h), hueDelta(hh, h2), hueDelta(hh, h3)) / 60)
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length)
  }
  return clamp01(best)
}

// Penalizes palettes with more than one near-gray (low chroma) color.
// A single muted color reads as intentional; two or more reads as muddy.
export function achromaticPenalty(colors: Oklch[]): number {
  const achromaticCount = colors.filter((c) => c.c < 0.02).length
  if (achromaticCount <= 1) return 1
  return Math.max(0.3, 1 - (achromaticCount - 1) * 0.35)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: PASS (20 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paletteScore.ts src/lib/paletteScore.test.ts
git commit -m "feat: add hueHarmony and achromaticPenalty scoring factors"
```

---

### Task 4: `scorePalette` combinator

**Files:**
- Modify: `src/lib/paletteScore.ts`
- Modify: `src/lib/paletteScore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/paletteScore.test.ts`:

```ts
import { scorePalette, DEFAULT_SCORE_WEIGHTS } from './paletteScore'

describe('scorePalette', () => {
  it('returns 0 for fewer than 2 colors', () => {
    expect(scorePalette([{ l: 0.5, c: 0.1, h: 0 }])).toBe(0)
    expect(scorePalette([])).toBe(0)
  })

  it('returns a value between 0 and 100', () => {
    const colors: Oklch[] = [
      { l: 0.42, c: 0.09, h: 35 },
      { l: 0.68, c: 0.13, h: 95 },
      { l: 0.15, c: 0.005, h: 0 },
    ]
    const score = scorePalette(colors)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('scores a well-spread, distinct-hue palette higher than a muddy near-duplicate one', () => {
    const good: Oklch[] = [
      { l: 0.15, c: 0.005, h: 0 }, // Onyx
      { l: 0.6, c: 0.18, h: 345 }, // Fuchsia
      { l: 0.65, c: 0.04, h: 120 }, // Sage
      { l: 0.88, c: 0.08, h: 95 }, // Butter
    ]
    const bad: Oklch[] = [
      { l: 0.7, c: 0.01, h: 220 }, // Ash
      { l: 0.8, c: 0.008, h: 210 }, // Fog
      { l: 0.6, c: 0.012, h: 225 }, // Concrete
      { l: 0.75, c: 0.01, h: 205 }, // Dove
    ]
    expect(scorePalette(good)).toBeGreaterThan(scorePalette(bad))
  })

  it('DEFAULT_SCORE_WEIGHTS sums to 1', () => {
    const sum = Object.values(DEFAULT_SCORE_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('accepts custom weights', () => {
    const colors: Oklch[] = [
      { l: 0.42, c: 0.09, h: 35 },
      { l: 0.68, c: 0.13, h: 95 },
    ]
    const allLightness = scorePalette(colors, {
      lightnessRange: 1,
      minPairwiseDistance: 0,
      achromaticPenalty: 0,
      saturationSpread: 0,
      hueHarmony: 0,
    })
    expect(allLightness).toBeCloseTo(lightnessRangeScoreForColors(colors) * 100, 5)
  })
})

function lightnessRangeScoreForColors(colors: Oklch[]): number {
  const lums = colors.map((c) => c.l)
  return Math.max(...lums) - Math.min(...lums)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: FAIL with "scorePalette is not exported" / "DEFAULT_SCORE_WEIGHTS is not exported"

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/paletteScore.ts`:

```ts
export interface ScoreWeights {
  lightnessRange: number
  minPairwiseDistance: number
  achromaticPenalty: number
  saturationSpread: number
  hueHarmony: number
}

// Weights derived from a two-round blind ranking calibration (see
// docs/superpowers/specs/2026-07-08-aesthetic-gradient-scoring-design.md):
// lightness range dominated preference, min pairwise distance and the
// achromatic penalty were consistently confirmed, saturation spread read
// as a mild positive, and hue harmony was demoted relative to Bklyn
// Clay's own weighting because raw hue dispersion outranked
// analogous/triadic formula fits in testing.
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  lightnessRange: 0.35,
  minPairwiseDistance: 0.3,
  achromaticPenalty: 0.15,
  saturationSpread: 0.12,
  hueHarmony: 0.08,
}

export function scorePalette(colors: Oklch[], weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): number {
  if (colors.length < 2) return 0
  const f1 = saturationSpread(colors)
  const f2 = lightnessRange(colors)
  const f4 = minPairwiseDistance(colors)
  const f5 = hueHarmony(colors.map((c) => c.h))
  const f7 = achromaticPenalty(colors)
  const weighted =
    f1 * weights.saturationSpread +
    f2 * weights.lightnessRange +
    f4 * weights.minPairwiseDistance +
    f5 * weights.hueHarmony +
    f7 * weights.achromaticPenalty
  return weighted * 100
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/paletteScore.test.ts`
Expected: PASS (25 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paletteScore.ts src/lib/paletteScore.test.ts
git commit -m "feat: add scorePalette weighted combinator"
```

---

### Task 5: wire scoring into `generateGradientStops`

**Files:**
- Modify: `src/lib/palette.ts`
- Modify: `src/lib/palette.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/palette.test.ts`:

```ts
import { scorePalette } from './paletteScore'
import { hexToOklch } from './oklch'

describe('generateGradientStops aesthetic bias', () => {
  it('produces a materially higher average score than unweighted random+jitter', () => {
    // Baseline: plain random pick + jitter, no candidate scoring —
    // reimplements the pre-scoring behavior inline so this test doesn't
    // depend on internals of palette.ts.
    function pickRandom<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]
    }
    function jitter(color: { l: number; c: number; h: number }) {
      return {
        l: Math.min(1, Math.max(0, color.l + (Math.random() - 0.5) * 0.1)),
        c: Math.max(0, color.c + (Math.random() - 0.5) * 0.04),
        h: (color.h + (Math.random() - 0.5) * 20 + 360) % 360,
      }
    }
    function baselineScore(): number {
      const stopCount = 3 + Math.floor(Math.random() * 4)
      const colors = []
      for (let i = 0; i < stopCount; i++) {
        colors.push(jitter(pickRandom(DEFAULT_COLOR_SET.colors).value))
      }
      return scorePalette(colors)
    }

    const iterations = 200
    let baselineTotal = 0
    let generatedTotal = 0
    for (let i = 0; i < iterations; i++) {
      baselineTotal += baselineScore()
      const stops = generateGradientStops(DEFAULT_COLOR_SET)
      const colors = stops.map((s) => hexToOklch(s.hex))
      generatedTotal += scorePalette(colors)
    }
    const baselineAvg = baselineTotal / iterations
    const generatedAvg = generatedTotal / iterations
    expect(generatedAvg).toBeGreaterThan(baselineAvg + 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/palette.test.ts`
Expected: FAIL — `generatedAvg` roughly equal to `baselineAvg` (both use the same unweighted logic today), assertion `toBeGreaterThan(baselineAvg + 5)` fails

- [ ] **Step 3: Write minimal implementation**

Replace `generateGradientStops` in `src/lib/palette.ts`:

```ts
import { oklchToHex, type Oklch } from './oklch'
import type { ColorSet } from './colorSets'
import type { GradientStop } from './gradient'
import { scorePalette } from './paletteScore'

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

function buildCandidateColors(colorSet: ColorSet, stopCount: number): Oklch[] {
  const colors: Oklch[] = []
  for (let i = 0; i < stopCount; i++) {
    const base = pickRandom(colorSet.colors).value
    colors.push(jitter(base))
  }
  return colors
}

// Weighted-random pick among candidates, using score^2 as the sampling
// weight — biases toward higher-scoring candidates without collapsing to
// a deterministic best-of-N (keeps generation feeling exploratory).
function pickByScore(candidates: Oklch[][]): Oklch[] {
  const weights = candidates.map((colors) => Math.max(0.0001, scorePalette(colors)) ** 2)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

const CANDIDATE_COUNT = 8

export function generateGradientStops(colorSet: ColorSet): GradientStop[] {
  const stopCount = 3 + Math.floor(Math.random() * 4) // 3-6

  const candidates: Oklch[][] = []
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    candidates.push(buildCandidateColors(colorSet, stopCount))
  }
  const colors = pickByScore(candidates)

  return colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: Math.round((i / (stopCount - 1)) * 100),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/palette.test.ts`
Expected: PASS — all pre-existing `generateGradientStops` tests still pass (stop count range, hex/position validity, jitter non-determinism), plus the new aesthetic-bias test

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites green

- [ ] **Step 6: Commit**

```bash
git add src/lib/palette.ts src/lib/palette.test.ts
git commit -m "feat: bias gradient generation toward higher-scoring candidates"
```

---

## Self-review notes (for the plan author, already applied above)

- Spec coverage: all 5 factor functions (Task 1-3), combinator with `DEFAULT_SCORE_WEIGHTS` (Task 4), generation integration with `N=8` + `score²` weighting (Task 5) — matches the design doc's Architecture section fully. No UI/preset/affinity tasks, matching the design's Non-goals.
- No placeholders: every step has literal code, exact file paths, exact commands with expected output.
- Type consistency: `Oklch` imported consistently from `./oklch` across all tasks; `ScoreWeights` fields (`lightnessRange`, `minPairwiseDistance`, `achromaticPenalty`, `saturationSpread`, `hueHarmony`) match between the interface definition (Task 4) and every call site; `scorePalette` signature (`colors: Oklch[], weights?`) is consistent between Task 4's definition and Task 5's usage.
