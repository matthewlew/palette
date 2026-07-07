import { describe, it, expect } from 'vitest'
import { DEFAULT_COLOR_SET } from './colorSets'
import { hexToOklch, oklchToHex } from './oklch'

describe('DEFAULT_COLOR_SET', () => {
  it('has exactly 60 colors', () => {
    expect(DEFAULT_COLOR_SET.colors).toHaveLength(60)
  })

  it('has unique names', () => {
    const names = DEFAULT_COLOR_SET.colors.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has valid OKLCH ranges for every color', () => {
    for (const { value } of DEFAULT_COLOR_SET.colors) {
      expect(value.l).toBeGreaterThanOrEqual(0)
      expect(value.l).toBeLessThanOrEqual(1)
      expect(value.c).toBeGreaterThanOrEqual(0)
      expect(value.c).toBeLessThanOrEqual(0.4)
      expect(value.h).toBeGreaterThanOrEqual(0)
      expect(value.h).toBeLessThan(360)
    }
  })

  it('round-trips every color through hex within sRGB gamut (no clipping)', () => {
    for (const { name, value } of DEFAULT_COLOR_SET.colors) {
      const hex = oklchToHex(value)
      const roundTripped = hexToOklch(hex)
      expect(Math.abs(roundTripped.l - value.l), `${name} lightness`).toBeLessThanOrEqual(0.02)
      expect(Math.abs(roundTripped.c - value.c), `${name} chroma`).toBeLessThanOrEqual(0.02)
    }
  })

  it('has at least one color in each newly-added hue range', () => {
    const hues = DEFAULT_COLOR_SET.colors.map((c) => c.value.h)
    const inRange = (h: number, lo: number, hi: number) => h >= lo && h <= hi
    const inWrapRange = (h: number, lo: number, hi: number) => h >= lo || h <= hi

    expect(hues.some((h) => inRange(h, 75, 105)), 'yellow 75-105').toBe(true)
    expect(hues.some((h) => inRange(h, 40, 70)), 'orange 40-70').toBe(true)
    expect(hues.some((h) => inWrapRange(h, 340, 20)), 'pink 340-20 wrap').toBe(true)
    expect(hues.some((h) => inRange(h, 290, 335)), 'purple 290-335').toBe(true)
    expect(hues.some((h) => inRange(h, 170, 215)), 'teal 170-215').toBe(true)
  })
})
