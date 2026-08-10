import type { Coverage } from './riso'

/**
 * PRD §6 item 3: alpha-channel presence and sub-300dpi are hard blocks, but
 * both are properties of the *exported file*, not of a coverage vector — the
 * plate exporter (PRD §6 item 4, not yet built) is what will own those two
 * checks. Everything here is computable straight from `Coverage`, so this is
 * the warning-only subset: single-ink ceiling, total cross-layer ink, and
 * the gradient floor (PRD §3.5). Deliberately excludes large-solid-fill
 * opacity, leading-edge, roller track, and margin — those need geometry
 * (where a stop sits on the physical sheet), which nothing in this data
 * model carries yet.
 */
export type PreflightSeverity = 'warn'

export interface PreflightIssue {
  code: 'single-ink-ceiling' | 'total-ink' | 'gradient-floor'
  severity: PreflightSeverity
  message: string
}

// Exported so gradient generation (riso.ts) can sample within these same
// bounds instead of drawing uniform random coverage and letting most
// candidates fail these checks after the fact.
export const SINGLE_INK_CEILING = 80
export const TOTAL_INK_CEILING = 180
export const GRADIENT_FLOOR = 10

/** Checks one stop's coverage vector against the verified press constraints
 * (PRD §3.5). All warning-only — these are artwork judgment calls, not
 * outright-reject conditions. */
export function checkCoverage(coverage: Coverage, inkNames: string[]): PreflightIssue[] {
  const issues: PreflightIssue[] = []

  coverage.forEach((percent, i) => {
    const name = inkNames[i] ?? `Ink ${i + 1}`
    if (percent > SINGLE_INK_CEILING) {
      issues.push({
        code: 'single-ink-ceiling',
        severity: 'warn',
        message: `${name} is at ${Math.round(percent)}% — above the ${SINGLE_INK_CEILING}% single-ink ceiling, ink saturates the paper past this point.`,
      })
    }
    // Below the floor but not zero: zero is "this ink isn't here," which is
    // fine. A trace amount is the actual problem — it's likely to drop out
    // entirely on press.
    if (percent > 0 && percent < GRADIENT_FLOOR) {
      issues.push({
        code: 'gradient-floor',
        severity: 'warn',
        message: `${name} is at only ${Math.round(percent)}% — below the ${GRADIENT_FLOOR}% floor, ink may drop out entirely.`,
      })
    }
  })

  const total = coverage.reduce((sum, c) => sum + c, 0)
  if (total > TOTAL_INK_CEILING) {
    issues.push({
      code: 'total-ink',
      severity: 'warn',
      message: `Total ink coverage is ${Math.round(total)}% — above the ~${TOTAL_INK_CEILING}% cross-layer ceiling, risking oversaturation.`,
    })
  }

  return issues
}

export interface StopPreflightIssues {
  stopId: string
  issues: PreflightIssue[]
}

/** Checks every stop and returns only the ones with something to flag, in
 * stop order — the caller (a summary panel) shouldn't have to filter empty
 * results itself. */
export function checkGradientCoverage(
  stops: { id: string; coverage: Coverage }[],
  inkNames: string[]
): StopPreflightIssues[] {
  return stops
    .map((stop) => ({ stopId: stop.id, issues: checkCoverage(stop.coverage, inkNames) }))
    .filter((entry) => entry.issues.length > 0)
}
