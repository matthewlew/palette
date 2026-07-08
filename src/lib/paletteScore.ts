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
  const stddev = variance < 1e-12 ? 0 : Math.sqrt(variance)
  return clamp01(stddev / 0.22)
}

// Normalizes lightness range against 0.8 — the practical max spread
// given lightness values are typically kept within [0.1, 0.9] to avoid
// pure black/white clipping.
export function lightnessRange(colors: Oklch[]): number {
  const lums = colors.map((c) => c.l)
  const range = Math.max(...lums) - Math.min(...lums)
  return clamp01(range / 0.8)
}

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b)
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
    const devs = hues.map((hh) => Math.min(circularHueDistance(hh, h), circularHueDistance(hh, comp)) / 90)
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length)
  }
  for (const h of hues) {
    const h2 = (h + 120) % 360
    const h3 = (h + 240) % 360
    const devs = hues.map((hh) => Math.min(circularHueDistance(hh, h), circularHueDistance(hh, h2), circularHueDistance(hh, h3)) / 60)
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
  const saturation = saturationSpread(colors)
  const lightness = lightnessRange(colors)
  const distance = minPairwiseDistance(colors)
  const harmony = hueHarmony(colors.map((c) => c.h))
  const achromatic = achromaticPenalty(colors)
  const weighted =
    saturation * weights.saturationSpread +
    lightness * weights.lightnessRange +
    distance * weights.minPairwiseDistance +
    harmony * weights.hueHarmony +
    achromatic * weights.achromaticPenalty
  return weighted * 100
}
