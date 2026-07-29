import { describe, it, expect } from 'vitest'
import { gradientCssSnippet } from './cssSnippet'
import type { Gradient } from '../store/types'

const stops = [
  { hex: '#ff0000', position: 0 },
  { hex: '#0000ff', position: 100 },
]

function make(overrides: Partial<Gradient> = {}): Gradient {
  return { id: 'g', type: 'linear', stops, reversed: false, ...overrides }
}

describe('gradientCssSnippet', () => {
  it('emits a pasteable declaration', () => {
    const css = gradientCssSnippet(make(), stops)
    expect(css.startsWith('background-image: linear-gradient(')).toBe(true)
    expect(css.endsWith(';')).toBe(true)
    expect(css).toContain('#ff0000 0%')
    expect(css).toContain('#0000ff 100%')
  })

  it('carries the gradient modifiers through', () => {
    expect(gradientCssSnippet(make({ reversed: true }), stops)).toContain('#0000ff 0%')
    expect(gradientCssSnippet(make({ type: 'radial' }), stops)).toContain('radial-gradient(')
    expect(gradientCssSnippet(make({ type: 'angular' }), stops)).toContain('conic-gradient(')
  })

  it('labels the Turrell square as an approximation instead of lying', () => {
    // Turrell renders as a stack of blurred elements; no single CSS value
    // reproduces it, so the snippet says so rather than handing over a
    // conic-gradient that looks nothing like what is on screen.
    const css = gradientCssSnippet(make({ type: 'square' }), stops)
    expect(css).toContain('/*')
    expect(css).toContain('closest')
    expect(css).toContain('background-image: radial-gradient(')
  })
})
