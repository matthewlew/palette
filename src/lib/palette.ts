import { oklchToHex, type Oklch } from './oklch'
import type { ColorSet } from './colorSets'
import type { GradientStop } from './gradient'
import { scorePalette } from './paletteScore'

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function jitter(color: Oklch): Oklch {
  return {
    l: Math.min(1, Math.max(0, color.l + (Math.random() - 0.5) * 0.1)),
    c: Math.max(0, color.c + (Math.random() - 0.5) * 0.04),
    h: (color.h + (Math.random() - 0.5) * 20 + 360) % 360,
  }
}

function buildCandidateColors(colorSet: ColorSet, stopCount: number): Oklch[] {
  const colors: Oklch[] = []
  for (let i = 0; i < stopCount; i++) {
    const base = pickRandom(colorSet.colors).value
    colors.push(jitter(base))
  }
  return colors
}

// Weighted-random pick among candidates, using score^2 as the sampling
// weight — sharpens the bias toward higher scorers while remaining
// stochastic, without collapsing to a deterministic best-of-N (keeps
// generation feeling exploratory).
function pickByScore(candidates: Oklch[][]): Oklch[] {
  const weights = candidates.map((colors) => Math.max(0.0001, scorePalette(colors)) ** 2)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

const CANDIDATE_COUNT = 8

/** The range the editor itself allows: it refuses to remove below 2 and to add
 * above 8, so a lock outside that could ask for a palette you could not then
 * edit back out of. */
export const MIN_STOPS = 2
export const MAX_STOPS = 8

/** The even ladder a freshly generated gradient sits on. */
export function evenPositions(count: number): number[] {
  const n = Math.min(MAX_STOPS, Math.max(MIN_STOPS, Math.round(count)))
  return Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * 100))
}

/**
 * A stop layout the generator can actually build on: the right length,
 * ascending, and inside the track.
 *
 * Nothing here is trusted, because the layout arrives from persisted-ish state
 * and from live editing. A single-stop ladder divides by zero in evenPositions
 * and yields NaN% stops, which render as nothing; positions out of order make
 * CSS clamp them silently, so the gradient stops matching the handles that
 * produced it.
 */
export function normalizeStopLayout(layout: readonly number[]): number[] {
  if (layout.length < MIN_STOPS || layout.length > MAX_STOPS) return evenPositions(layout.length)
  return layout
    .map((p) => (Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : 0))
    .sort((a, b) => a - b)
}

/**
 * @param layout Exact stop positions to generate onto. Omit for the usual
 * random 3-6 evenly spaced. Passed when the feed's stops are locked, so
 * scrubbing the rolodex varies the colours while leaving both how many stops
 * there are and where they sit exactly as the user placed them.
 */
export function generateGradientStops(colorSet: ColorSet, layout?: readonly number[]): GradientStop[] {
  const positions = layout
    ? normalizeStopLayout(layout)
    : evenPositions(3 + Math.floor(Math.random() * 4)) // 3-6

  const candidates: Oklch[][] = []
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    candidates.push(buildCandidateColors(colorSet, positions.length))
  }
  const colors = pickByScore(candidates)

  return colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: positions[i],
  }))
}
