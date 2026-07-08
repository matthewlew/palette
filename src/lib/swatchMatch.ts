import { hexToOklch, oklchToHex } from './oklch'
import type { ColorSet } from './colorSets'

const MAX_L_DIFF = 0.08
const MAX_C_DIFF = 0.05
const MAX_H_DIFF = 15

function hueDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/**
 * For display purposes only: matches each stop hex to its nearest color-set
 * swatch within a generous OKLCH tolerance, so swatches still read as
 * "selected" for gradient stops that were randomly jittered away from their
 * source swatch's exact color (see generateGradientStops in palette.ts).
 * Does not affect exact-hex tap-to-add/remove logic elsewhere.
 */
export function selectedSwatchHexes(stopHexes: string[], colorSet: ColorSet): Set<string> {
  const selected = new Set<string>()
  for (const stopHex of stopHexes) {
    const stopOklch = hexToOklch(stopHex)
    let best: { hex: string; distance: number } | null = null
    for (const color of colorSet.colors) {
      const lDiff = Math.abs(stopOklch.l - color.value.l)
      const cDiff = Math.abs(stopOklch.c - color.value.c)
      const hDiff = hueDiff(stopOklch.h, color.value.h)
      if (lDiff > MAX_L_DIFF || cDiff > MAX_C_DIFF || hDiff > MAX_H_DIFF) continue
      const distance = lDiff + cDiff + hDiff / 100
      if (!best || distance < best.distance) {
        best = { hex: oklchToHex(color.value), distance }
      }
    }
    if (best) selected.add(best.hex)
  }
  return selected
}
