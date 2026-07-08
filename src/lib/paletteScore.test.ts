import { describe, it, expect } from 'vitest'
import { saturationSpread, lightnessRange } from './paletteScore'
import type { Oklch } from './oklch'

describe('saturationSpread', () => {
  it('returns 0 for identical chroma', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.1, h: 0 },
      { l: 0.5, c: 0.1, h: 120 },
      { l: 0.5, c: 0.1, h: 240 },
    ]
    expect(saturationSpread(colors)).toBe(0)
  })

  it('returns higher values for wider chroma spread', () => {
    const tight: Oklch[] = [
      { l: 0.5, c: 0.08, h: 0 },
      { l: 0.5, c: 0.09, h: 120 },
      { l: 0.5, c: 0.1, h: 240 },
    ]
    const wide: Oklch[] = [
      { l: 0.5, c: 0.01, h: 0 },
      { l: 0.5, c: 0.2, h: 120 },
      { l: 0.5, c: 0.35, h: 240 },
    ]
    expect(saturationSpread(wide)).toBeGreaterThan(saturationSpread(tight))
  })

  it('clamps to [0, 1]', () => {
    const extreme: Oklch[] = [
      { l: 0.5, c: 0, h: 0 },
      { l: 0.5, c: 0.4, h: 180 },
    ]
    const v = saturationSpread(extreme)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  })
})

describe('lightnessRange', () => {
  it('returns 0 for identical lightness', () => {
    const colors: Oklch[] = [
      { l: 0.5, c: 0.1, h: 0 },
      { l: 0.5, c: 0.1, h: 120 },
    ]
    expect(lightnessRange(colors)).toBe(0)
  })

  it('returns 1 for full dark-to-light spread', () => {
    const colors: Oklch[] = [
      { l: 0.1, c: 0.05, h: 30 },
      { l: 0.9, c: 0.05, h: 30 },
    ]
    expect(lightnessRange(colors)).toBe(1)
  })

  it('returns higher values for wider range than narrower range', () => {
    const narrow: Oklch[] = [
      { l: 0.4, c: 0.1, h: 0 },
      { l: 0.5, c: 0.1, h: 0 },
    ]
    const wide: Oklch[] = [
      { l: 0.2, c: 0.1, h: 0 },
      { l: 0.8, c: 0.1, h: 0 },
    ]
    expect(lightnessRange(wide)).toBeGreaterThan(lightnessRange(narrow))
  })
})
