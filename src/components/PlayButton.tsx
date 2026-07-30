import { MEDIA_ICON, MEDIA_ON } from '../lib/mediaChrome'
import { Icon } from '../icons'
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
      {/* Both solid: a media control is a state readout, and a line/fill pair
          here would read as enabled/disabled rather than play/pause. */}
      <Icon
        name={playing ? 'pause-fill' : 'play-fill'}
        size="md"
        style={{ opacity: playing ? 1 : 0.5 }}
      />
    </button>
  )
}
