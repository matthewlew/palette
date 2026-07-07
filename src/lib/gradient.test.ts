import { describe, it, expect } from 'vitest'
import { buildGradientCss, type GradientStop } from './gradient'

const stops: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#00ff00', position: 50 },
  { hex: '#0000ff', position: 100 },
]

describe('buildGradientCss', () => {
  it('builds a linear-gradient string', () => {
    const css = buildGradientCss('linear', stops)
    expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a radial-gradient string', () => {
    const css = buildGradientCss('radial', stops)
    expect(css).toBe('radial-gradient(circle, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a conic-gradient string for angular type', () => {
    const css = buildGradientCss('angular', stops)
    expect(css).toBe('conic-gradient(#ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a nested conic-gradient with hard stops sized to the stop count for square type', () => {
    const css = buildGradientCss('square', stops)
    expect(css).toContain('conic-gradient(from 0deg')
    expect(css).toContain('#ff0000 0deg 120deg')
    expect(css).toContain('#00ff00 120deg 240deg')
    expect(css).toContain('#0000ff 240deg 360deg')
  })

  it('supports a variable number of stops for square type (e.g. 6 stops -> 60deg wedges)', () => {
    const sixStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#ff9900', position: 20 },
      { hex: '#00ff00', position: 40 },
      { hex: '#00ffff', position: 60 },
      { hex: '#0000ff', position: 80 },
      { hex: '#ff00ff', position: 100 },
    ]
    const css = buildGradientCss('square', sixStops)
    expect(css).toContain('#ff0000 0deg 60deg')
    expect(css).toContain('#ff9900 60deg 120deg')
    expect(css).toContain('#00ff00 120deg 180deg')
    expect(css).toContain('#00ffff 180deg 240deg')
    expect(css).toContain('#0000ff 240deg 300deg')
    expect(css).toContain('#ff00ff 300deg 360deg')
  })

  it('throws for fewer than 2 stops', () => {
    expect(() => buildGradientCss('linear', [stops[0]])).toThrow()
  })
})
