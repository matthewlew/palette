import { describe, it, expect } from 'vitest'
import { parseQuery, shapeVocabulary } from './shapeSearch'

describe('parseQuery', () => {
  it('recognises the shape names as the user knows them', () => {
    // The exact words from the report that returned nothing.
    expect(parseQuery('radial').shapes).toEqual(['radial'])
    expect(parseQuery('linear').shapes).toEqual(['linear'])
    expect(parseQuery('lines').shapes).toEqual(['linear'])
    expect(parseQuery('mirror').shapes).toEqual(['mirror'])
    expect(parseQuery('circular').shapes).toEqual(['radial'])
  })

  it('maps the shapes to what people call them, not to internal names', () => {
    // 'square' is Turrell in the UI, so both must work.
    expect(parseQuery('turrell').shapes).toEqual(['square'])
    expect(parseQuery('blocks').shapes).toEqual(['square'])
    expect(parseQuery('conic').shapes).toEqual(['angular'])
    expect(parseQuery('rays').shapes).toEqual(['fan'])
  })

  it('separates shape words from the rest of the query', () => {
    expect(parseQuery('warm radial')).toEqual({ shapes: ['radial'], terms: ['warm'] })
    expect(parseQuery('clay')).toEqual({ shapes: [], terms: ['clay'] })
  })

  it('dedupes synonyms of the same shape', () => {
    expect(parseQuery('radial circular round').shapes).toEqual(['radial'])
  })

  it('keeps several distinct shapes, to be treated as OR', () => {
    // A gradient has exactly one shape, so requiring both could only ever
    // return nothing.
    expect(parseQuery('lines mirror').shapes).toEqual(['linear', 'mirror'])
  })

  it('is case and whitespace insensitive', () => {
    expect(parseQuery('  RADIAL   Warm ')).toEqual({ shapes: ['radial'], terms: ['warm'] })
  })

  it('returns nothing for an empty query', () => {
    expect(parseQuery('')).toEqual({ shapes: [], terms: [] })
    expect(parseQuery('   ')).toEqual({ shapes: [], terms: [] })
  })

  it('never maps a word to the unreachable repeat geometry', () => {
    // 'repeat' is no longer user-selectable, so offering it as a search term
    // would surface only legacy rows.
    expect(shapeVocabulary().some((w) => parseQuery(w).shapes.includes('repeat'))).toBe(false)
  })

  it('has no word claimed by two shapes', () => {
    // A duplicate would silently resolve to whichever shape was declared last.
    const words = shapeVocabulary()
    expect(new Set(words).size).toBe(words.length)
  })
})
