import { useRef } from 'react'
import { MEDIA_CHIP, MEDIA_ON } from '../lib/mediaChrome'
import { launchSaveFlight } from '../lib/saveFlight'
import type { Gradient } from '../store/types'
import styles from './LikeButton.module.css'

interface LikeButtonProps {
  liked: boolean
  onToggle: () => void
  /** Fades the button out (and disables pointer events) while the user is idle. */
  hidden?: boolean
  /** The gradient being saved. Supplying it makes the save visible: a copy
   * flies out of this button and into the Gallery tab's thumbnail stack.
   * Optional so surfaces that already sit inside the Gallery (where the
   * flight would land on itself) can leave it off. */
  gradient?: Gradient
}

/** Persistent "Save" pill pinned to the bottom-right corner of whatever
 * positioned ancestor renders it (GradientPage's page div, EditMode's
 * preview). Ghost-chip styled, so it matches the tab bar and every other
 * floating control regardless of what is behind it. */
export function LikeButton({ liked, onToggle, hidden = false, gradient }: LikeButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const className = [styles.likeButton, MEDIA_CHIP, liked && MEDIA_ON, hidden && styles.hidden]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      ref={ref}
      type="button"
      data-testid="like-button"
      aria-label={liked ? 'Remove from Gallery' : 'Save to Gallery'}
      aria-pressed={liked}
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        // Only a save flies; un-saving is a correction, and animating a
        // gradient back OUT of the Gallery would celebrate a removal.
        // Measured before the toggle, while the button is still where the
        // user pressed it.
        if (!liked && gradient) launchSaveFlight(gradient, ref.current)
        onToggle()
      }}
    >
      {liked ? '✓ Saved' : 'Save'}
    </button>
  )
}
