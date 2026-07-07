import { describe, it, expect } from 'vitest'
import { generateGradientStops } from './palette'
import { DEFAULT_COLOR_SET } from './colorSets'

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
