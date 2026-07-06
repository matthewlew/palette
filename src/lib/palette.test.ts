import { describe, it, expect } from 'vitest'
import { generateGradientStops } from './palette'
import { SEED_PALETTES } from './seedPalettes'

describe('generateGradientStops', () => {
  it('produces between 3 and 6 stops', () => {
    for (let i = 0; i < 20; i++) {
      const { stops } = generateGradientStops()
      expect(stops.length).toBeGreaterThanOrEqual(3)
      expect(stops.length).toBeLessThanOrEqual(6)
    }
  })

  it('produces stops with valid hex colors and 0-100 positions in ascending order', () => {
    const { stops } = generateGradientStops()
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
    const a = generateGradientStops()
    const b = generateGradientStops()
    const aHexes = a.stops.map((s) => s.hex).join(',')
    const bHexes = b.stops.map((s) => s.hex).join(',')
    expect(aHexes).not.toBe(bHexes)
  })

  it('returns the name of the seed palette used, matching one of SEED_PALETTES', () => {
    const { seedName } = generateGradientStops()
    expect(SEED_PALETTES.map((p) => p.name)).toContain(seedName)
  })
})
