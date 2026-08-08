import styles from './SelectionBar.module.css'

interface SelectionBarProps {
  count: number
  /** Bulk PNG export is slow enough to need a visible working state. */
  downloading?: boolean
  onCarousel: () => void
  onDownload: () => void
  onDelete: () => void
  onDone: () => void
}

/**
 * The multi-select action bar, in the Photos mould: it appears once something
 * is selected and carries every action that operates on the whole selection.
 *
 * Deliberately NOT a header treatment — on a phone the header is out of thumb
 * reach, and selecting is a repeated action you do while scrolling, so the
 * actions belong at the bottom next to where the selecting is happening.
 */
export function SelectionBar({
  count,
  downloading = false,
  onCarousel,
  onDownload,
  onDelete,
  onDone,
}: SelectionBarProps) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="Selection actions" data-testid="selection-bar">
      <span className={styles.count} data-testid="selection-count">
        {count} selected
      </span>
      <div className={styles.actions}>
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
        <button type="button" className={styles.done} onClick={onDone} data-testid="selection-done">
          Done
        </button>
      </div>
    </div>
  )
}
