import { describe, it, expect } from 'vitest'
import { composeStops, composeGradient, scoreComposition } from './keywordCompose'
import { scorePalette } from './paletteScore'
import { hexToOklch } from './oklch'
import type { KeywordBinding } from '../store/types'

const glacier: KeywordBinding = { id: 'g', keyword: 'glacier', colors: ['#005e6b', '#e3ecec'], shape: 'radial' }
const pine: KeywordBinding = { id: 'p', keyword: 'pine', colors: ['#142b1f', '#b3c4b8'] }

describe('composeStops', () => {
  it('concatenates colors in binding order, evenly spaced 0-100', () => {
    const stops = composeStops([glacier, pine])
    expect(stops.map((s) => s.hex)).toEqual(['#005e6b', '#e3ecec', '#142b1f', '#b3c4b8'])
    expect(stops.map((s) => s.position)).toEqual([0, 33, 67, 100])
  })
  it('reordering the bindings reorders the stops (word-matching sort drives it)', () => {
    const stops = composeStops([pine, glacier])
    expect(stops.map((s) => s.hex)).toEqual(['#142b1f', '#b3c4b8', '#005e6b', '#e3ecec'])
  })
})

describe('composeGradient', () => {
  it('uses the first binding shape, defaulting to linear', () => {
    expect(composeGradient([glacier, pine]).type).toBe('radial')
    expect(composeGradient([pine]).type).toBe('linear')
  })
})

describe('scoreComposition', () => {
  it('matches scorePalette on the equivalent OKLCH colors (reuse, not reimplementation)', () => {
    const bindings = [glacier, pine]
    const expected = scorePalette(composeStops(bindings).map((s) => hexToOklch(s.hex)))
    expect(scoreComposition(bindings)).toBe(expected)
  })
})
