import type { Gradient } from '../store/types'
import { buildCroppedGradientCss } from './gradientCrop'

/**
 * The CSS background for a gradient thumbnail, or undefined for a Turrell
 * square, or an oval-radial crop — those geometries are layered DOM (see
 * TurrellSquare / OvalRadialLayers), not a single CSS gradient, so callers
 * render the component instead when this returns nothing.
 *
 * Shared by the Gallery grid and the carousel tray so a thumbnail looks the
 * same wherever it appears; it lives here rather than in Gallery.tsx because
 * the tray is imported BY Gallery, and importing back would be a cycle.
 */
export function tileBackground(gradient: Gradient): string | undefined {
  if (gradient.type === 'square') return undefined
  if (gradient.type === 'radial' && gradient.crop === 'oval') return undefined
  return (
    buildCroppedGradientCss(
      gradient.type,
      gradient.stops,
      gradient.reversed ?? false,
      {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
        smooth: gradient.smoothEnabled,
        prism: gradient.prismEnabled,
        fanAnchor: gradient.fanAnchor,
        angle: gradient.angle,
      },
      gradient.crop,
    ) ?? undefined
  )
}
