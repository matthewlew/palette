import { useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import { SavedBrowser } from './SavedBrowser'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
  /** Fades the drawer out (and disables pointer events) while the user is idle. */
  hidden?: boolean
}

const STACK_SIZE = 3

export function Drawer({ saved, onSelect, hidden = false }: DrawerProps) {
  const [browsing, setBrowsing] = useState(false)
  // Most recent saves sit on top of the stack (saves append to the end).
  const recent = saved.slice(-STACK_SIZE).reverse()
  const overflow = saved.length - recent.length

  return (
    <>
      <div data-testid="saved-drawer" className={hidden ? `${styles.drawer} ${styles.hidden}` : styles.drawer}>
        <button
          type="button"
          data-testid="saved-stack"
          aria-label={
            saved.length === 0 ? 'Browse saved palettes (none yet)' : `Browse ${saved.length} saved palettes`
          }
          className={styles.stack}
          onClick={() => setBrowsing(true)}
        >
          {saved.length === 0 && (
            <span data-testid="drawer-empty" aria-hidden="true" className={styles.emptyThumb}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s-6.7-4.3-9.3-8.2C.8 9.6 1.7 6 4.9 4.8c2.1-.8 4.3.1 5.4 1.9l1.7 2.6 1.7-2.6c1.1-1.8 3.3-2.7 5.4-1.9 3.2 1.2 4.1 4.8 2.2 8-2.6 3.9-9.3 8.2-9.3 8.2z" />
              </svg>
            </span>
          )}
          {recent.map((gradient, i) => (
            <span
              key={gradient.id}
              data-testid="drawer-thumbnail"
              aria-label={`Saved ${gradient.type} gradient`}
              className={styles.stackThumb}
              style={{
                zIndex: recent.length - i,
                transform: `translateX(${-i * 8}px) rotate(${-i * 3}deg) scale(${1 - i * 0.06})`,
                backgroundImage:
                  gradient.type === 'square'
                    ? undefined
                    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                        repeat: gradient.repeatEnabled,
                        hard: gradient.hardStops,
                      }),
              }}
            >
              {gradient.type === 'square' && (
                <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />
              )}
            </span>
          ))}
          {overflow > 0 && (
            <span data-testid="saved-overflow" className={styles.overflowBadge}>
              +{overflow}
            </span>
          )}
        </button>
      </div>
      {browsing && (
        <SavedBrowser
          saved={saved}
          onClose={() => setBrowsing(false)}
          onSelect={(gradient) => {
            setBrowsing(false)
            onSelect(gradient)
          }}
        />
      )}
    </>
  )
}
