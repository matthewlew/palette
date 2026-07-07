import type { GradientStop } from '../lib/gradient'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
}

export function TurrellSquare({ stops, reversed = false }: TurrellSquareProps) {
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
        return (
          <div
            key={i}
            data-testid="turrell-layer"
            className={styles.layer}
            style={{
              backgroundColor: stop.hex,
              width: `${scalePercent}%`,
              height: `${scalePercent}%`,
            }}
          />
        )
      })}
    </div>
  )
}
