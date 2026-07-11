import { gradientColorAt } from './gradient'
import { hexToSrgb } from './oklch'
import type { Gradient } from '../store/types'

/** WCAG AA for normal text. The title is small enough that anything lower
 * reads as mud over busy gradients. */
const MIN_TITLE_CONTRAST = 4.5

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToSrgb(hex)
  const linear = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio between two hex colors, 1 (none) to 21 (black/white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Text color for the palette title anchored at normalized coordinates
 * (x, y in 0-1) over the gradient. Prefers one of the gradient's own stop
 * colors — the highest-contrast one against the backdrop sampled at that
 * spot — so the title reads as a natural extension of the palette. When no
 * stop clears WCAG AA against the local backdrop, falls back to whichever
 * of white/black contrasts more. Because the backdrop is sampled where the
 * title actually sits, a linear gradient that is light at the top and dark
 * at the bottom gets a different answer than one flipped the other way. */
export function titleColorAt(gradient: Gradient, x: number, y: number): string {
  const backdrop = gradientColorAt(gradient.type, gradient.stops, x, y, gradient.reversed, {
    repeat: gradient.repeatEnabled,
    hard: gradient.hardStops,
  })

  let best: string | null = null
  let bestRatio = 0
  for (const stop of gradient.stops) {
    const ratio = contrastRatio(stop.hex, backdrop)
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = stop.hex
    }
  }
  if (best && bestRatio >= MIN_TITLE_CONTRAST) return best

  return contrastRatio('#ffffff', backdrop) >= contrastRatio('#000000', backdrop)
    ? '#ffffff'
    : '#000000'
}
