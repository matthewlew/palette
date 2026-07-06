import { describe, it, expect } from 'vitest'
import { buildGradientCss, type GradientStop } from './gradient'
import { blendOklchHex, hexToOklch } from './oklch'

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

describe('buildGradientCss reversed flag', () => {
  it('reverses stop order when reversed=true, for a type that is otherwise order-sensitive', () => {
    const forward = buildGradientCss('linear', stops, false)
    const reversed = buildGradientCss('linear', stops, true)
    expect(forward).toBe('linear-gradient(180deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
    expect(reversed).toBe('linear-gradient(180deg, #0000ff 0%, #00ff00 50%, #ff0000 100%)')
  })

  it('defaults to reversed=false when the third argument is omitted', () => {
    expect(buildGradientCss('linear', stops)).toBe(buildGradientCss('linear', stops, false))
  })
})

describe('buildGradientCss mirror type', () => {
  it('builds a true palindrome (A,B,C,B,A) without duplicating the midpoint stop', () => {
    const css = buildGradientCss('mirror', stops)
    // 3 input stops -> mirrored to 5: A, B, C, B, A. A true reflection starts
    // AND ends at the same color (A); C is the single axis of symmetry in the
    // middle, not at either end.
    expect(css).toContain('linear-gradient(180deg,')
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(5)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[2]).toBe('#0000ff 50%')
    expect(matches[4]).toBe('#ff0000 100%')
  })

  it('respects the reversed flag for mirror type', () => {
    const forward = buildGradientCss('mirror', stops, false)
    const reversed = buildGradientCss('mirror', stops, true)
    expect(forward).not.toBe(reversed)
  })
})

describe('buildGradientCss repeat type', () => {
  it('builds a linear-gradient that repeats the stop sequence twice with a blended seam', () => {
    const css = buildGradientCss('repeat', stops)
    expect(css).toContain('linear-gradient(180deg,')
    // 3 stops repeated with one inserted seam stop = 7 total stops.
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(7)
    // The sequence is [A,B,C,seam,A,B,C], so the very first and very last
    // stops are both the original last color's repeat-cycle bookends: the
    // first stop is A (#ff0000) and the last stop is C (#0000ff) — the
    // second full pass through the same 3 colors.
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[6]).toBe('#0000ff 100%')
  })

  it('inserts a seam color that is an OKLCH blend of the last and first colors', () => {
    const css = buildGradientCss('repeat', stops)
    const matches = css.match(/#[0-9a-f]{6}/g)!
    const seamHex = matches[3] // index 3 of 7 stops is the middle/seam stop
    const expectedSeam = blendOklchHex('#0000ff', '#ff0000', 0.5)
    // Compare lightness rather than exact hex, since rounding can differ by 1.
    expect(Math.abs(hexToOklch(seamHex).l - hexToOklch(expectedSeam).l)).toBeLessThan(0.02)
  })
})
