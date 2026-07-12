import type { GradientStop } from './gradient'
import { blendOklchHex } from './oklch'

/**
 * Interpolate two equal-length stop lists in OKLCH at fraction `t` (0..1).
 * Positions come from `to`. Callers MUST ensure equal lengths; mismatched
 * lists throw.
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
