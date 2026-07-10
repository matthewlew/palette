import type { ViewMode } from '../store/types'
import type { Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import { TurrellSquare } from './TurrellSquare'
import styles from './TabBar.module.css'

interface TabBarProps {
  mode: ViewMode
  onChange: (mode: 'create' | 'gallery') => void
  /** In Create the tab control obeys the idle-fade like all other chrome;
   * in Gallery it is always visible. */
  hidden?: boolean
  recentGradient?: Gradient | null
}

export function TabBar({ mode, onChange, hidden = false, recentGradient = null }: TabBarProps) {
  const thumbStyle = recentGradient
    ? {
        backgroundImage:
          recentGradient.type === 'square'
            ? undefined
            : buildGradientCss(recentGradient.type, recentGradient.stops, recentGradient.reversed, {
                repeat: recentGradient.repeatEnabled,
                hard: recentGradient.hardStops,
              }),
      }
    : undefined

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
        <span className={styles.tabContent}>
          {recentGradient && (
            <span
              data-testid="tab-gallery-thumb"
              className={styles.thumb}
              style={thumbStyle}
            >
              {recentGradient.type === 'square' && (
                <span className={styles.squareThumbInner}>
                  <TurrellSquare stops={recentGradient.stops} reversed={recentGradient.reversed} blurPx={2} />
                </span>
              )}
            </span>
          )}
          Gallery
        </span>
      </button>
    </nav>
  )
}
