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
  /** True while edit mode's desktop side panel is open: the bar centers on
   * the remaining canvas width instead of the full viewport. */
  panelOpen?: boolean
  /** Most recent saves (newest last); the Gallery tab shows them as a tiny
   * fanned stack, standing in for the removed edit-mode favorites drawer. */
  recentGradients?: Gradient[]
  savedCount?: number
}

const STACK_SIZE = 3

function thumbStyle(gradient: Gradient): React.CSSProperties | undefined {
  return gradient.type === 'square'
    ? undefined
    : {
        backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
          repeat: gradient.repeatEnabled,
          hard: gradient.hardStops,
        }),
      }
}

export function TabBar({
  mode,
  onChange,
  hidden = false,
  panelOpen = false,
  recentGradients = [],
  savedCount = 0,
}: TabBarProps) {
  // Newest renders last (on top), slightly offset so the older saves peek
  // out behind it as a stack.
  const stack = recentGradients.slice(-STACK_SIZE)

  return (
    <nav
      data-testid="tab-bar"
      aria-label="Main"
      className={[styles.bar, hidden && styles.hidden, panelOpen && styles.overCanvas]
        .filter(Boolean)
        .join(' ')}
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
          {stack.length > 0 && (
            <span data-testid="tab-gallery-thumb" className={styles.thumbStack}>
              {stack.map((gradient, i) => (
                <span
                  key={gradient.id}
                  className={styles.thumb}
                  style={{
                    ...thumbStyle(gradient),
                    // Older thumbs shift up-left and shrink a touch behind
                    // the newest one.
                    translate: `${(stack.length - 1 - i) * -4}px ${(stack.length - 1 - i) * -2}px`,
                    scale: String(1 - (stack.length - 1 - i) * 0.08),
                    zIndex: i,
                  }}
                >
                  {gradient.type === 'square' && (
                    <span className={styles.squareThumbInner}>
                      <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={2} />
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
          Gallery {savedCount > 0 ? `(${savedCount})` : ''}
        </span>
      </button>
    </nav>
  )
}
