import { describe, it, expect } from 'vitest'
import { INK_CATALOGUE, findInk } from './inkCatalogue'

describe('INK_CATALOGUE', () => {
  it('has a unique, non-empty name for every entry', () => {
    expect(INK_CATALOGUE.length).toBeGreaterThan(0)
    const names = INK_CATALOGUE.map((ink) => ink.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name.length).toBeGreaterThan(0)
  })

  it('has a valid #rrggbb hex for every entry', () => {
    for (const ink of INK_CATALOGUE) {
      expect(ink.hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('includes the three inks named in the PRD example', () => {
    expect(findInk('Fluorescent Pink')?.hex).toBe('#ff48b0')
    expect(findInk('Cornflower')?.hex).toBe('#62a8e5')
    expect(findInk('Yellow')?.hex).toBe('#ffe800')
  })
})

describe('findInk', () => {
  it('returns undefined for a name not in the catalogue', () => {
    expect(findInk('Not A Real Ink')).toBeUndefined()
  })
})
