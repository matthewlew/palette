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
          data-testid="drawer-thumbnail"
          className={styles.thumbnail}
          style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops) }}
          onClick={() => onSelect(gradient)}
        />
      ))}
    </div>
  )
}
