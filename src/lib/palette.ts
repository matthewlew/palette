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

/**
 * @param stopCount Exact number of stops to generate. Omit for the usual
 * random 3-6. Passed when the feed's stop count is locked, so scrubbing the
 * rolodex varies the colours without varying how many there are.
 */
export function generateGradientStops(colorSet: ColorSet, stopCount?: number): GradientStop[] {
  const count = stopCount === undefined
    ? 3 + Math.floor(Math.random() * 4) // 3-6
    // Clamped rather than trusted: a count of 1 divides by zero in the position
    // maths below and yields a gradient of NaN% stops, which renders as nothing.
    : Math.min(MAX_STOPS, Math.max(MIN_STOPS, Math.round(stopCount)))

  const candidates: Oklch[][] = []
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    candidates.push(buildCandidateColors(colorSet, count))
  }
  const colors = pickByScore(candidates)

  return colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: Math.round((i / (count - 1)) * 100),
  }))
}
