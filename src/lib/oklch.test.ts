import { describe, it, expect } from 'vitest'
import { oklchToSrgb, srgbToOklch } from './oklch'

describe('oklch <-> srgb conversion', () => {
  it('round-trips a mid-lightness teal within tolerance', () => {
    const original = { l: 0.7, c: 0.1, h: 200 }
    const rgb = oklchToSrgb(original)
    const back = srgbToOklch(rgb)
    expect(back.l).toBeCloseTo(original.l, 1)
    expect(back.c).toBeCloseTo(original.c, 1)
    expect(back.h).toBeCloseTo(original.h, 0)
  })

  it('converts OKLCH black to rgb(0,0,0)', () => {
    const rgb = oklchToSrgb({ l: 0, c: 0, h: 0 })
    expect(rgb.r).toBeCloseTo(0, 1)
    expect(rgb.g).toBeCloseTo(0, 1)
    expect(rgb.b).toBeCloseTo(0, 1)
  })

  it('converts OKLCH white to rgb(255,255,255)', () => {
    const rgb = oklchToSrgb({ l: 1, c: 0, h: 0 })
    expect(rgb.r).toBeCloseTo(255, 0)
    expect(rgb.g).toBeCloseTo(255, 0)
    expect(rgb.b).toBeCloseTo(255, 0)
  })

  it('produces a valid hex string', () => {
    const rgb = oklchToSrgb({ l: 0.6, c: 0.15, h: 30 })
    expect(rgbToHex(rgb)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}
