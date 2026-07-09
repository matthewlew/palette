import type { ViewMode } from '../store/types'
import styles from './TabBar.module.css'

interface TabBarProps {
  mode: ViewMode
  onChange: (mode: 'create' | 'gallery') => void
  /** In Create the tab control obeys the idle-fade like all other chrome;
   * in Gallery it is always visible. */
  hidden?: boolean
}

export function TabBar({ mode, onChange, hidden = false }: TabBarProps) {
  return (
    <nav
      data-testid="tab-bar"
      aria-label="Main"
      className={hidden ? `${styles.bar} ${styles.hidden}` : styles.bar}
    >
      <button
        type="button"
        className={mode === 'create' ? styles.tabOn : styles.tab}
        aria-current={mode === 'create' ? 'page' : undefined}
        onClick={() => onChange('create')}
      >
        Create
      </button>
      <button
        type="button"
        className={mode === 'gallery' ? styles.tabOn : styles.tab}
        aria-current={mode === 'gallery' ? 'page' : undefined}
        onClick={() => onChange('gallery')}
      >
        Gallery
      </button>
    </nav>
  )
}
