import { describe, it, expect } from 'vitest'
import { describeGradient } from './gradientSummary'
import type { Gradient } from '../store/types'

const base: Gradient = {
  id: 'g1',
  type: 'square',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 25 },
    { hex: '#0000ff', position: 50 },
    { hex: '#ffff00', position: 75 },
    { hex: '#ff00ff', position: 100 },
  ],
  reversed: false,
}

describe('describeGradient', () => {
  it('names the shape as Turrell for square, not the internal type', () => {
    expect(describeGradient(base)).toBe('Turrell · 5 colors')
  })

  it('counts stops as "N colors"', () => {
    expect(describeGradient({ ...base, type: 'linear', stops: base.stops.slice(0, 2) }))
      .toBe('Linear · 2 colors')
  })

  it('appends ×2 when repeat is on', () => {
    expect(describeGradient({ ...base, repeatEnabled: true })).toBe('Turrell · 5 colors · ×2')
  })

  it('appends Hard when hard stops are on', () => {
    expect(describeGradient({ ...base, hardStops: true })).toBe('Turrell · 5 colors · Hard')
  })

  it('appends Smooth when smooth is on', () => {
    expect(describeGradient({ ...base, smoothEnabled: true })).toBe('Turrell · 5 colors · Smooth')
  })

  it('prefers Hard over Smooth if both are somehow set, never both', () => {
    expect(describeGradient({ ...base, hardStops: true, smoothEnabled: true }))
      .toBe('Turrell · 5 colors · Hard')
  })

  it('combines repeat with an ink effect', () => {
    expect(describeGradient({ ...base, repeatEnabled: true, smoothEnabled: true }))
      .toBe('Turrell · 5 colors · ×2 · Smooth')
  })

  it('labels every selectable shape', () => {
    const labels: Record<string, string> = {
      linear: 'Linear', radial: 'Radial', angular: 'Angular',
      square: 'Turrell', mirror: 'Mirror', fan: 'Fan',
    }
    for (const [type, label] of Object.entries(labels)) {
      expect(describeGradient({ ...base, type: type as Gradient['type'] })).toBe(`${label} · 5 colors`)
    }
  })
})
