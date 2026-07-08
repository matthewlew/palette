import styles from './ImportBanner.module.css'

interface ImportBannerProps {
  count: number
  onConfirm: () => void
  onDismiss: () => void
}

export function ImportBanner({ count, onConfirm, onDismiss }: ImportBannerProps) {
  return (
    <div className={styles.banner} data-testid="import-banner">
      <span>
        Import {count} gradient{count === 1 ? '' : 's'}?
      </span>
      <div className={styles.actions}>
        <button type="button" onClick={onConfirm}>
          Add to board
        </button>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
