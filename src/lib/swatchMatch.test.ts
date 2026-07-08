import { describe, it, expect } from 'vitest'
import { selectedSwatchHexes } from './swatchMatch'
import { oklchToHex } from './oklch'
import type { ColorSet } from './colorSets'

const colorSet: ColorSet = {
  name: 'test-set',
  colors: [
    { name: 'Clay', value: { l: 0.42, c: 0.09, h: 35 } },
    { name: 'Teal', value: { l: 0.55, c: 0.09, h: 190 } },
  ],
}

describe('selectedSwatchHexes', () => {
  it('matches an exact hex to its own swatch', () => {
    const clayHex = oklchToHex(colorSet.colors[0].value)
    const result = selectedSwatchHexes([clayHex], colorSet)
    expect(result.has(clayHex)).toBe(true)
    expect(result.size).toBe(1)
  })

  it('matches a slightly jittered color (within tolerance) to its nearest swatch', () => {
    // Simulates palette.ts's jitter(): l ±0.05, c ±0.02, h ±10
    const jittered = oklchToHex({ l: 0.42 + 0.03, c: 0.09 - 0.01, h: 35 + 6 })
    const clayHex = oklchToHex(colorSet.colors[0].value)
    const result = selectedSwatchHexes([jittered], colorSet)
    expect(result.has(clayHex)).toBe(true)
  })

  it('does not match a color that is far outside tolerance from every swatch', () => {
    const unrelated = oklchToHex({ l: 0.9, c: 0.3, h: 300 })
    const result = selectedSwatchHexes([unrelated], colorSet)
    expect(result.size).toBe(0)
  })

  it('returns an empty set for an empty input array', () => {
    expect(selectedSwatchHexes([], colorSet).size).toBe(0)
  })
})
