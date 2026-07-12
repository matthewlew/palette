import { describe, it, expect } from 'vitest'
import { contrastRatio, titleColorAt, paletteInkOn } from './titleColor'
import type { Gradient } from '../store/types'

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

  it('falls back to white over a dark palette with no contrasting stop', () => {
    const gradient = makeGradient(['#101014', '#1a1a22', '#22222c'])
    expect(titleColorAt(gradient, 0.5, 0.02)).toBe('#ffffff')
  })

  it('falls back to black over a light palette with no contrasting stop', () => {
    const gradient = makeGradient(['#f5f5f0', '#eeeee6', '#e6e6da'])
    expect(titleColorAt(gradient, 0.5, 0.02)).toBe('#000000')
  })
})

describe('paletteInkOn', () => {
  const SURFACE = '#101014'

  it('uses a vivid palette stop directly when it already reads on the surface', () => {
    const gradient = makeGradient(['#101014', '#ff5aa0', '#3ad0ff'])
    const ink = paletteInkOn(gradient, SURFACE)
    // The bright pink/cyan stops clear AA on the dark surface, so one is used
    // verbatim rather than white.
    expect(['#ff5aa0', '#3ad0ff']).toContain(ink)
    expect(contrastRatio(ink, SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('lightens a too-dark vivid stop to a legible tint of the same hue', () => {
    // Deep saturated blue: too dark on the surface, so it must be lightened
    // (not thrown away for white) while clearing AA.
    const gradient = makeGradient(['#0a0a2e', '#141446', '#1e1e5a'])
    const ink = paletteInkOn(gradient, SURFACE)
    expect(ink).not.toBe('#ffffff')
    expect(contrastRatio(ink, SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('lightens even a near-black desaturated palette into a legible tint', () => {
    // Nothing colorful to echo, but lightening still yields a legible gray
    // derived from the palette rather than dumping to raw dark stops.
    const gradient = makeGradient(['#050506', '#0a0a0b', '#0e0e10'])
    const ink = paletteInkOn(gradient, SURFACE)
    expect(ink).not.toBe('#050506')
    expect(contrastRatio(ink, SURFACE)).toBeGreaterThanOrEqual(4.5)
  })
})
