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
