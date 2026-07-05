import { describe, it, expect } from 'vitest'
import { buildGradientCss, type GradientStop, type GradientType } from './gradient'

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

  it('builds a nested conic-gradient with hard 90deg stops for square type', () => {
    const css = buildGradientCss('square', stops)
    expect(css).toContain('conic-gradient(from 0deg')
    expect(css).toContain('#ff0000 0deg 90deg')
    expect(css).toContain('#00ff00 90deg 180deg')
  })

  it('throws for fewer than 2 stops', () => {
    expect(() => buildGradientCss('linear', [stops[0]])).toThrow()
  })
})
