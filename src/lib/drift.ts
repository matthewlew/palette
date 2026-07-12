import type { GradientStop } from './gradient'
import { hexToOklch, oklchToHex, clampChromaToGamut } from './oklch'

const HUE_DELTA = 20 // degrees
const L_DELTA = 0.05
const C_DELTA = 0.04

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
    return { ...stop, hex: oklchToHex(clampChromaToGamut(next)) }
  })
}
