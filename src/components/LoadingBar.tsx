import styles from './LoadingBar.module.css'

interface LoadingBarProps {
  /** Announced to assistive tech and shown under the bar. */
  label?: string
}

/**
 * Indeterminate progress, in the app's own material: a gradient sweeping
 * through a hairline track.
 *
 * "Loading community gradients…" as a line of grey text was the only thing on
 * screen during a cold Supabase fetch, which reads as an empty state rather
 * than as work in progress. A gradient is also the one thing this app is
 * unambiguously about, so the wait is made of the same stuff as the thing
 * being waited for.
 *
 * Indeterminate on purpose — the fetch is one request whose duration nobody
 * knows, so a filling bar would be a fiction. See the keyframes for why the
 * motion is deliberately uneven.
 */
export function LoadingBar({ label = 'Loading' }: LoadingBarProps) {
  return (
    <div data-testid="loading-bar">
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        // No value: this is indeterminate, and omitting aria-valuenow is how
        // that is spelled.
        aria-busy="true"
      >
        <div
          className={styles.band}
          style={{
            // Inline rather than in the sheet because it is content, not
            // chrome: the sweep is a palette, and the transparent ends are what
            // make it read as light passing through rather than a block
            // sliding along.
            backgroundImage:
              'linear-gradient(90deg, transparent, #7955c1, #41e9f4, #b4d300, #ffb03c, transparent)',
          }}
        />
      </div>
      {label && <p className={styles.label}>{label}</p>}
    </div>
  )
}
