import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
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
          style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed) }}
          onClick={() => onSelect(gradient)}
        />
      ))}
    </div>
  )
}
