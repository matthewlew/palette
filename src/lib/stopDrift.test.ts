import { describe, it, expect } from 'vitest'
import { driftStops, amplitudeFor, canDrift, isDriftableType } from './stopDrift'
import type { GradientStop } from './gradient'

const stops = (...positions: number[]): GradientStop[] =>
  positions.map((position, i) => ({ hex: ['#622b00', '#00897e', '#798184', '#ffcc00'][i % 4], position }))

/** Sample a full cycle of the slowest stop, so nothing can hide between frames.
 * Periods are PERIOD_MIN_MS + PERIOD_SPREAD_MS at the top end, currently 101s —
 * this window has to cover that or a test can pass by simply not looking long
 * enough, which is exactly how the crossing test failed when the periods were
 * lengthened. */
const FRAMES = Array.from({ length: 2400 }, (_, i) => i * 50) // 0–120s at 50ms

describe('driftStops', () => {
  it('leaves a colour alone whenever its neighbours are clear', () => {
    // The palette is only ever touched inside a crossing. Away from one, every
    // stop must still be exactly the hex the user picked.
    const input = stops(0, 40, 80)
    const originals = new Set(input.map((s) => s.hex))
    let untouchedFrames = 0
    for (const t of FRAMES) {
      const out = driftStops(input, t)
      const gaps = out.slice(1).map((s, i) => s.position - out[i].position)
      if (Math.min(...gaps) >= 8) {
        expect(out.every((s) => originals.has(s.hex))).toBe(true)
        untouchedFrames++
      }
    }
    expect(untouchedFrames).toBeGreaterThan(0)
  })

  it('lets stops cross, so the ramp actually reorders', () => {
    // The old behaviour clamped amplitude below half the gap precisely so this
    // could never happen; it is now the point.
    // Sampled over three minutes, not FRAMES' forty seconds: a reorder needs the
    // two stops' independent periods to line up, which for a widely spaced ramp
    // is roughly once a minute. Measured across five ramp shapes it is 14–65
    // reorders per ten minutes, so this is frequent, not marginal.
    const input = stops(0, 40, 80)
    const longRun = Array.from({ length: 9000 }, (_, i) => i * 50) // 0–450s
    const orders = new Set(longRun.map((t) => driftStops(input, t).map((s) => s.hex).join('>')))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('dissolves a converging pair instead of cutting between them', () => {
    // At the tightest approach the two must have moved toward each other's
    // colour, so there is no hard edge at the moment they swap.
    const input = stops(0, 40, 52, 100)
    let tightest = Infinity
    let atTightest: ReturnType<typeof driftStops> = []
    for (const t of FRAMES) {
      const out = driftStops(input, t)
      const gaps = out.slice(1).map((s, i) => s.position - out[i].position)
      const min = Math.min(...gaps)
      if (min < tightest) { tightest = min; atTightest = out }
    }
    expect(tightest).toBeLessThan(2)
    const originals = new Set(input.map((s) => s.hex))
    const blended = atTightest.filter((s) => !originals.has(s.hex))
    expect(blended.length).toBeGreaterThanOrEqual(2)
  })

  it('brings a coincident pair to the same colour, which is what removes the cut', () => {
    const input = stops(0, 40, 52, 100)
    let closest = Infinity
    let pair: [string, string] = ['', '']
    for (const t of FRAMES) {
      const out = driftStops(input, t)
      for (let i = 0; i < out.length - 1; i++) {
        const gap = out[i + 1].position - out[i].position
        if (gap < closest) { closest = gap; pair = [out[i].hex, out[i + 1].hex] }
      }
    }
    // At coincidence the two resolve to the SAME hex. That is precisely what
    // removes the cut: there is no edge left to see at the moment they swap.
    expect(pair[0]).toBe(pair[1])
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
  it('excludes only square', () => {
    // angular was excluded too, back when it spread colours by index and
    // discarded positions; it now scales them into the circle and drifts.
    expect(isDriftableType('square')).toBe(false)
    for (const t of ['linear', 'radial', 'fan', 'mirror', 'repeat', 'angular'] as const) {
      expect(isDriftableType(t)).toBe(true)
    }
  })
})

describe('amplitudeFor', () => {
  it('gives a crowded stop almost no room', () => {
    // 19.3 and 19.85 are 0.55 apart. Travel stays proportional to that gap, so
    // a tight pair still moves tightly — but it may now just reach its
    // neighbour and trade places, where before it was clamped short on purpose.
    const input = stops(0, 19.3, 19.85)
    const a = amplitudeFor(input, 1)
    expect(a).toBeLessThan(0.6)
    expect(2 * a).toBeGreaterThan(0.55)
  })

  it('caps a roomy stop at the maximum rather than letting it roam', () => {
    expect(amplitudeFor(stops(0, 50, 100), 1)).toBe(26)
  })

  it('measures the end stops against the 0 and 100 boundaries', () => {
    // A stop sitting on 0 has no room on its left, so it cannot move at all.
    expect(amplitudeFor(stops(0, 50, 100), 0)).toBe(0)
    // A stop at 10 is bounded by the boundary (10) rather than by its
    // neighbour (40), so it gets 10 * NEIGHBOUR_REACH.
    expect(amplitudeFor(stops(10, 50, 90), 0)).toBeCloseTo(9.5, 5)
  })
})

describe('canDrift', () => {
  it('is false when every stop is boxed in', () => {
    expect(canDrift(stops(0, 0.2, 0.4), 'linear')).toBe(false)
  })

  it('is true for an ordinary spread', () => {
    expect(canDrift(stops(0, 40, 80), 'linear')).toBe(true)
  })

  it('is false for square, which paints solid blocks rather than a background', () => {
    expect(canDrift(stops(0, 40, 80), 'square')).toBe(false)
  })

  it('is true for every geometry that IS built from positions', () => {
    for (const type of ['linear', 'radial', 'fan', 'mirror', 'repeat', 'angular'] as const) {
      expect(canDrift(stops(0, 40, 80), type)).toBe(true)
    }
  })
})

describe('drift actually changes the rendered CSS', () => {
  it('produces different CSS across frames for each position-driven type', async () => {
    const { buildGradientCss } = await import('./gradient')
    const input = stops(0, 40, 80)
    for (const type of ['linear', 'radial', 'fan', 'mirror', 'repeat', 'angular'] as const) {
      const frames = [0, 3000, 6000, 9000].map((t) =>
        buildGradientCss(type, driftStops(input, t), false, { smooth: true })
      )
      expect(new Set(frames).size, `${type} should animate`).toBeGreaterThan(1)
    }
  })

  it('produces IDENTICAL CSS for square, which is why the button disables there', async () => {
    // buildSquareGradient paints equal wedges as a fallback; the real render is
    // TurrellSquare's nested blocks, which a drifting background never reaches.
    const { buildGradientCss } = await import('./gradient')
    const input = stops(0, 40, 80)
    const frames = [0, 3000, 6000].map((t) =>
      buildGradientCss('square', driftStops(input, t), false, {})
    )
    expect(new Set(frames).size).toBe(1)
  })
})
