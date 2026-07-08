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

// Weighted-random pick among candidates, using score^6 as the sampling
// weight — biases strongly toward higher-scoring candidates without
// collapsing to a deterministic best-of-N (keeps generation feeling
// exploratory).
function pickByScore(candidates: Oklch[][]): Oklch[] {
  const weights = candidates.map((colors) => Math.max(0.0001, scorePalette(colors)) ** 6)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

const CANDIDATE_COUNT = 16

export function generateGradientStops(colorSet: ColorSet): GradientStop[] {
  const stopCount = 3 + Math.floor(Math.random() * 4) // 3-6

  const candidates: Oklch[][] = []
  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    candidates.push(buildCandidateColors(colorSet, stopCount))
  }
  const colors = pickByScore(candidates)

  return colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: Math.round((i / (stopCount - 1)) * 100),
  }))
}
