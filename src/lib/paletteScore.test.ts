import { describe, it, expect } from 'vitest'
import {
  saturationSpread,
  lightnessRange,
  minPairwiseDistance,
  hueHarmony,
  achromaticPenalty,
  scorePalette,
  DEFAULT_SCORE_WEIGHTS,
} from './paletteScore'
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

// Mirrors the normalization used by the lightnessRange factor itself
// (range / 0.8, clamped to [0, 1]) — scorePalette delegates to that
// factor rather than a raw, unnormalized range, so the expectation here
// must match it or this test would be asserting against behavior that
// doesn't exist anywhere else in the module.
function lightnessRangeScoreForColors(colors: Oklch[]): number {
  const lums = colors.map((c) => c.l)
  const range = Math.max(...lums) - Math.min(...lums)
  return Math.min(1, Math.max(0, range / 0.8))
}
