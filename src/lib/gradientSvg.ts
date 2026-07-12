import type { Gradient } from '../store/types'
import type { GradientStop, GradientType } from './gradient'

const RADIAL_TYPES: ReadonlySet<GradientType> = new Set(['radial'])

function safeHex(hex: string): string {
  return hex.replace(/[^#0-9a-fA-F]/g, '')
}

function stopEls(stops: GradientStop[], reversed: boolean): string {
  const ordered = reversed ? [...stops].reverse() : stops
  return ordered
    .map((s, i) => {
      const offset = reversed ? (i / Math.max(1, ordered.length - 1)) * 100 : s.position
      return `<stop offset="${offset}%" stop-color="${safeHex(s.hex)}"/>`
    })
    .join('')
}

/** Build a standalone SVG string with a real gradient fill so pasting into
 * Figma/Illustrator yields a vector rectangle. linear/mirror/repeat render as
 * a vertical linear gradient (matching the app's 180deg); radial as a centered
 * circle; conic types (angular/square/fan) fall back to a linear approximation
 * since SVG has no native conic gradient. */
export function gradientToSvg(gradient: Gradient, size = 512): string {
  const id = `g${gradient.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'grad'}`
  const reversed = gradient.reversed ?? false
  const stops = stopEls(gradient.stops, reversed)

  const def = RADIAL_TYPES.has(gradient.type)
    ? `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${def}</defs><rect width="${size}" height="${size}" fill="url(#${id})"/></svg>`
}
