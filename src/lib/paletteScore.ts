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
