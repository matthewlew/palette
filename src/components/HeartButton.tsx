import { Icon, IconSwap } from '../icons'
import styles from './HeartButton.module.css'
import { MEDIA_CHIP } from '../lib/mediaChrome'

interface HeartButtonProps {
  liked: boolean
  count: number
  onToggle: () => void
  /** 'tile' overlays a gallery thumbnail; 'viewer' sits in the full-screen
   * action bar and matches the other media chrome beside it. */
  variant?: 'tile' | 'viewer'
  /** Named in the accessible label so a screen reader hears which palette a
   * heart belongs to — a grid of them is otherwise a row of identical "Like". */
  label?: string
}

/** Counts stop being interesting long before they stop being long. */
export function formatLikeCount(count: number): string {
  if (count < 1000) return String(count)
  const thousands = count / 1000
  // 1.2k up to 10k, then 12k — a tenth of a thousand stops meaning anything.
  return thousands < 10 ? `${thousands.toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(thousands)}k`
}

/**
 * The community "like" — a public signal that a palette is good, distinct from
 * the Save button (which is private, and is what LikeButton.tsx confusingly
 * still calls itself). No account behind it: see lib/clientId.ts.
 */
export function HeartButton({
  liked,
  count,
  onToggle,
  variant = 'tile',
  label,
}: HeartButtonProps) {
  const noun = count === 1 ? 'like' : 'likes'
  const named = label ? ` ${label},` : ''

  return (
    <button
      type="button"
      data-testid="heart-button"
      aria-pressed={liked}
      aria-label={`${liked ? 'Unlike' : 'Like'}${named} ${count} ${noun}`}
      className={[
        styles.heart,
        variant === 'viewer' ? `${MEDIA_CHIP} ${styles.viewer}` : styles.tile,
        liked ? styles.liked : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // The tile underneath opens the viewer and the viewer backdrop closes it;
      // a like must do neither. pointer events are stopped as well as click
      // because the gallery tile opens on click but GradientPage-style surfaces
      // act on pointerup.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {/* The set draws the two states as two glyphs rather than one path with
          fill toggled: the solid heart is a shade smaller so it carries the
          same optical weight as the outline. */}
      <IconSwap a="heart" b="heart-fill" active={liked} size="sm" />
      {count > 0 && <span className={styles.count}>{formatLikeCount(count)}</span>}
    </button>
  )
}

/**
 * The same signal, read-only, for the dense grid.
 *
 * Three tiles across a phone leaves no room for a tap target that isn't in the
 * way of the one that opens the palette, so dense shows the count and puts the
 * heart itself in the viewer a tap away. Hidden entirely at zero: a wall of
 * "0" is noise, and it reads as "nobody liked this" rather than "new".
 */
export function LikeCountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className={styles.badge} data-testid="like-count-badge" aria-hidden="true">
      <Icon name="heart-fill" size="xs" />
      {formatLikeCount(count)}
    </span>
  )
}
