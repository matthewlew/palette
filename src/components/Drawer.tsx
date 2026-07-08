import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
  /** Fades the drawer out (and disables pointer events) while the user is idle. */
  hidden?: boolean
}

export function Drawer({ saved, onSelect, hidden = false }: DrawerProps) {
  return (
    <div data-testid="saved-drawer" className={hidden ? `${styles.drawer} ${styles.hidden}` : styles.drawer}>
      {saved.map((gradient) => (
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{
            backgroundImage:
              gradient.type === 'square'
                ? undefined
                : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                    repeat: gradient.repeatEnabled,
                    hard: gradient.hardStops,
                  }),
          }}
          onClick={() => onSelect(gradient)}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
        </button>
      ))}
    </div>
  )
}
