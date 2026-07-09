import { gradientColorAt } from './gradient'
import { hexToOklch } from './oklch'
import type { Gradient } from '../store/types'

export type GlassTone = 'light' | 'dark'

/** Above this OKLCH lightness the white-on-glass chrome loses contrast and
 * the surface flips to its dark variant. */
const BRIGHT_BACKDROP_L = 0.72

/** Picks the glass-surface tone for a chrome element anchored at normalized
 * page coordinates (x, y in 0-1) over the given gradient: 'dark' when the
 * backdrop there is bright, 'light' otherwise. */
export function glassToneAt(gradient: Gradient, x: number, y: number): GlassTone {
  const hex = gradientColorAt(gradient.type, gradient.stops, x, y, gradient.reversed, {
    repeat: gradient.repeatEnabled,
    hard: gradient.hardStops,
  })
  return hexToOklch(hex).l > BRIGHT_BACKDROP_L ? 'dark' : 'light'
}
