import { MEDIA_ICON, MEDIA_ON } from '../lib/mediaChrome'
import styles from './PlayButton.module.css'

interface PlayButtonProps {
  playing: boolean
  onToggle: () => void
  /** Fades the button out alongside the rest of the chrome. */
  hidden?: boolean
  /** False when every stop is too close to a neighbour to have room to move. */
  available?: boolean
}

/** Round toggle for the ambient stop drift, above the save pill. */
export function PlayButton({
  playing,
  onToggle,
  hidden = false,
  available = true,
}: PlayButtonProps) {
  const className = [
    styles.playButton,
    MEDIA_ICON,
    playing && MEDIA_ON,
    hidden && styles.hidden,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      data-testid="play-button"
      aria-label={playing ? 'Stop animation' : 'Animate gradient'}
      aria-pressed={playing}
      disabled={!available}
      title={available ? undefined : 'These stops sit too close together to animate'}
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity={playing ? 1 : 0.5}>
        {playing ? (
          <>
            <rect x="7" y="6" width="3.5" height="12" rx="1.2" />
            <rect x="13.5" y="6" width="3.5" height="12" rx="1.2" />
          </>
        ) : (
          <path d="M9 6.5v11a1 1 0 0 0 1.53.85l8.5-5.5a1 1 0 0 0 0-1.7l-8.5-5.5A1 1 0 0 0 9 6.5Z" />
        )}
      </svg>
    </button>
  )
}
