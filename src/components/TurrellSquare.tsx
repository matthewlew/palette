import type { GradientStop } from '../lib/gradient'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
  blurPx?: number
}

export function TurrellSquare({ stops, reversed = false, blurPx }: TurrellSquareProps) {
  // Layer depth (outermost -> innermost) always follows stop position order
  // (stops arrive pre-sorted by position); reversed only swaps which color
  // fills which depth, it never reorders the depths/sizes themselves.
  const hexes = reversed ? [...stops].map((s) => s.hex).reverse() : stops.map((s) => s.hex)

  return (
    <div data-testid="turrell-square" className={styles.container}>
      {stops.map((stop, i) => {
        // Outermost layer (position 0) is largest (100%); each subsequent
        // layer shrinks toward the center in proportion to the stop's actual
        // position (not just its index), so dragging a flow-editor handle
        // changes the nesting depth, not only the color. The innermost stop
        // (position 100) reaches a 20%-of-container floor, producing the
        // nested-squares Turrell look.
        const scalePercent = stops.length <= 1 ? 100 : 100 - (stop.position / 100) * 80
        // The blur filter samples transparency past a layer's edge, so the
        // outermost layer must extend beyond the container (by 4x the blur
        // radius) for the blurred edge to land outside the overflow clip
        // instead of showing a halo of the page background.
        const bleedPx = (blurPx ?? 24) * 4
        const size = i === 0 ? `calc(100% + ${bleedPx}px)` : `${scalePercent}%`
        return (
          <div
            key={i}
            data-testid="turrell-layer"
            className={styles.layer}
            style={{
              backgroundColor: hexes[i],
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
