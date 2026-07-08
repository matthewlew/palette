import type { GradientStop } from '../lib/gradient'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
  blurPx?: number
}

export function TurrellSquare({ stops, reversed = false, blurPx }: TurrellSquareProps) {
  const ordered = reversed ? [...stops].reverse() : stops

  return (
    <div data-testid="turrell-square" className={styles.container}>
      {ordered.map((stop, i) => {
        // Outermost layer (i === 0) is largest (100%); each subsequent layer
        // shrinks toward the center, with the innermost layer (last stop)
        // reaching a 20%-of-container floor, producing the nested-squares
        // Turrell look.
        const scalePercent =
          ordered.length <= 1 ? 100 : 100 - (i / (ordered.length - 1)) * 80
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
              backgroundColor: stop.hex,
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
