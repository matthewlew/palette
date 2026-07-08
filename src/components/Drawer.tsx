import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
}

export function Drawer({ saved, onSelect }: DrawerProps) {
  return (
    <div className={styles.drawer}>
      {saved.map((gradient) => (
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{
            backgroundImage:
              gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
          }}
          onClick={() => onSelect(gradient)}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
        </button>
      ))}
    </div>
  )
}
