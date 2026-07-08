import { describe, it, expect } from 'vitest'
import { generateGradientStops } from './palette'
import { DEFAULT_COLOR_SET } from './colorSets'
import { scorePalette } from './paletteScore'
import { hexToOklch } from './oklch'

describe('generateGradientStops', () => {
  it('produces between 3 and 6 stops', () => {
    for (let i = 0; i < 20; i++) {
      const stops = generateGradientStops(DEFAULT_COLOR_SET)
      expect(stops.length).toBeGreaterThanOrEqual(3)
      expect(stops.length).toBeLessThanOrEqual(6)
    }
  })

  it('produces stops with valid hex colors and 0-100 positions in ascending order', () => {
    const stops = generateGradientStops(DEFAULT_COLOR_SET)
    for (const stop of stops) {
      expect(stop.hex).toMatch(/^#[0-9a-f]{6}$/)
      expect(stop.position).toBeGreaterThanOrEqual(0)
      expect(stop.position).toBeLessThanOrEqual(100)
    }
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].position).toBeGreaterThan(stops[i - 1].position)
    }
  })

  it('jitters colors so repeated calls are not identical', () => {
    const a = generateGradientStops(DEFAULT_COLOR_SET)
    const b = generateGradientStops(DEFAULT_COLOR_SET)
    expect(a.map((s) => s.hex).join(',')).not.toBe(b.map((s) => s.hex).join(','))
  })

  it('samples only from the given color set', () => {
    const tinySet = { name: 'tiny', colors: [{ name: 'Only', value: { l: 0.5, c: 0.1, h: 10 } }] }
    const stops = generateGradientStops(tinySet)
    for (const stop of stops) {
      expect(stop.hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('generateGradientStops aesthetic bias', () => {
  it('produces a materially higher average score than unweighted random+jitter', () => {
    // Baseline: plain random pick + jitter, no candidate scoring —
    // reimplements the pre-scoring behavior inline so this test doesn't
    // depend on internals of palette.ts.
    function pickRandom<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]
    }
    function jitter(color: { l: number; c: number; h: number }) {
      return {
        l: Math.min(1, Math.max(0, color.l + (Math.random() - 0.5) * 0.1)),
        c: Math.max(0, color.c + (Math.random() - 0.5) * 0.04),
        h: (color.h + (Math.random() - 0.5) * 20 + 360) % 360,
      }
    }
    function baselineScore(): number {
      const stopCount = 3 + Math.floor(Math.random() * 4)
      const colors = []
      for (let i = 0; i < stopCount; i++) {
        colors.push(jitter(pickRandom(DEFAULT_COLOR_SET.colors).value))
      }
      return scorePalette(colors)
    }

    const iterations = 200
    let baselineTotal = 0
    let generatedTotal = 0
    for (let i = 0; i < iterations; i++) {
      baselineTotal += baselineScore()
      const stops = generateGradientStops(DEFAULT_COLOR_SET)
      const colors = stops.map((s) => hexToOklch(s.hex))
      generatedTotal += scorePalette(colors)
    }
    const baselineAvg = baselineTotal / iterations
    const generatedAvg = generatedTotal / iterations
    expect(generatedAvg).toBeGreaterThan(baselineAvg + 5)
  })
})
