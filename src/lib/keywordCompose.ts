import type { GradientStop, GradientType } from './gradient'
import type { Gradient, KeywordBinding } from '../store/types'
import { hexToOklch } from './oklch'
import { scorePalette } from './paletteScore'

/** Flatten the bindings' colors in order into evenly-spaced stops. Order is the
 * author's word-matching-sort arrangement. */
export function composeStops(bindings: KeywordBinding[]): GradientStop[] {
  const hexes = bindings.flatMap((b) => b.colors)
  const last = hexes.length - 1
  return hexes.map((hex, i) => ({
    hex,
    position: last <= 0 ? 0 : Math.round((i / last) * 100),
  }))
}

/** Build a gradient from the arranged bindings. Type comes from the first
 * binding's shape hint, else linear. */
export function composeGradient(bindings: KeywordBinding[], type?: GradientType): Gradient {
  return {
    id: crypto.randomUUID(),
    type: type ?? bindings[0]?.shape ?? 'linear',
    stops: composeStops(bindings),
  }
}

/** Aesthetic score (0-100) for the arrangement, reusing the existing palette
 * scorer verbatim so authored drops rank on the same axis as generated ones. */
export function scoreComposition(bindings: KeywordBinding[]): number {
  return scorePalette(composeStops(bindings).map((s) => hexToOklch(s.hex)))
}
