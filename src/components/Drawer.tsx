import { buildGradientCss } from '../lib/gradient'
import { encodeToFragment, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
  /** Fades the drawer out (and disables pointer events) while the user is idle. */
  hidden?: boolean
}

function shareLink(gradients: Gradient[], kind: 'gradient' | 'board'): string {
  const fragment = encodeToFragment({ kind, gradients: gradients.map(toSharePayloadGradient) })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

export function Drawer({ saved, onSelect, hidden = false }: DrawerProps) {
  const shareFeedback = useCopyFeedback()

  return (
    <div data-testid="saved-drawer" className={hidden ? `${styles.drawer} ${styles.hidden}` : styles.drawer}>
      {saved.map((gradient) => (
        <div key={gradient.id} className={styles.thumbnailWrap}>
          <button
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
          <button
            type="button"
            className={styles.shareThumb}
            aria-label="Share this gradient"
            onClick={(e) => {
              e.stopPropagation()
              shareFeedback.copy(shareLink([gradient], 'gradient'))
            }}
          >
            {shareFeedback.copied ? '✓' : '⤴'}
          </button>
        </div>
      ))}
    </div>
  )
}
