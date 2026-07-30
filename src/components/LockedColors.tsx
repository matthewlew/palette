import { MEDIA_CHIP } from '../lib/mediaChrome'
import { Icon } from '../icons'
import styles from './LockedColors.module.css'

interface LockedColorsProps {
  /** The store's index-keyed colour pins. */
  locked: Record<number, string>
  /** The store's index-keyed position pins, index → 0-100 percentage. */
  lockedPositions?: Record<number, number>
  onClear: () => void
  hidden?: boolean
}

/**
 * Standing notice that some colors are pinned, with a one-tap release.
 *
 * Locks are set in the edit sheet's Colors list but they apply to every
 * palette the rolodex generates afterwards, including out here in the feed
 * where that list isn't on screen. Without this the feed would look like it
 * had quietly stopped varying one color — a generator that refuses to change
 * is indistinguishable from a broken one. Showing the pinned swatches makes
 * the constraint legible, and makes it undoable from the surface where you
 * notice it.
 */
export function LockedColors({
  locked,
  lockedPositions = {},
  onClear,
  hidden = false,
}: LockedColorsProps) {
  const entries = Object.entries(locked).sort((a, b) => Number(a[0]) - Number(b[0]))
  const pinnedPositions = Object.keys(lockedPositions).length
  if (entries.length === 0 && pinnedPositions === 0) return null

  const parts = [
    entries.length > 0 && `${entries.length} color${entries.length === 1 ? '' : 's'}`,
    pinnedPositions > 0 && `${pinnedPositions} position${pinnedPositions === 1 ? '' : 's'}`,
  ].filter(Boolean)

  return (
    <button
      type="button"
      data-testid="locked-colors"
      className={[styles.chip, MEDIA_CHIP, hidden && styles.hidden].filter(Boolean).join(' ')}
      aria-label={`${parts.join(' and ')} locked. Tap to unlock all.`}
      title="Locked colors and positions are kept as you browse. Tap to unlock."
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClear()
      }}
    >
      <Icon name="lock" size="sm" />
      {entries.length > 0 && (
        <span className={styles.swatches}>
          {entries.map(([index, hex]) => (
            <span key={index} className={styles.swatch} style={{ backgroundColor: hex }} />
          ))}
        </span>
      )}
      {/* Positions have no swatch to show, so they get a count. Without it a
          pinned position would be completely invisible out here — and a stop
          that refuses to move looks exactly like a bug. */}
      {pinnedPositions > 0 && (
        <span className={styles.positionCount}>
          {pinnedPositions}
          <span aria-hidden="true">%</span>
        </span>
      )}
    </button>
  )
}
