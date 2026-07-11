import styles from './LikeButton.module.css'

interface LikeButtonProps {
  liked: boolean
  onToggle: () => void
  /** Fades the button out (and disables pointer events) while the user is idle. */
  hidden?: boolean
  /** Palette-derived foreground (same strategy as the title). */
  color?: string
}

/** Persistent "Save" pill pinned to the bottom-right corner of whatever
 * positioned ancestor renders it (GradientPage's page div, EditMode's
 * preview). Ghost-chip styled so the gradient stays the focus. */
export function LikeButton({ liked, onToggle, hidden = false, color = '#ffffff' }: LikeButtonProps) {
  const className = [styles.likeButton, 'ghost-chip', 'ghost-pill', liked && 'ghost-chip-active', hidden && styles.hidden]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      data-testid="like-button"
      aria-label={liked ? 'Remove from Gallery' : 'Save to Gallery'}
      aria-pressed={liked}
      className={className}
      style={{ color }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {liked ? '✓ Saved' : 'Save'}
    </button>
  )
}
