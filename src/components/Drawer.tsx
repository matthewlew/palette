import { buildGradientCss } from '../lib/gradient'
import { encodeToFragment, toExportJson, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
  /** Invoked with raw JSON text pasted/selected by the user for import. */
  onImport: (jsonText: string) => void
  /** Fades the drawer out (and disables pointer events) while the user is idle. */
  hidden?: boolean
}

function shareLink(gradients: Gradient[], kind: 'gradient' | 'board'): string {
  const fragment = encodeToFragment({ kind, gradients: gradients.map(toSharePayloadGradient) })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

export function Drawer({ saved, onSelect, onImport, hidden = false }: DrawerProps) {
  const shareFeedback = useCopyFeedback()
  const jsonFeedback = useCopyFeedback()

  return (
    <div data-testid="saved-drawer" className={hidden ? `${styles.drawer} ${styles.hidden}` : styles.drawer}>
      {saved.length > 0 && (
        <div className={styles.boardActions}>
          <button
            type="button"
            onClick={() => shareFeedback.copy(shareLink(saved, 'board'))}
          >
            {shareFeedback.copied ? 'Copied!' : 'Share board'}
          </button>
          <button
            type="button"
            onClick={() =>
              jsonFeedback.copy(
                toExportJson({ kind: 'board', gradients: saved.map(toSharePayloadGradient) })
              )
            }
          >
            {jsonFeedback.copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            type="button"
            onClick={() => {
              const text = window.prompt('Paste gradient/board JSON to import:')
              if (text) onImport(text)
            }}
          >
            Import
          </button>
        </div>
      )}
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
