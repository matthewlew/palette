import type { StopPreflightIssues } from '../lib/drumPreflight'
import styles from './DrumPreflight.module.css'

interface DrumPreflightProps {
  issues: StopPreflightIssues[]
  /** Maps a stop id to its 1-based position in the Stops list, so a warning
   * can point at "Stop 2" instead of a meaningless internal id. */
  stopNumbers: Record<string, number>
}

/**
 * Warning-only preflight summary (PRD §6 item 3's coverage-derived checks —
 * see drumPreflight.ts for what's in and out of scope). No hard blocks here:
 * those two checks (alpha channel, sub-300dpi) are properties of an exported
 * file, which doesn't exist until the plate exporter does.
 */
export function DrumPreflight({ issues, stopNumbers }: DrumPreflightProps) {
  if (issues.length === 0) return null

  return (
    <div className={styles.wrap} data-testid="drum-preflight">
      <h3 className={styles.heading}>Preflight</h3>
      <ul className={styles.list}>
        {issues.flatMap((entry) =>
          entry.issues.map((issue, i) => (
            <li key={`${entry.stopId}-${issue.code}-${i}`} className={styles.row} data-testid="drum-preflight-warning">
              <span className={styles.mark} aria-hidden="true">
                !
              </span>
              <span>
                <strong>Stop {stopNumbers[entry.stopId] ?? '?'}:</strong> {issue.message}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
