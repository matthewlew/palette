import styles from './LikeButton.module.css'

interface LikeButtonProps {
  liked: boolean
  onToggle: () => void
  /** Fades the button out (and disables pointer events) while the user is idle. */
  hidden?: boolean
}

/** Persistent hollow/filled heart toggle, pinned to the bottom-right corner
 * of whatever positioned ancestor renders it (GradientPage's page div,
 * EditMode's preview div). Replaces the old double-tap-to-like gesture. */
export function LikeButton({ liked, onToggle, hidden = false }: LikeButtonProps) {
  return (
    <button
      type="button"
      data-testid="like-button"
      aria-label={liked ? 'Unlike this gradient' : 'Like this gradient'}
      aria-pressed={liked}
      className={hidden ? `${styles.likeButton} ${styles.hidden}` : styles.likeButton}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-6.7-4.3-9.3-8.2C.8 9.6 1.7 6 4.9 4.8c2.1-.8 4.3.1 5.4 1.9l1.7 2.6 1.7-2.6c1.1-1.8 3.3-2.7 5.4-1.9 3.2 1.2 4.1 4.8 2.2 8-2.6 3.9-9.3 8.2-9.3 8.2z" />
      </svg>
    </button>
  )
}
