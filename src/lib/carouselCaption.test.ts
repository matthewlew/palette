import { describe, it, expect } from 'vitest'
import { buildCaption, captionParts, CAPTION_MAX } from './carouselCaption'
import type { Gradient } from '../store/types'
import type { GradientType } from './gradient'

function makeGradient(
  id: string,
  hexes: string[],
  type: GradientType = 'linear',
  extra: Partial<Gradient> = {}
): Gradient {
  return {
    id,
    type,
    stops: hexes.map((hex, i) => ({
      hex,
      position: hexes.length === 1 ? 0 : Math.round((i / (hexes.length - 1)) * 100),
    })),
    ...extra,
  }
}

const A = makeGradient('a', ['#112233', '#445566'], 'linear', { name: 'Quiet Ember' })
const B = makeGradient('b', ['#aabbcc', '#ddeeff'], 'square', { name: 'Low Tide' })

describe('captionParts', () => {
  it('numbers entries from 1 in pick order', () => {
    const { entries } = captionParts([A, B])
    expect(entries.map((e) => e.position)).toEqual([1, 2])
    expect(entries.map((e) => e.name)).toEqual(['Quiet Ember', 'Low Tide'])
  })

  it('uppercases hexes and orders them by stop position', () => {
    const g = makeGradient('c', [], 'linear')
    g.stops = [
      { hex: '#ff0000', position: 80 },
      { hex: '#00ff00', position: 10 },
    ]
    expect(captionParts([g]).entries[0].hexes).toEqual(['#00FF00', '#FF0000'])
  })

  it('lists hexes in render order for a reversed gradient', () => {
    const reversed = makeGradient('d', ['#111111', '#222222'], 'linear', { reversed: true })
    expect(captionParts([reversed]).entries[0].hexes).toEqual(['#222222', '#111111'])
  })

  it('falls back to a generated name when the gradient has none', () => {
    const unnamed = makeGradient('e', ['#123456', '#654321'])
    expect(captionParts([unnamed]).entries[0].name).toBeTruthy()
  })

  it('titles a single-shape set by that shape', () => {
    expect(captionParts([A, makeGradient('f', ['#000000', '#ffffff'])]).title).toBe(
      '2 Linear Gradients'
    )
  })

  it('titles a mixed-shape set as Mixed', () => {
    expect(captionParts([A, B]).title).toBe('2 Mixed Gradients')
  })

  it('prefers an explicit title and ignores a blank one', () => {
    expect(captionParts([A, B], { title: 'Coastline' }).title).toBe('Coastline')
    expect(captionParts([A, B], { title: '   ' }).title).toBe('2 Mixed Gradients')
  })

  it('adds shape-specific hashtags without duplicating them', () => {
    const tags = captionParts([B, B]).hashtags
    expect(tags).toContain('jamesturrell')
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('drops hashtags when asked', () => {
    expect(captionParts([A], { hashtags: false }).hashtags).toEqual([])
  })
})

describe('buildCaption', () => {
  it('is empty for no picks', () => {
    expect(buildCaption([])).toBe('')
  })

  it('leads with the title and lists every pick in order', () => {
    const caption = buildCaption([A, B])
    const lines = caption.split('\n')
    expect(lines[0]).toBe('2 Mixed Gradients')
    expect(caption).toContain('1. Quiet Ember — #112233 · #445566')
    expect(caption).toContain('2. Low Tide — #AABBCC · #DDEEFF')
  })

  it('includes the note between the entries and the hashtags', () => {
    const caption = buildCaption([A], { note: 'Made on a train.' })
    expect(caption.indexOf('Made on a train.')).toBeGreaterThan(caption.indexOf('1. Quiet Ember'))
    expect(caption.indexOf('Made on a train.')).toBeLessThan(caption.indexOf('#gradient'))
  })

  it('is deterministic for the same picks', () => {
    expect(buildCaption([A, B])).toBe(buildCaption([A, B]))
  })

  it('reflects pick order, not gradient identity', () => {
    expect(buildCaption([A, B])).not.toBe(buildCaption([B, A]))
  })

  it('keeps the hashtags when truncating an over-long caption', () => {
    // A long enough set to blow the 2,200 character ceiling.
    const many = Array.from({ length: 400 }, (_, i) =>
      makeGradient(`g${i}`, ['#123456', '#abcdef'], 'linear', {
        name: `A Very Long Palette Name Number ${i}`,
      })
    )
    const caption = buildCaption(many)
    expect(caption.length).toBeLessThanOrEqual(CAPTION_MAX)
    expect(caption).toContain('#gradient')
    // Truncation lands on a line boundary, never mid-hex.
    const body = caption.split('\n\n#')[0]
    expect(body.endsWith('#ABCDEF')).toBe(true)
  })
})
