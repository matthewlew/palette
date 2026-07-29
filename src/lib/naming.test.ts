import { describe, it, expect } from 'vitest'
import { namePalette } from './naming'

describe('namePalette', () => {
  it('is deterministic for the same hex list', () => {
    const hexes = ['#ff0000', '#0000ff', '#ffff00']
    expect(namePalette(hexes)).toBe(namePalette(hexes))
  })

  it('produces a different name for a different palette', () => {
    const nameA = namePalette(['#ff0000', '#0000ff'])
    const nameB = namePalette(['#00ff00', '#ff00ff'])
    expect(nameA).not.toBe(nameB)
  })

  it('never repeats the same word twice in one name', () => {
    for (let i = 0; i < 50; i++) {
      const hexes = [
        `#${((i * 37) % 256).toString(16).padStart(2, '0')}aabb`,
        `#${((i * 91) % 256).toString(16).padStart(2, '0')}ccdd`,
      ]
      const words = namePalette(hexes).split(' ')
      expect(new Set(words).size).toBe(words.length)
    }
  })

  it('returns 2 or 3 words for 200 random-ish palettes and never throws', () => {
    for (let i = 0; i < 200; i++) {
      const hexes = [1, 2, 3].map(
        (n) => `#${(((i + 1) * n * 53) % 16777216).toString(16).padStart(6, '0')}`
      )
      const name = namePalette(hexes)
      const wordCount = name.split(' ').filter(Boolean).length
      expect(wordCount).toBeGreaterThanOrEqual(2)
      expect(wordCount).toBeLessThanOrEqual(3)
    }
  })

  it('throws on an empty hex list', () => {
    expect(() => namePalette([])).toThrow()
  })

  it('avoids names already taken', () => {
    const hexes = ['#ff0000', '#0000ff', '#ffff00']
    const first = namePalette(hexes)
    const second = namePalette(hexes, { taken: [first] })
    expect(second).not.toBe(first)
    // Case-insensitive: a hand-renamed palette shouldn't collide on casing.
    const third = namePalette(hexes, { taken: [first.toUpperCase(), second] })
    expect(third).not.toBe(first)
    expect(third).not.toBe(second)
  })

  it('leaves an uncollided name exactly as it was', () => {
    // Share links and stored rows depend on a palette naming itself the same
    // way whether or not a board was passed in.
    const hexes = ['#123456', '#abcdef']
    expect(namePalette(hexes, { taken: ['Something Else'] })).toBe(namePalette(hexes))
  })

  it('keeps names distinct across a board-sized run of palettes', () => {
    const taken: string[] = []
    for (let i = 0; i < 120; i++) {
      const hexes = [1, 2, 3].map(
        (n) => `#${(((i + 7) * n * 2654435 + n * 91) % 16777216).toString(16).padStart(6, '0')}`
      )
      taken.push(namePalette(hexes, { taken }))
    }
    expect(new Set(taken).size).toBe(taken.length)
  })
})
