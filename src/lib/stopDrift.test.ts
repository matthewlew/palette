import { describe, it, expect } from 'vitest'
import { driftStops, amplitudeFor, canDrift, isDriftableType } from './stopDrift'
import type { GradientStop } from './gradient'

const stops = (...positions: number[]): GradientStop[] =>
  positions.map((position, i) => ({ hex: ['#622b00', '#00897e', '#798184', '#ffcc00'][i % 4], position }))

/** Sample a full cycle of the slowest stop, so nothing can hide between frames. */
const FRAMES = Array.from({ length: 800 }, (_, i) => i * 50) // 0–40s at 50ms

describe('driftStops', () => {
  it('never changes a colour', () => {
    const input = stops(0, 40, 80)
    for (const t of FRAMES) {
      expect(driftStops(input, t).map((s) => s.hex)).toEqual(input.map((s) => s.hex))
    }
  })

  it('keeps stops in ascending order at every frame', () => {
    // Includes the pathological case palette actually produces: two stops half
    // a unit apart.
    for (const input of [stops(0, 40, 80), stops(0, 19.3, 19.85), stops(0, 25, 50, 75)]) {
      for (const t of FRAMES) {
        const out = driftStops(input, t).map((s) => s.position)
        const sorted = [...out].sort((a, b) => a - b)
        expect(out).toEqual(sorted)
      }
    }
  })

  it('never leaves the 0–100 range', () => {
    for (const input of [stops(0, 50, 100), stops(2, 98), stops(0, 19.3, 19.85)]) {
      for (const t of FRAMES) {
        for (const s of driftStops(input, t)) {
          expect(s.position).toBeGreaterThanOrEqual(0)
          expect(s.position).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('is a pure function of time — the same moment renders the same frame', () => {
    const input = stops(0, 40, 80)
    expect(driftStops(input, 12_345)).toEqual(driftStops(input, 12_345))
  })

  it('starts at rest nowhere in particular, so stops are not synchronised', () => {
    // If every stop shared a phase they would all sit at their home position at
    // t=0 and slide together, which reads as a scroll rather than as drift.
    const out = driftStops(stops(10, 40, 70, 95), 0)
    const offsets = out.map((s, i) => s.position - [10, 40, 70, 95][i])
    expect(new Set(offsets.map((o) => o.toFixed(3))).size).toBeGreaterThan(1)
  })

  it('actually moves stops that have room', () => {
    const input = stops(0, 50, 100)
    const moved = FRAMES.some((t) =>
      driftStops(input, t).some((s, i) => Math.abs(s.position - input[i].position) > 1)
    )
    expect(moved).toBe(true)
  })
})

describe('isDriftableType', () => {
  it('excludes exactly angular and square', () => {
    expect(isDriftableType('angular')).toBe(false)
    expect(isDriftableType('square')).toBe(false)
    for (const t of ['linear', 'radial', 'fan', 'mirror', 'repeat'] as const) {
      expect(isDriftableType(t)).toBe(true)
    }
  })
})

describe('amplitudeFor', () => {
  it('gives a crowded stop almost no room', () => {
    // 19.3 and 19.85 are 0.55 apart; neither may travel far enough to meet.
    const input = stops(0, 19.3, 19.85)
    expect(amplitudeFor(input, 1)).toBeLessThan(0.3)
    expect(amplitudeFor(input, 2)).toBeLessThan(0.3)
  })

  it('caps a roomy stop at the maximum rather than letting it roam', () => {
    expect(amplitudeFor(stops(0, 50, 100), 1)).toBe(6)
  })

  it('measures the end stops against the 0 and 100 boundaries', () => {
    // A stop sitting on 0 has no room on its left, so it cannot move at all.
    expect(amplitudeFor(stops(0, 50, 100), 0)).toBe(0)
    // A stop at 10 is bounded by the boundary (10) rather than by its
    // neighbour (40), so it gets 10 * NEIGHBOUR_HEADROOM.
    expect(amplitudeFor(stops(10, 50, 90), 0)).toBeCloseTo(4.2, 5)
  })
})

describe('canDrift', () => {
  it('is false when every stop is boxed in', () => {
    expect(canDrift(stops(0, 0.2, 0.4), 'linear')).toBe(false)
  })

  it('is true for an ordinary spread', () => {
    expect(canDrift(stops(0, 40, 80), 'linear')).toBe(true)
  })

  it('is false for geometries that are not built from positions', () => {
    // angular spreads colours by index (i/n) and square paints solid blocks,
    // so drifting either produces identical CSS every frame — the button would
    // toggle and nothing would move.
    expect(canDrift(stops(0, 40, 80), 'angular')).toBe(false)
    expect(canDrift(stops(0, 40, 80), 'square')).toBe(false)
  })

  it('is true for every geometry that IS built from positions', () => {
    for (const type of ['linear', 'radial', 'fan', 'mirror', 'repeat'] as const) {
      expect(canDrift(stops(0, 40, 80), type)).toBe(true)
    }
  })
})

describe('drift actually changes the rendered CSS', () => {
  it('produces different CSS across frames for each position-driven type', async () => {
    const { buildGradientCss } = await import('./gradient')
    const input = stops(0, 40, 80)
    for (const type of ['linear', 'radial', 'fan', 'mirror', 'repeat'] as const) {
      const frames = [0, 3000, 6000, 9000].map((t) =>
        buildGradientCss(type, driftStops(input, t), false, { smooth: true })
      )
      expect(new Set(frames).size, `${type} should animate`).toBeGreaterThan(1)
    }
  })

  it('produces IDENTICAL CSS for angular, which is why the button disables', async () => {
    const { buildGradientCss } = await import('./gradient')
    const input = stops(0, 40, 80)
    const frames = [0, 3000, 6000].map((t) =>
      buildGradientCss('angular', driftStops(input, t), false, {})
    )
    expect(new Set(frames).size).toBe(1)
  })
})
