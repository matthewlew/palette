import { describe, it, expect } from 'vitest'
import {
  oklchToSrgb,
  srgbToOklch,
  oklchToHex,
  hexToOklch,
  blendOklchHex,
  isLightColor,
} from './oklch'

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

  it('clamps out-of-gamut colors to the 0-255 range', () => {
    const rgb = oklchToSrgb({ l: 0.5, c: 0.5, h: 30 })
    expect(rgb.r).toBeGreaterThanOrEqual(0)
    expect(rgb.r).toBeLessThanOrEqual(255)
    expect(rgb.g).toBeGreaterThanOrEqual(0)
    expect(rgb.g).toBeLessThanOrEqual(255)
    expect(rgb.b).toBeGreaterThanOrEqual(0)
    expect(rgb.b).toBeLessThanOrEqual(255)
  })
})

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

describe('hex <-> oklch and blending', () => {
  it('round-trips a hex color through hexToOklch and oklchToHex within tolerance', () => {
    const original = '#3388cc'
    const oklch = hexToOklch(original)
    const back = oklchToHex(oklch)
    // Allow off-by-one hex digit rounding.
    const toRgbInt = (hex: string) => parseInt(hex.slice(1), 16)
    expect(Math.abs(toRgbInt(back) - toRgbInt(original))).toBeLessThan(0x020202)
  })

  it('blends two hex colors at t=0.5 to something between them in lightness', () => {
    const dark = '#000000'
    const light = '#ffffff'
    const blended = blendOklchHex(dark, light, 0.5)
    const blendedL = hexToOklch(blended).l
    expect(blendedL).toBeGreaterThan(0.3)
    expect(blendedL).toBeLessThan(0.7)
  })

  it('blends hue via the shortest circular path (350deg to 10deg blends near 0deg, not 180deg)', () => {
    const a = oklchToHex({ l: 0.6, c: 0.15, h: 350 })
    const b = oklchToHex({ l: 0.6, c: 0.15, h: 10 })
    const blended = blendOklchHex(a, b, 0.5)
    const blendedHue = hexToOklch(blended).h
    // Shortest path from 350 to 10 passes through 0/360, so the midpoint
    // should be near 0 (or 360), not near 180.
    const distanceFromZero = Math.min(blendedHue, 360 - blendedHue)
    expect(distanceFromZero).toBeLessThan(15)
  })

  it('reports a light color (high L) as light', () => {
    expect(isLightColor('#ffffff')).toBe(true)
  })

  it('reports a dark color (low L) as not light', () => {
    expect(isLightColor('#000000')).toBe(false)
  })
})
