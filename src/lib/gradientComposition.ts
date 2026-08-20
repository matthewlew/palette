import type { GradientStop } from './gradient'
import { hexToOklch } from './oklch'

/**
 * Deterministic, theory-driven stop transforms for the ?vote=true
 * 'order'/'spacing'/'symmetry' controlled-variant tests — as opposed to
 * GradientVote.tsx's `reorderColors`/`varySpacing`, which are pure
 * randomness (useful as a baseline, but a win there can't say WHICH rule
 * caused it). Each function here tests one specific, articulable claim
 * about what makes a gradient read as more or less deliberate, so a win
 * rate on it is directly citable (see scripts/recalibrate-gradient-score.mjs's
 * per-strategy breakdown).
 *
 * Deliberately shape-agnostic only: an earlier version also had
 * light-center/light-edges/saturation-center/saturation-edges (place the
 * lightest/most-saturated stop at the middle or an end position), but
 * "edges" isn't a coherent concept for every shape — `angular` wraps in a
 * circle with no true edge, and `square`/Turrell is solid wedges with no
 * continuous blend to place a standout within — so voting on those under
 * those shapes was noise, not signal. Every function below applies the
 * same way regardless of shape.
 *
 * All operate on a GradientStop[] and return a new one; positions in the
 * *ordering* functions are held fixed (only which color sits at which
 * position changes) and hex order is held fixed in the *spacing*
 * functions (only positions change) — same "change exactly one variable"
 * discipline as GradientVote.tsx's mutation functions.
 */

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

/** Greedy nearest-neighbor ordering by circular hue distance: start from
 * the first stop, always jump to whichever remaining stop's hue is
 * closest — minimizes total hue "jump" across the sequence. Positions
 * stay fixed. Contrasted against GradientVote.tsx's reorderColors, a pure
 * random shuffle with no such constraint. */
export function orderByHueWalk(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 2) return stops
  const positions = stops.map((s) => s.position).sort((a, b) => a - b)
  const remaining = [...stops]
  const walk: GradientStop[] = [remaining.shift() as GradientStop]
  while (remaining.length > 0) {
    const lastHue = hexToOklch(walk[walk.length - 1].hex).h
    let bestIdx = 0
    let bestDist = Infinity
    remaining.forEach((s, i) => {
      const d = circularHueDistance(lastHue, hexToOklch(s.hex).h)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    })
    walk.push(remaining.splice(bestIdx, 1)[0])
  }
  return walk.map((s, i) => ({ ...s, position: positions[i] }))
}

/** Renormalizes an arbitrary set of position "weights" (relative gap
 * sizes between consecutive stops) back to positions spanning 0-100,
 * hex order and stop identity unchanged. */
function applyGapWeights(stops: GradientStop[], gapWeights: number[]): GradientStop[] {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const totalWeight = gapWeights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return stops
  let cursor = 0
  const positions = [0]
  for (const w of gapWeights) {
    cursor += (w / totalWeight) * 100
    positions.push(cursor)
  }
  return sorted.map((s, i) => ({ ...s, position: Math.round(positions[i]) }))
}

/** Widens the position gaps SURROUNDING the lowest-chroma (most neutral)
 * stop, so it reads as a buffer/breathing-space between its neighbors
 * rather than being crowded — tests "a neutral stop should get more
 * room." No-op below 3 stops (no interior stop to buffer). */
export function spacingBufferNeutral(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 3) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  let neutralIdx = 0
  let lowestChroma = Infinity
  sorted.forEach((s, i) => {
    const c = hexToOklch(s.hex).c
    if (c < lowestChroma) {
      lowestChroma = c
      neutralIdx = i
    }
  })
  // n stops -> n-1 gaps; gap i sits between stop i and stop i+1.
  const gapWeights = new Array(sorted.length - 1).fill(1)
  if (neutralIdx > 0) gapWeights[neutralIdx - 1] *= 1.75
  if (neutralIdx < gapWeights.length) gapWeights[neutralIdx] *= 1.75
  return applyGapWeights(sorted, gapWeights)
}

/** Widens the position gaps surrounding the LIGHTEST stop specifically
 * (as opposed to buffer-neutral's lowest-chroma target — the two often
 * coincide but aren't the same stop), simulating one large, undivided
 * light region rather than several smaller competing bands — tests "a
 * dominant light band draws the eye more than a fragmented one." No-op
 * below 3 stops. */
export function spacingDominantBand(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 3) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  let lightestIdx = 0
  let highestL = -Infinity
  sorted.forEach((s, i) => {
    const l = hexToOklch(s.hex).l
    if (l > highestL) {
      highestL = l
      lightestIdx = i
    }
  })
  const gapWeights = new Array(sorted.length - 1).fill(1)
  if (lightestIdx > 0) gapWeights[lightestIdx - 1] *= 2.5
  if (lightestIdx < gapWeights.length) gapWeights[lightestIdx] *= 2.5
  return applyGapWeights(sorted, gapWeights)
}

/** Builds a `[c1..cn..c1]`-style palindrome from the base's first half,
 * reflected outward — tests "a mirrored arrangement reads as deliberate."
 * Positions are re-spread evenly across 0-100 (a mirrored color count
 * rarely matches the original's position spacing meaningfully). No-op
 * below 3 stops. */
export function mirrorStops(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 3) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const half = sorted.slice(0, Math.ceil(sorted.length / 2))
  const mirrored = sorted.length % 2 === 0
    ? [...half, ...[...half].reverse()]
    : [...half, ...[...half].reverse().slice(1)]
  return mirrored.map((s, i) => ({ ...s, position: Math.round((i / (mirrored.length - 1)) * 100) }))
}
