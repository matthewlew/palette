import { describe, it, expect } from 'vitest'
import { sortByOklch, gradientMetric } from './sortColors'

// #ff0000 -> oklch(~0.628 0.258 29.2)  (high chroma, red hue, mid lightness)
// #00ff00 -> oklch(~0.866 0.295 142.5) (high lightness, green hue)
// #0000ff -> oklch(~0.452 0.313 264.1) (low lightness, blue hue, high chroma)
const red = '#ff0000'
const green = '#00ff00'
const blue = '#0000ff'

describe('sortByOklch', () => {
  it('sorts ascending by lightness', () => {
    const items = [{ hex: red }, { hex: green }, { hex: blue }]
    const sorted = sortByOklch(items, (i) => i.hex, 'lightness')
    expect(sorted.map((i) => i.hex)).toEqual([blue, red, green])
  })

  it('sorts ascending by hue', () => {
    const items = [{ hex: blue }, { hex: red }, { hex: green }]
    const sorted = sortByOklch(items, (i) => i.hex, 'hue')
    expect(sorted.map((i) => i.hex)).toEqual([red, green, blue])
  })

  it('sorts ascending by chroma', () => {
    const items = [{ hex: red }, { hex: green }, { hex: blue }]
    const sorted = sortByOklch(items, (i) => i.hex, 'chroma')
    expect(sorted.map((i) => i.hex)).toEqual([red, green, blue])
  })

  it('is stable for equal metrics', () => {
    const items = [
      { hex: red, tag: 'first' },
      { hex: red, tag: 'second' },
    ]
    const sorted = sortByOklch(items, (i) => i.hex, 'lightness')
    expect(sorted.map((i) => i.tag)).toEqual(['first', 'second'])
  })

  it('does not mutate the input array', () => {
    const items = [{ hex: green }, { hex: red }]
    const original = [...items]
    sortByOklch(items, (i) => i.hex, 'lightness')
    expect(items).toEqual(original)
  })
})

describe('gradientMetric', () => {
  it('averages the lightness metric across hexes', () => {
    const avg = gradientMetric([red, blue], 'lightness')
    // red l~0.628, blue l~0.452 -> avg ~0.54
    expect(avg).toBeGreaterThan(0.5)
    expect(avg).toBeLessThan(0.58)
  })

  it('returns 0 for an empty array', () => {
    expect(gradientMetric([], 'lightness')).toBe(0)
  })
})
