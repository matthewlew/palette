import type { Gradient } from '../store/types'
import { CarouselTray } from './CarouselTray'
import styles from './CarouselDock.module.css'

interface CarouselDockProps {
  /** The picked gradients, resolved and in slide order. */
  gradients: Gradient[]
  /** Bulk PNG export is slow enough to need a visible working state. */
  downloading?: boolean
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  onCarousel: () => void
  onDownload: () => void
  onDelete: () => void
  onDone: () => void
}

/**
 * The collecting surface: a filmstrip of what you have picked, with the
 * actions that operate on the whole selection underneath.
 *
 * Docked rather than modal, and rendered over a Gallery that stays scrollable,
 * because collecting is a loop — pick one more, reorder, pick another. A modal
 * would force a close/reopen on every lap. The tray is where order is decided;
 * the grid above stays the place you add from.
 */
export function CarouselDock({
  gradients,
  downloading = false,
  onRemove,
  onReorder,
  onMove,
  onCarousel,
  onDownload,
  onDelete,
  onDone,
}: CarouselDockProps) {
  const count = gradients.length

  return (
    <div className={styles.dock} data-testid="selection-bar" aria-label="Carousel selection">
      <CarouselTray
        gradients={gradients}
        onRemove={onRemove}
        onReorder={onReorder}
        onMove={onMove}
      />
      <div className={styles.actions} role="toolbar" aria-label="Selection actions">
        <span className={styles.count} data-testid="selection-count">
          {count} selected
        </span>
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.primary}
            onClick={onCarousel}
            data-testid="selection-carousel"
          >
            Carousel
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={onDownload}
            disabled={downloading}
            data-testid="selection-download"
          >
            {downloading ? 'Saving…' : 'Download'}
          </button>
          <button
            type="button"
            className={styles.destructive}
            onClick={onDelete}
            data-testid="selection-delete"
          >
            Delete
          </button>
          <button
            type="button"
            className={styles.done}
            onClick={onDone}
            data-testid="selection-done"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
