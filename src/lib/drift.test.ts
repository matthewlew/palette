import { describe, it, expect } from 'vitest'
import { driftGradientStops } from './drift'
import { hexToOklch } from './oklch'
import type { GradientStop } from './gradient'

const prev: GradientStop[] = [
  { hex: '#2e7d32', position: 0 },
  { hex: '#66bb6a', position: 100 },
]

function seqRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('driftGradientStops', () => {
  it('preserves stop count and positions', () => {
    const next = driftGradientStops(prev, seqRng([0.5]))
    expect(next).toHaveLength(prev.length)
    expect(next.map((s) => s.position)).toEqual([0, 100])
  })

  it('nudges each stop within the per-channel bounds (hue +/-20, L +/-0.05, C +/-0.04)', () => {
    const next = driftGradientStops(prev, seqRng([1]))
    next.forEach((s, i) => {
      const before = hexToOklch(prev[i].hex)
      const after = hexToOklch(s.hex)
      expect(Math.abs(after.l - before.l)).toBeLessThanOrEqual(0.05 + 0.01)
      expect(Math.abs(after.c - before.c)).toBeLessThanOrEqual(0.04 + 0.01)
      let dh = Math.abs(after.h - before.h)
      if (dh > 180) dh = 360 - dh
      expect(dh).toBeLessThanOrEqual(20 + 1)
    })
  })

  it('returns a different palette than the input (it actually drifts)', () => {
    const next = driftGradientStops(prev, seqRng([1]))
    expect(next.map((s) => s.hex)).not.toEqual(prev.map((s) => s.hex))
  })

  it('is a pure function of prev + rng (no mutation of input)', () => {
    const snapshot = JSON.parse(JSON.stringify(prev))
    driftGradientStops(prev, seqRng([0.3, 0.7]))
    expect(prev).toEqual(snapshot)
  })
})
