import { hexToOklch, hexToSrgb } from './oklch'
import { scorePalette } from './paletteScore'
import { SINGLE_INK_CEILING, TOTAL_INK_CEILING, GRADIENT_FLOOR } from './drumPreflight'
import type { GradientStop } from './gradient'

/** Per-ink coverage percentage, 0-100. Array index is parallel to the ink
 * list the caller supplies (drum-picker order) — NOT sorted by lightness.
 * See coverageToHex for why order doesn't affect the rendered colour. */
export type Coverage = number[]

function clampCoverage(v: number): number {
  return Math.min(100, Math.max(0, v))
}

function toHexByte(v: number): string {
  return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
}

function multiplyChannel(bg: number, ink: number, a: number): number {
  const film = 255 - a * (255 - ink)
  return (bg * film) / 255
}

/**
 * Composites a stack of translucent riso inks onto white paper (PRD §3.4).
 * Each ink contributes `film = 255 - a*(255-ink); out = bg*film/255`, applied
 * once per ink with that ink's coverage (0-100) as alpha.
 *
 * Iteration order does NOT affect the result: each ink multiplies every
 * channel by an independent factor, and multiplication commutes. Verified by
 * brute-force comparison of multiple orderings of the same coverage triple
 * (agreed to 13 decimal places). Inks are applied in array order here —
 * "lightest ink first" is a code convention elsewhere for readability, not a
 * requirement of this function.
 */
export function coverageToHex(coverage: Coverage, inkHexes: string[]): string {
  if (coverage.length !== inkHexes.length) {
    throw new Error(`coverage length (${coverage.length}) must match inkHexes length (${inkHexes.length})`)
  }
  let r = 255
  let g = 255
  let b = 255
  for (let i = 0; i < inkHexes.length; i++) {
    const ink = hexToSrgb(inkHexes[i])
    const a = clampCoverage(coverage[i]) / 100
    r = multiplyChannel(r, ink.r, a)
    g = multiplyChannel(g, ink.g, a)
    b = multiplyChannel(b, ink.b, a)
  }
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

/**
 * The Drum analogue of `stopOrdering.ts`'s `EditableStop` — coverage instead
 * of hex. Deliberately its own type, not a generic fork of the RGB one: a
 * shared "stop" abstraction would mean every future stopOrdering change has
 * to consider a riso case it doesn't apply to, and vice versa. See PRD §3.1
 * for the same argument applied to the two products as a whole.
 */
export interface DrumEditableStop {
  id: string
  coverage: Coverage
  position: number // 0-100
}

/** Builds the editable working set from a gradient's persisted stops and its
 * gradient-level coverage array (PRD §3.7 — coverage lives at gradient level,
 * parallel to `stops`, never on the stop object itself). Hex is intentionally
 * dropped here: while editing, coverage is the ground truth and hex is
 * re-derived from it, never the reverse. */
export function toEditableStops(stops: GradientStop[], coverage: Coverage[]): DrumEditableStop[] {
  return stops.map((stop, i) => ({ id: crypto.randomUUID(), coverage: coverage[i], position: stop.position }))
}

/** Spreads stops evenly across 0-100 by array order, keeping their ids and
 * coverage. Mirrors stopOrdering's equalizeEditableStops exactly (see that
 * file for the locked-position reasoning); duplicated rather than shared for
 * the reason given on DrumEditableStop above. */
export function equalizeEditableStops(
  stops: DrumEditableStop[],
  locked: Record<number, number> = {}
): DrumEditableStop[] {
  const count = stops.length
  return stops.map((stop, i) => ({
    ...stop,
    position: locked[i] ?? (count === 1 ? 0 : Math.round((i / (count - 1)) * 100)),
  }))
}

/** True when the stops still sit on the default even ladder. See
 * stopOrdering's isEvenlyDistributed for the full reasoning — identical here,
 * just over DrumEditableStop instead of EditableStop. */
export function isEvenlyDistributed(stops: DrumEditableStop[]): boolean {
  const count = stops.length
  if (count <= 1) return true
  const sorted = [...stops].map((s) => s.position).sort((a, b) => a - b)
  return sorted.every((position, i) => Math.abs(position - (i / (count - 1)) * 100) <= 1)
}

/** Keeps the current distribution and re-pairs coverage to it in array
 * order — the Drum reading of a reorder, mirroring stopOrdering's
 * reassignPositions. */
export function reassignPositions(stops: DrumEditableStop[]): DrumEditableStop[] {
  const ladder = stops.map((s) => s.position).sort((a, b) => a - b)
  return stops.map((stop, i) => ({ ...stop, position: ladder[i] }))
}

export function removeStopAt(stops: DrumEditableStop[], id: string): DrumEditableStop[] {
  return stops.filter((stop) => stop.id !== id)
}

function largestGapMidpoint(stops: DrumEditableStop[]): number {
  if (stops.length === 0) return 50
  if (stops.length === 1) return stops[0].position >= 50 ? stops[0].position / 2 : (stops[0].position + 100) / 2
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  let bestGap = -1
  let bestMidpoint = 50
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].position - sorted[i].position
    if (gap > bestGap) {
      bestGap = gap
      bestMidpoint = (sorted[i].position + sorted[i + 1].position) / 2
    }
  }
  return Math.round(bestMidpoint)
}

export function addStop(stops: DrumEditableStop[], coverage: Coverage): DrumEditableStop[] {
  const position = largestGapMidpoint(stops)
  return [...stops, { id: crypto.randomUUID(), coverage, position }]
}

/** Clamps position to [0,100], updates the matching stop, and returns all
 * stops re-sorted by position (stable for ties) — mirrors stopOrdering's
 * moveStop. */
export function moveStop(stops: DrumEditableStop[], id: string, position: number): DrumEditableStop[] {
  const clamped = Math.min(100, Math.max(0, position))
  const updated = stops.map((s) => (s.id === id ? { ...s, position: clamped } : s))
  return updated
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.position - b.s.position || a.i - b.i)
    .map(({ s }) => s)
}

/**
 * Commits the editable working set back to persisted shape: a position-sorted
 * `GradientStop[]` (hex derived from coverage) and a gradient-level `Coverage[]`
 * parallel to it.
 *
 * Both outputs are built from ONE sort call, not two independently-computed
 * ones. This is deliberate: the engineering-spec review flagged
 * independently-sorted commits as the single highest-risk bug surface in this
 * feature — coverage[i] and stops[i] silently pointing at different stops the
 * moment the two sorts disagree. Sharing the sorted array removes that
 * possibility by construction.
 */
export function toGradientCoverageStops(
  stops: DrumEditableStop[],
  inkHexes: string[]
): { stops: GradientStop[]; coverage: Coverage[] } {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  return {
    stops: sorted.map((s) => ({ hex: coverageToHex(s.coverage, inkHexes), position: s.position })),
    coverage: sorted.map((s) => s.coverage),
  }
}

/** Coverage vectors the user has pinned, keyed by stop index — the Drum
 * counterpart to palette.ts's ColorLocks. */
export type CoverageLocks = Record<number, Coverage>

/** Stop positions the user has pinned, keyed by index — identical shape to
 * palette.ts's PositionLocks, duplicated for the same reason as everything
 * else in this file. */
export type DrumPositionLocks = Record<number, number>

function randomCoverage(inkCount: number): Coverage {
  // Sample within [FLOOR, CEILING] rather than [0, 100] — this is a sandbox
  // (colors freely explorable), not a penalty box (generate anything, then
  // flag it): drawing from the full 0-100 range meant most candidates
  // tripped the single-ink ceiling or the gradient floor before the user
  // ever touched a slider. Zero stays reachable (an ink can be absent from
  // a stop) — everything nonzero lands inside the safe band from the start.
  return Array.from({ length: inkCount }, () =>
    Math.random() < 0.15 ? 0 : Math.round(GRADIENT_FLOOR + Math.random() * (SINGLE_INK_CEILING - GRADIENT_FLOOR))
  )
}

/** Coverage-space jitter for an existing candidate: nudges each ink's
 * percentage independently. This does NOT jitter in Oklch and reverse-solve
 * for coverage — the engineering-spec review found that underdetermined
 * (multiple coverage vectors map to the same colour, so there's no single
 * inverse to solve for). Coverage is jittered directly instead. */
function jitterCoverage(coverage: Coverage): Coverage {
  return coverage.map((c) => (c === 0 ? 0 : clampCoverage(c + (Math.random() - 0.5) * 20)))
}

/** Pulls a candidate back inside the safe band after jitter can still push
 * it out: snaps near-zero back to true zero (rather than a barely-there
 * trace that reads as a mistake), clamps the single-ink ceiling, and scales
 * the whole vector down if the cross-layer total still runs over. Keeps
 * every generated candidate preflight-clean by construction, so exploring
 * gradients doesn't mean wading through warnings first. */
function sanitizeCoverage(coverage: Coverage): Coverage {
  const snapped = coverage.map((c) => {
    if (c <= 0) return 0
    if (c < GRADIENT_FLOOR) return c < GRADIENT_FLOOR / 2 ? 0 : GRADIENT_FLOOR
    return Math.min(c, SINGLE_INK_CEILING)
  })
  const total = snapped.reduce((sum, c) => sum + c, 0)
  if (total <= TOTAL_INK_CEILING) return snapped
  const scale = TOTAL_INK_CEILING / total
  return snapped.map((c) => (c === 0 ? 0 : Math.max(GRADIENT_FLOOR, c * scale)))
}

function buildCandidateCoverage(inkCount: number, stopCount: number): Coverage[] {
  const coverages: Coverage[] = []
  for (let i = 0; i < stopCount; i++) {
    coverages.push(sanitizeCoverage(jitterCoverage(randomCoverage(inkCount))))
  }
  return coverages
}

// Weighted-random pick among candidates, using score^2 as the sampling
// weight — same mechanism as palette.ts's pickByScore. The scorer itself is
// confirmed to transfer as-is to riso's reachable gamut without reweighting
// (PRD §9): it's only ever used ordinally here, exactly as it is in `palette`.
function pickByScore(candidates: Coverage[][], inkHexes: string[]): Coverage[] {
  const weights = candidates.map((coverages) => {
    const colors = coverages.map((c) => hexToOklch(coverageToHex(c, inkHexes)))
    return Math.max(0.0001, scorePalette(colors)) ** 2
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

const CANDIDATE_COUNT = 8

/**
 * The coverage-space counterpart to palette.ts's generateGradientStops. Not
 * shared code with it — confirmed by the engineering-spec review that
 * generateGradientStops hardcodes Oklch and doesn't transfer; this is a
 * parallel implementation of the same shape (candidate pool, weighted pick,
 * locks honoured by participating in scoring rather than pasted on after).
 */
export function generateGradientCoverage(
  inkHexes: string[],
  locks: CoverageLocks = {},
  positionLocks: DrumPositionLocks = {}
): { stops: GradientStop[]; coverage: Coverage[] } {
  const lockedIndices = Object.keys(locks).map(Number).filter((i) => Number.isInteger(i) && i >= 0)
  const lockedPositionIndices = Object.keys(positionLocks)
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0)
  const random = 3 + Math.floor(Math.random() * 4) // 3-6
  const stopCount = Math.max(
    random,
    ...lockedIndices.map((i) => i + 1),
    ...lockedPositionIndices.map((i) => i + 1)
  )

  function applyLocks(coverages: Coverage[]): Coverage[] {
    for (const index of lockedIndices) {
      if (index < coverages.length) coverages[index] = locks[index]
    }
    return coverages
  }

  const candidates: Coverage[][] = []
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    candidates.push(applyLocks(buildCandidateCoverage(inkHexes.length, stopCount)))
  }
  const coverages = pickByScore(candidates, inkHexes)

  const stops = coverages.map((coverage, i) => ({
    hex: coverageToHex(coverage, inkHexes),
    position: positionLocks[i] ?? Math.round((i / (stopCount - 1)) * 100),
  }))

  return { stops, coverage: coverages }
}
