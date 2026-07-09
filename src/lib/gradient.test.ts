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

  it('builds a conic-gradient string for angular type that blends the seam back to the first color', () => {
    const css = buildGradientCss('angular', stops)
    // 3 stops (0%,50%,100%) compressed by 3/4 -> (0%,38%,75%), then the first
    // color repeated at 100% closes the seam instead of a hard 360deg->0deg cut.
    expect(css).toBe('conic-gradient(#ff0000 0%, #00ff00 38%, #0000ff 75%, #ff0000 100%)')
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

describe('buildGradientCss repeat filter', () => {
  it('cycles the stop sequence twice within 0-100 when filters.repeat is true', () => {
    const css = buildGradientCss('linear', stops, false, { repeat: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    // 3 stops doubled -> 6 evenly spaced stops (0/20/40/60/80/100), so the
    // hand-off from the last color back to the first blends over the same
    // step width as every other transition instead of cutting hard at 50.
    expect(matches).toHaveLength(6)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[2]).toBe('#0000ff 40%')
    expect(matches[3]).toBe('#ff0000 60%')
    expect(matches[5]).toBe('#0000ff 100%')
  })

  it('has no effect when filters.repeat is false/omitted', () => {
    expect(buildGradientCss('linear', stops, false, { repeat: false })).toBe(buildGradientCss('linear', stops))
  })

  it('is a no-op for square (already solid blocks) and mirror (builds its own sequence)', () => {
    expect(buildGradientCss('square', stops, false, { repeat: true })).toBe(buildGradientCss('square', stops))
    expect(buildGradientCss('mirror', stops, false, { repeat: true })).toBe(buildGradientCss('mirror', stops))
  })
})

describe('buildGradientCss hard filter', () => {
  it('renders each color as a band with a hard cut at the midpoint to its neighbor', () => {
    const css = buildGradientCss('linear', stops, false, { hard: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    // 3 stops -> 3 bands = 6 position markers (start/end pairs).
    expect(matches).toHaveLength(6)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[1]).toBe('#ff0000 25%')
    expect(matches[2]).toBe('#00ff00 25%')
    expect(matches[3]).toBe('#00ff00 75%')
    expect(matches[4]).toBe('#0000ff 75%')
    expect(matches[5]).toBe('#0000ff 100%')
  })

  it('combines with repeat: hardened bands, then cycled twice', () => {
    const css = buildGradientCss('linear', stops, false, { hard: true, repeat: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(12)
  })

  it('does not throw at the minimum valid stop count (2 stops)', () => {
    const twoStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ]
    const css = buildGradientCss('linear', twoStops, false, { hard: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toEqual(['#ff0000 0%', '#ff0000 50%', '#0000ff 50%', '#0000ff 100%'])
  })
})

describe('buildGradientCss repeat type (legacy dedicated type)', () => {
  it('builds a linear-gradient that repeats the stop sequence exactly twice', () => {
    const css = buildGradientCss('repeat', stops)
    expect(css).toContain('linear-gradient(180deg,')
    // 3 stops repeated twice, no synthetic seam stop = 6 total stops.
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(6)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[5]).toBe('#0000ff 100%')
  })

  it('contains only colors from the input palette (no invented seam hue)', () => {
    const css = buildGradientCss('repeat', stops)
    const matches = css.match(/#[0-9a-f]{6}/g)!
    const palette = new Set(stops.map((s) => s.hex))
    for (const hex of matches) {
      expect(palette.has(hex), `${hex} should be an input color`).toBe(true)
    }
  })
})

describe('buildGradientCss smooth filter', () => {
  it('inserts eased interior stops per segment, keeping the originals in place', () => {
    const css = buildGradientCss('linear', stops, false, { smooth: true })
    const matches = css.match(/#[0-9a-f]{6} [\d.]+%/g)!
    // 3 originals + 7 interior stops per segment x 2 segments = 17.
    expect(matches).toHaveLength(17)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[8]).toBe('#00ff00 50%')
    expect(matches[16]).toBe('#0000ff 100%')
  })

  it('eases within each segment: the quarter point sits closer to the segment start color than linear', () => {
    const twoStops = [
      { hex: '#000000', position: 0 },
      { hex: '#ffffff', position: 100 },
    ]
    const css = buildGradientCss('linear', twoStops, false, { smooth: true })
    const matches = css.match(/#[0-9a-f]{6} [\d.]+%/g)!
    // Interior stop at 25% (k=2 of 7): ease-in-out(0.25) ~ 0.156, so the
    // blended gray must be darker than the linear midpoint gray at 25%.
    const quarter = matches.find((m) => m.endsWith(' 25%'))!
    const channel = parseInt(quarter.slice(1, 3), 16)
    expect(channel).toBeLessThan(0.25 * 255)
  })

  it('is ignored when hard stops are on and for square type', () => {
    expect(buildGradientCss('linear', stops, false, { smooth: true, hard: true })).toBe(
      buildGradientCss('linear', stops, false, { hard: true })
    )
    expect(buildGradientCss('square', stops, false, { smooth: true })).toBe(buildGradientCss('square', stops))
  })
})
