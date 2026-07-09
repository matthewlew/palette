import type { GlassTone } from '../lib/glassTone'
import styles from './GrainButton.module.css'

interface GrainButtonProps {
  enabled: boolean
  onToggle: () => void
  /** Fades the button out alongside the rest of the chrome. */
  hidden?: boolean
  /** 'dark' flips the glass surface for legibility over bright backdrops. */
  tone?: GlassTone
}

/** Round toggle for the mono noise overlay, stacked above the like button. */
export function GrainButton({ enabled, onToggle, hidden = false, tone = 'light' }: GrainButtonProps) {
  const className = [styles.grainButton, hidden && styles.hidden, tone === 'dark' && 'glass-dark']
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      data-testid="grain-button"
      aria-label="Toggle grain"
      aria-pressed={enabled}
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity={enabled ? 1 : 0.5}>
        <circle cx="5" cy="6" r="1.3" />
        <circle cx="12" cy="4" r="1.3" />
        <circle cx="19" cy="7" r="1.3" />
        <circle cx="8" cy="11" r="1.3" />
        <circle cx="16" cy="12" r="1.3" />
        <circle cx="4" cy="16" r="1.3" />
        <circle cx="11" cy="18" r="1.3" />
        <circle cx="19" cy="17" r="1.3" />
        <circle cx="15" cy="21" r="1.3" />
        <circle cx="7" cy="21" r="1.3" />
      </svg>
    </button>
  )
}
