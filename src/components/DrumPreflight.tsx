import { useState } from 'react'
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
 *
 * Collapsed to a single count badge by default — a full list of warnings
 * up front reads as "something is wrong" while someone is still exploring a
 * gradient, before they've asked for feedback on it. Tapping the badge
 * expands the detail for whoever actually wants it.
 */
export function DrumPreflight({ issues, stopNumbers }: DrumPreflightProps) {
  const [expanded, setExpanded] = useState(false)
  const count = issues.reduce((sum, entry) => sum + entry.issues.length, 0)
  if (count === 0) return null

  return (
    <div className={styles.wrap} data-testid="drum-preflight">
      <button
        type="button"
        className={styles.summary}
        data-testid="drum-preflight-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className={styles.mark} aria-hidden="true">
          !
        </span>
        <span>
          {count} {count === 1 ? 'note' : 'notes'} on ink coverage
        </span>
      </button>
      {expanded && (
        <ul className={styles.list}>
          {issues.flatMap((entry) =>
            entry.issues.map((issue, i) => (
              <li key={`${entry.stopId}-${issue.code}-${i}`} className={styles.row} data-testid="drum-preflight-warning">
                <strong>Stop {stopNumbers[entry.stopId] ?? '?'}:</strong> {issue.message}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
