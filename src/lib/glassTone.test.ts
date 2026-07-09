import { describe, it, expect } from 'vitest'
import { gradientColorAt } from './gradient'
import { hexToOklch } from './oklch'
import { glassToneAt } from './glassTone'
import type { Gradient } from '../store/types'

const stops = [
  { hex: '#ffffff', position: 0 },
  { hex: '#000000', position: 100 },
]

function makeGradient(overrides: Partial<Gradient> = {}): Gradient {
  return { id: 'g', type: 'linear', stops, ...overrides }
}

describe('gradientColorAt', () => {
  it('samples a vertical linear gradient by y', () => {
    expect(gradientColorAt('linear', stops, 0.5, 0)).toBe('#ffffff')
    expect(gradientColorAt('linear', stops, 0.5, 1)).toBe('#000000')
  })

  it('ignores x for linear gradients', () => {
    expect(gradientColorAt('linear', stops, 0, 0.1)).toBe(gradientColorAt('linear', stops, 1, 0.1))
  })

  it('samples radial gradients by distance from the center', () => {
    expect(gradientColorAt('radial', stops, 0.5, 0.5)).toBe('#ffffff')
    expect(gradientColorAt('radial', stops, 0, 0)).toBe('#000000') // corner
  })

  it('respects the reversed flag', () => {
    expect(gradientColorAt('linear', stops, 0.5, 0, true)).toBe('#000000')
  })

  it('respects the repeat filter: the first color returns in the second cycle', () => {
    // With 2 stops doubled to 4 even stops (0/33/67/100), y=0.67 is the
    // second cycle's white; without repeat that spot is nearly black.
    expect(gradientColorAt('linear', stops, 0.5, 0.67, false, { repeat: true })).toBe('#ffffff')
  })

  it('respects the hard filter: bands cut at the midpoint instead of blending', () => {
    expect(gradientColorAt('linear', stops, 0.5, 0.45, false, { hard: true })).toBe('#ffffff')
    expect(gradientColorAt('linear', stops, 0.5, 0.55, false, { hard: true })).toBe('#000000')
  })

  it('samples Turrell squares by nesting depth: edges show the outermost color', () => {
    expect(gradientColorAt('square', stops, 0.02, 0.5)).toBe('#ffffff')
    expect(gradientColorAt('square', stops, 0.5, 0.5)).toBe('#000000')
  })

  it('samples mirror gradients as a palindrome: both ends match', () => {
    expect(gradientColorAt('mirror', stops, 0.5, 0)).toBe('#ffffff')
    expect(gradientColorAt('mirror', stops, 0.5, 1)).toBe('#ffffff')
    expect(gradientColorAt('mirror', stops, 0.5, 0.5)).toBe('#000000')
  })

  it('samples angular gradients by clockwise angle from the top', () => {
    // Just past the top edge clockwise: still near the first (white) color;
    // deep into the sweep the second (black) color dominates.
    expect(hexToOklch(gradientColorAt('angular', stops, 0.52, 0.05)).l).toBeGreaterThan(0.9)
    expect(hexToOklch(gradientColorAt('angular', stops, 0.2, 0.9)).l).toBeLessThan(0.5)
  })
})

describe('glassToneAt', () => {
  it('flips to dark over a bright backdrop', () => {
    expect(glassToneAt(makeGradient(), 0.5, 0.05)).toBe('dark')
  })

  it('stays light over a dark backdrop', () => {
    expect(glassToneAt(makeGradient(), 0.5, 0.95)).toBe('light')
  })

  it('accounts for the reversed flag', () => {
    expect(glassToneAt(makeGradient({ reversed: true }), 0.5, 0.05)).toBe('light')
  })

  it('accounts for the hard filter', () => {
    // At y=0.45 a smooth blend is mid-gray (light tone), but hard bands keep
    // pure white up to the 50% cut.
    expect(glassToneAt(makeGradient({ hardStops: true }), 0.5, 0.45)).toBe('dark')
  })
})
