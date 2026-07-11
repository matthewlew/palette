import { describe, it, expect } from 'vitest'
import { contrastRatio, titleColorAt } from './titleColor'
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
