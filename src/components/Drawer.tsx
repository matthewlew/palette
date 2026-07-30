import { useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import { SavedBrowser } from './SavedBrowser'
import { Icon } from '../icons'
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
              <Icon name="heart" size="md" />
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
                        smooth: gradient.smoothEnabled,
                        fanAnchor: gradient.fanAnchor, angle: gradient.angle,
                      }),
              }}
            >
              {gradient.type === 'square' && (
                <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} blurPx={4} angle={gradient.angle} />
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
