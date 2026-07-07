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
        // Outermost layer (i === 0) is largest; each subsequent layer shrinks
        // toward the center, producing the nested-squares Turrell look.
        const scalePercent = 100 - (i / ordered.length) * 80
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
