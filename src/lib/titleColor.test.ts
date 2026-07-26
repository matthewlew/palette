import { describe, it, expect } from 'vitest'
import { contrastRatio, titleColorAt, paletteInkOn } from './titleColor'
import { lcOn, Lc } from 'lew-design-system/ink'
import { hexToOklch } from './oklch'
import type { Gradient } from '../store/types'

/** The floor titleColorAt/paletteInkOn enforce — APCA, not WCAG. */
const FLOOR = Lc.BODY_LARGE

function makeGradient(hexes: string[], overrides: Partial<Gradient> = {}): Gradient {
  return {
    id: 'g1',
    type: 'linear',
    reversed: false,
    stops: hexes.map((hex, i) => ({
      hex,
      position: hexes.length === 1 ? 0 : Math.round((i / (hexes.length - 1)) * 100),
    })),
    ...overrides,
  }
}

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 10)
  })
})

describe('titleColorAt', () => {
  it('picks the palette stop with the most contrast against the local backdrop', () => {
    // Near-white top, near-black bottom: at the top the backdrop is light,
    // so the dark stop is the natural in-palette title color.
    const gradient = makeGradient(['#f5f5f5', '#101014'])
    expect(titleColorAt(gradient, 0.5, 0.02)).toBe('#101014')
  })

  it('answers differently at the two ends of a linear gradient', () => {
    const gradient = makeGradient(['#f5f5f5', '#101014'])
    const top = titleColorAt(gradient, 0.5, 0.02)
    const bottom = titleColorAt(gradient, 0.5, 0.98)
    expect(top).not.toBe(bottom)
    expect(bottom).toBe('#f5f5f5')
  })

  it('respects reversed gradients when sampling the backdrop', () => {
    const gradient = makeGradient(['#f5f5f5', '#101014'], { reversed: true })
    // Reversed: the dark end is now at the top, so the light stop wins there.
    expect(titleColorAt(gradient, 0.5, 0.02)).toBe('#f5f5f5')
  })

  it('lightens a stop rather than dumping to white over an all-dark palette', () => {
    // No stop clears APCA against the near-black backdrop, so the best one is
    // walked up its OKLCH lightness axis. Under the old WCAG check this
    // returned a flat '#ffffff'; keeping the palette's own hue is the point of
    // the nudge, and without it ~94% of labels would degrade to white/black.
    const gradient = makeGradient(['#101014', '#1a1a22', '#22222c'])
    const ink = titleColorAt(gradient, 0.5, 0.02)
    expect(ink).not.toBe('#ffffff')
    expect(lcOn(ink, '#101014')).toBeGreaterThanOrEqual(FLOOR)
  })

  it('darkens a stop rather than dumping to black over an all-light palette', () => {
    const gradient = makeGradient(['#f5f5f0', '#eeeee6', '#e6e6da'])
    const ink = titleColorAt(gradient, 0.5, 0.02)
    expect(ink).not.toBe('#000000')
    expect(lcOn(ink, '#f5f5f0')).toBeGreaterThanOrEqual(FLOOR)
  })

  it('still falls back to knockout ink when no lightness clears the floor', () => {
    // A mid-grey backdrop is the genuinely hard case: neither white (Lc 68.5)
    // nor black (Lc 41.0) clears 75, so no nudge along any lightness axis can
    // either, and the last-resort knockout pick is all that is left.
    const gradient = makeGradient(['#808080', '#828282'])
    const ink = titleColorAt(gradient, 0.5, 0.5)
    expect(['#ffffff', '#000000']).toContain(ink)
  })
})

describe('paletteInkOn', () => {
  const SURFACE = '#101014'

  it('keeps a vivid stop as a legible tint of its own hue', () => {
    const gradient = makeGradient(['#101014', '#ff5aa0', '#3ad0ff'])
    const ink = paletteInkOn(gradient, SURFACE)
    // The raw pink clears WCAG AA easily (6.53:1) but only reaches APCA Lc 46.9
    // on this near-black surface — one of the mid-tone cases WCAG overstates.
    // So it is lightened, and must stay recognisably the same hue.
    expect(ink).not.toBe('#ffffff')
    expect(lcOn(ink, SURFACE)).toBeGreaterThanOrEqual(FLOOR)
    const hueShift = Math.abs(hexToOklch(ink).h - hexToOklch('#ff5aa0').h)
    expect(Math.min(hueShift, 360 - hueShift)).toBeLessThan(5)
  })

  it('lightens a too-dark vivid stop to a legible tint of the same hue', () => {
    // Deep saturated blue: too dark on the surface, so it must be lightened
    // (not thrown away for white) while clearing the floor.
    const gradient = makeGradient(['#0a0a2e', '#141446', '#1e1e5a'])
    const ink = paletteInkOn(gradient, SURFACE)
    expect(ink).not.toBe('#ffffff')
    expect(lcOn(ink, SURFACE)).toBeGreaterThanOrEqual(FLOOR)
  })

  it('lightens even a near-black desaturated palette into a legible tint', () => {
    // Nothing colorful to echo, but lightening still yields a legible gray
    // derived from the palette rather than dumping to raw dark stops.
    const gradient = makeGradient(['#050506', '#0a0a0b', '#0e0e10'])
    const ink = paletteInkOn(gradient, SURFACE)
    expect(ink).not.toBe('#050506')
    expect(lcOn(ink, SURFACE)).toBeGreaterThanOrEqual(FLOOR)
  })
})
