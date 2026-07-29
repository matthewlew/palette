import { hexToOklch, oklchToHex, type Oklch } from './oklch'
import type { ColorSet } from './colorSets'
import type { GradientStop } from './gradient'
import { scorePalette } from './paletteScore'

/** Colors the user has pinned, keyed by their index in the stop list. Every
 * generated palette keeps these exactly, and builds the rest around them. */
export type ColorLocks = Record<number, string>

/** Stop positions the user has pinned, keyed by index, as 0-100 percentages.
 * The colour locks' counterpart: this holds WHERE a stop sits rather than what
 * it is, and generation honours it the same way. */
export type PositionLocks = Record<number, number>

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

export function generateGradientStops(
  colorSet: ColorSet,
  locks: ColorLocks = {},
  positionLocks: PositionLocks = {}
): GradientStop[] {
  const lockedIndices = Object.keys(locks).map(Number).filter((i) => Number.isInteger(i) && i >= 0)
  const lockedPositionIndices = Object.keys(positionLocks)
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0)
  const random = 3 + Math.floor(Math.random() * 4) // 3-6
  // A lock at index 4 means there must BE an index 4. Without this floor the
  // pinned color (or position) silently vanishes whenever the roll comes up
  // short.
  const stopCount = Math.max(
    random,
    ...lockedIndices.map((i) => i + 1),
    ...lockedPositionIndices.map((i) => i + 1)
  )

  // Locked colors participate in scoring rather than being pasted on at the
  // end: the whole point of a lock is that the generator works AROUND it, and
  // a candidate is only worth picking if it harmonises with what's pinned.
  function applyLocks(colors: Oklch[]): Oklch[] {
    for (const index of lockedIndices) {
      if (index < colors.length) colors[index] = hexToOklch(locks[index])
    }
    return colors
  }

  const candidates: Oklch[][] = []
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    candidates.push(applyLocks(buildCandidateColors(colorSet, stopCount)))
  }
  const colors = pickByScore(candidates)

  return colors.map((color, i) => ({
    // The locked hex is written back verbatim, not round-tripped through
    // Oklch: hex → Oklch → hex is lossy by a digit or two, and a "locked"
    // color that drifts every scroll is not locked.
    hex: locks[i] ?? oklchToHex(color),
    // A pinned position holds across every roll; everything else falls back to
    // the even ladder, which is what an untouched palette has always used.
    position: positionLocks[i] ?? Math.round((i / (stopCount - 1)) * 100),
  }))
}
