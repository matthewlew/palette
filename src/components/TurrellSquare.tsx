import type { GradientStop } from '../lib/gradient'
import { repeatedStops } from '../lib/gradient'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
  blurPx?: number
  repeatEnabled?: boolean
}

export function TurrellSquare({ stops: initialStops, reversed = false, blurPx, repeatEnabled = false }: TurrellSquareProps) {
  const stops = repeatEnabled ? repeatedStops(initialStops) : initialStops

  // To match radial gradients, position 0 is the center (innermost) and position 100 
  // is the edge (outermost). reversed swaps which color fills which stop.
  const hexes = reversed ? [...stops].map((s) => s.hex).reverse() : stops.map((s) => s.hex)

  // Map stops to their visual layer properties. Position 0 = 20% size, Position 100 = 100% size.
  const layers = stops.map((stop, i) => {
    const scalePercent = stops.length <= 1 ? 100 : 20 + (stop.position / 100) * 80
    return {
      id: i,
      hex: hexes[i],
      scalePercent
    }
  })

  // To prevent smaller inner layers from being covered by larger outer layers, we must
  // render them in DOM order from largest to smallest (descending scalePercent).
  const sortedLayers = [...layers].sort((a, b) => b.scalePercent - a.scalePercent)
  const outerHex = sortedLayers.length > 0 ? sortedLayers[0].hex : 'transparent'

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
        const size = isOutermost ? `calc(100% + ${bleedPx}px)` : `${layer.scalePercent}%`
        return (
          <div
            key={layer.id}
            data-testid="turrell-layer"
            className={styles.layer}
            style={{
              backgroundColor: layer.hex,
              width: size,
              height: size,
              filter: blurPx != null ? `blur(${blurPx}px)` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
