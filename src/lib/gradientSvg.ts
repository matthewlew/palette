import type { Gradient } from '../store/types'
import type { GradientStop, GradientType } from './gradient'
import { applyReversed, positionedStops, repeatedStops, hardenStops } from './gradient'

const RADIAL_TYPES: ReadonlySet<GradientType> = new Set(['radial'])

function safeHex(hex: string): string {
  return hex.replace(/[^#0-9a-fA-F]/g, '')
}

/** Resolve the {hex, position} stop list a gradient actually renders, mirroring
 * buildGradientCss: reversal swaps colors (positions stay fixed and ascending),
 * mirror/repeat/square build their own even sequence from hex order (and ignore
 * the repeat/hard filters, exactly like the app), and every other type layers
 * the repeat then hard filters on top. Keeping this in lockstep with
 * buildGradientCss means the pasted SVG matches what's on screen. */
function effectiveStops(gradient: Gradient): GradientStop[] {
  const reversed = applyReversed(gradient.stops, gradient.reversed ?? false)
  const hexes = reversed.map((s) => s.hex)

  switch (gradient.type) {
    case 'mirror': {
      // Palindrome without duplicating the color at the axis: [A,B,C]->[A,B,C,B,A].
      const mirrored = [...hexes, ...hexes.slice(0, -1).reverse()]
      return positionedStops(mirrored)
    }
    case 'repeat':
      return positionedStops([...hexes, ...hexes])
    case 'square':
      // Turrell squares aren't a real blend; approximate with the raw stops.
      return reversed
    default: {
      let stops = reversed
      if (gradient.repeatEnabled) stops = repeatedStops(stops)
      if (gradient.hardStops) stops = hardenStops(stops)
      return stops
    }
  }
}

function stopEls(stops: GradientStop[]): string {
  return stops
    .map((s) => `<stop offset="${s.position}%" stop-color="${safeHex(s.hex)}"/>`)
    .join('')
}

/** Build a standalone SVG string with a real gradient fill so pasting into
 * Figma/Illustrator yields a vector rectangle. linear/mirror/repeat render as
 * a vertical linear gradient (matching the app's 180deg); radial as a centered
 * circle; conic types (angular/square/fan) fall back to a linear approximation
 * since SVG has no native conic gradient. Reversal, the repeat/hard filters,
 * and mirror/repeat geometry are honored via effectiveStops. */
export function gradientToSvg(gradient: Gradient, size = 512): string {
  const id = `g${gradient.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'grad'}`
  const stops = stopEls(effectiveStops(gradient))

  const def = RADIAL_TYPES.has(gradient.type)
    ? `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${def}</defs><rect width="${size}" height="${size}" fill="url(#${id})"/></svg>`
}
