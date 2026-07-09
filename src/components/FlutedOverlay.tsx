import styles from './FlutedOverlay.module.css'

interface FlutedOverlayProps {
  visible: boolean
}

/** Fluted-glass effect: vertical ribs over the gradient, built from two
 * full-bleed layers — alternating blurred strips (backdrop-filter revealed
 * through a striped mask) plus thin highlight/shadow lines along each rib's
 * edges, which together read as light refracting through reeded glass. */
export function FlutedOverlay({ visible }: FlutedOverlayProps) {
  if (!visible) return null
  return (
    <div data-testid="fluted-overlay" aria-hidden="true" className={styles.fluted}>
      <div className={styles.refraction} />
      <div className={styles.sheen} />
    </div>
  )
}
