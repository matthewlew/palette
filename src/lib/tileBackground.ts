import type { Gradient } from '../store/types'
import { buildGradientCss } from './gradient'

/**
 * The CSS background for a gradient thumbnail, or undefined for a Turrell
 * square — that geometry is layered DOM (see TurrellSquare), not a CSS
 * gradient, so callers render the component instead when this returns nothing.
 *
 * Shared by the Gallery grid and the carousel tray so a thumbnail looks the
 * same wherever it appears; it lives here rather than in Gallery.tsx because
 * the tray is imported BY Gallery, and importing back would be a cycle.
 */
export function tileBackground(gradient: Gradient): string | undefined {
  return gradient.type === 'square'
    ? undefined
    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
        smooth: gradient.smoothEnabled,
        fanAnchor: gradient.fanAnchor,
        angle: gradient.angle,
      })
}
