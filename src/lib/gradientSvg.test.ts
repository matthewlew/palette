import { describe, it, expect } from 'vitest'
import { gradientToSvg } from './gradientSvg'
import type { Gradient } from '../store/types'

function grad(overrides: Partial<Gradient> = {}): Gradient {
  return {
    id: 'x',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
    ...overrides,
  }
}

describe('gradientToSvg', () => {
  it('emits a standalone svg with an xmlns and a rect fill referencing the gradient', () => {
    const svg = gradientToSvg(grad())
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(svg).toContain('<rect')
    expect(svg).toMatch(/fill="url\(#[^)]+\)"/)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('uses a linearGradient with vertical coordinates for linear', () => {
    const svg = gradientToSvg(grad({ type: 'linear' }))
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('x1="0"')
    expect(svg).toContain('y1="0"')
    expect(svg).toContain('x2="0"')
    expect(svg).toContain('y2="1"')
    expect(svg).toContain('stop-color="#ff0000"')
    expect(svg).toContain('offset="0%"')
    expect(svg).toContain('offset="100%"')
  })

  it('uses a radialGradient for radial', () => {
    const svg = gradientToSvg(grad({ type: 'radial' }))
    expect(svg).toContain('<radialGradient')
  })

  it('falls back to a linearGradient for conic types (angular/square/fan)', () => {
    for (const type of ['angular', 'square', 'fan'] as const) {
      const svg = gradientToSvg(grad({ type }))
      expect(svg).toContain('<linearGradient')
      expect(svg).not.toContain('<radialGradient')
    }
  })

  it('reverses stop order when reversed is set', () => {
    const svg = gradientToSvg(grad({ reversed: true }))
    const firstStopIdx = svg.indexOf('stop-color="#0000ff"')
    const secondStopIdx = svg.indexOf('stop-color="#ff0000"')
    expect(firstStopIdx).toBeGreaterThan(-1)
    expect(firstStopIdx).toBeLessThan(secondStopIdx)
  })

  it('preserves real stop positions when reversed (does not evenly re-space)', () => {
    // Colors at 0/20/100 reversed -> hexes swap but positions stay fixed.
    const svg = gradientToSvg(
      grad({
        reversed: true,
        stops: [
          { hex: '#ff0000', position: 0 },
          { hex: '#00ff00', position: 20 },
          { hex: '#0000ff', position: 100 },
        ],
      })
    )
    expect(svg).toContain('offset="0%" stop-color="#0000ff"')
    expect(svg).toContain('offset="20%" stop-color="#00ff00"')
    expect(svg).toContain('offset="100%" stop-color="#ff0000"')
  })

  it('honors hardStops by emitting duplicate-position band stops', () => {
    const svg = gradientToSvg(grad({ hardStops: true }))
    // hardenStops turns 2 smooth stops into 4 band stops (two per color).
    const stopCount = (svg.match(/<stop /g) ?? []).length
    expect(stopCount).toBe(4)
  })

  it('expands mirror into a palindrome stop sequence', () => {
    const svg = gradientToSvg(
      grad({
        type: 'mirror',
        stops: [
          { hex: '#ff0000', position: 0 },
          { hex: '#00ff00', position: 50 },
          { hex: '#0000ff', position: 100 },
        ],
      })
    )
    // [A,B,C] -> [A,B,C,B,A] = 5 stops.
    const stopCount = (svg.match(/<stop /g) ?? []).length
    expect(stopCount).toBe(5)
  })

  it('never throws for any gradient type', () => {
    for (const type of ['linear', 'radial', 'angular', 'square', 'mirror', 'repeat', 'fan'] as const) {
      expect(() => gradientToSvg(grad({ type }))).not.toThrow()
    }
  })
})
