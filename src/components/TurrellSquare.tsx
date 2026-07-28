import { useMemo } from 'react'
import type { GradientStop } from '../lib/gradient'
import { repeatedStops, getRadialConfig, turrellExtent } from '../lib/gradient'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
  blurPx?: number
  repeatEnabled?: boolean
  /** Origin of the nested squares, mirroring the radial rotate cycle: undefined
   * = centered; a degree (0/45/…/315) anchors the nest at that edge/corner. */
  angle?: number
}

export function TurrellSquare({ stops: initialStops, reversed = false, blurPx, repeatEnabled = false, angle }: TurrellSquareProps) {
  // ⚡ Bolt: Memoize the layer generation to avoid recalculating the layout geometries
  // (mapping, scaling, rounding, and sorting layers) across all TurrellSquare
  // instances on every re-render, especially important in the Gallery view.
  const { sortedLayers, outerHex, originX, originY } = useMemo(() => {
    const stops = repeatEnabled ? repeatedStops(initialStops) : initialStops

    // Where the nested squares converge. Center (undefined) keeps the classic
    // Turrell; an angle shifts the shared center to that edge/corner so the
    // smallest square hugs the origin — the square analogue of a radial origin.
    const origin = getRadialConfig(angle)
    const originX = `${origin.px * 100}%`
    const originY = `${origin.py * 100}%`

    // Reach to the farthest edge on each axis from the origin. A centered origin
    // gives 0.5 (the classic square that just fills the canvas); an edge/corner
    // origin grows toward 1.0 so the outermost square still spans the whole
    // canvas — the way an off-center radial gradient still reaches the farthest
    // corner instead of leaving a flat band of the last color.
    const reachX = Math.max(origin.px, 1 - origin.px)
    const reachY = Math.max(origin.py, 1 - origin.py)

    // To match radial gradients, position 0 is the center (innermost) and position 100
    // is the edge (outermost). reversed swaps which color fills which stop.
    const hexes = reversed ? [...stops].map((s) => s.hex).reverse() : stops.map((s) => s.hex)

    // Each stop's half-extent scales with position, from TURRELL_EXTENT_FLOOR of
    // the reach at pos 0 up to the full reach at pos 100; the size is that
    // half-extent doubled and taken per-axis so the nest fills the canvas from any
    // origin. turrellExtent is shared with the sampler and the PNG export.
    const layers = stops.map((stop, i) => {
      const factor = turrellExtent(stop.position, stops.length)
      // Round to shed floating-point noise (0.2 + 0.16 = 0.36000…1) so the inline
      // sizes stay tidy.
      const round = (n: number) => Math.round(n * 1e4) / 1e4
      return {
        id: i,
        hex: hexes[i],
        factor,
        widthPercent: round(2 * reachX * factor * 100),
        heightPercent: round(2 * reachY * factor * 100),
      }
    })

    // To prevent smaller inner layers from being covered by larger outer layers, we must
    // render them in DOM order from largest to smallest (descending size).
    const sortedLayers = [...layers].sort((a, b) => b.factor - a.factor)
    const outerHex = sortedLayers.length > 0 ? sortedLayers[0].hex : 'transparent'

    return { sortedLayers, outerHex, originX, originY }
  }, [initialStops, reversed, repeatEnabled, angle])

  return (
    // The container is painted in the outermost layer's color to prevent stale 
    // texture gaps at the edges when the blurred layers are GPU composited.
    <div 
      data-testid="turrell-square" 
      className={styles.container} 
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: outerHex }}
    >
      {sortedLayers.map((layer, index) => {
        const isOutermost = index === 0
        const bleedPx = (blurPx ?? 24) * 4
        const width = isOutermost ? `calc(${layer.widthPercent}% + ${bleedPx}px)` : `${layer.widthPercent}%`
        const height = isOutermost ? `calc(${layer.heightPercent}% + ${bleedPx}px)` : `${layer.heightPercent}%`
        return (
          <div
            key={layer.id}
            data-testid="turrell-layer"
            className={styles.layer}
            style={{
              backgroundColor: layer.hex,
              width,
              height,
              left: originX,
              top: originY,
              filter: blurPx != null ? `blur(${blurPx}px)` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
