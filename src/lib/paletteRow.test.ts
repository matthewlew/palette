import { describe, it, expect } from 'vitest'
import { toGradient, isRenderableRow, paletteDna, type PaletteRow } from './paletteRow'
import { buildGradientCss } from './gradient'
import { namePalette } from './naming'

function row(patch: Partial<PaletteRow> = {}): PaletteRow {
  return {
    id: 'r1',
    display_name: 'Row One',
    colors: ['#ff0000', '#0000ff'],
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: '2026-01-01T00:00:00.000Z',
    likes: 3,
    ...patch,
  }
}

describe('isRenderableRow', () => {
  it('accepts an ordinary two-colour row', () => {
    expect(isRenderableRow(row())).toBe(true)
  })

  it('accepts short-form hexes', () => {
    expect(isRenderableRow(row({ colors: ['#f00', '#00f'] }))).toBe(true)
  })

  it('rejects a single colour — a gradient needs two ends', () => {
    expect(isRenderableRow(row({ colors: ['#ff0000'] }))).toBe(false)
  })

  it('rejects no colours', () => {
    expect(isRenderableRow(row({ colors: [] }))).toBe(false)
  })

  it('rejects a null colours column', () => {
    expect(isRenderableRow(row({ colors: null as unknown as string[] }))).toBe(false)
  })

  it('rejects colours stored as a JSON string rather than an array', () => {
    expect(isRenderableRow(row({ colors: '["#ff0000","#0000ff"]' as unknown as string[] }))).toBe(false)
  })

  it('rejects an unparseable hex', () => {
    expect(isRenderableRow(row({ colors: ['not-a-hex', '#0000ff'] }))).toBe(false)
    expect(isRenderableRow(row({ colors: ['#ff0000', 'rgb(0,0,255)'] }))).toBe(false)
    expect(isRenderableRow(row({ colors: ['#ff00', '#0000ff'] }))).toBe(false)
  })

  it('rejects a non-string in the colours array', () => {
    expect(isRenderableRow(row({ colors: [null, '#0000ff'] as unknown as string[] }))).toBe(false)
  })
})

describe('toGradient', () => {
  it('maps a good row, carrying the like count', () => {
    const g = toGradient(row())!
    expect(g.id).toBe('r1')
    expect(g.name).toBe('Row One')
    expect(g.type).toBe('linear')
    expect(g.likeCount).toBe(3)
    expect(g.stops.map((s) => s.position)).toEqual([0, 100])
  })

  it('defaults the like count to 0 when the column is absent', () => {
    // What every row looks like until migration 0002 is applied.
    const { likes: _likes, ...withoutLikes } = row()
    expect(toGradient(withoutLikes as PaletteRow)!.likeCount).toBe(0)
  })

  it('honours persisted offsets, and spaces evenly without them', () => {
    expect(toGradient(row({ colors: ['#f00', '#0f0', '#00f'] }))!.stops.map((s) => s.position))
      .toEqual([0, 50, 100])
    expect(toGradient(row({ colors: ['#f00', '#0f0', '#00f'], offsets: [0, 10, 100] }))!.stops.map((s) => s.position))
      .toEqual([0, 10, 100])
  })

  it('trims surrounding whitespace off a hex', () => {
    expect(toGradient(row({ colors: [' #ff0000 ', '#0000ff'] }))!.stops[0].hex).toBe('#ff0000')
  })

  it('returns null for every row that cannot be drawn', () => {
    expect(toGradient(row({ colors: ['#ff0000'] }))).toBeNull()
    expect(toGradient(row({ colors: [] }))).toBeNull()
    expect(toGradient(row({ colors: ['nope', '#0000ff'] }))).toBeNull()
  })
})

describe('what a rejected row would have done', () => {
  // These are the three throws that blanked the app. Paging the community feed
  // made rows past the 50th reachable for the first time, so a malformed row
  // deep in the table went from invisible to fatal.
  it('one colour throws in the gradient builder', () => {
    expect(() => buildGradientCss('linear', [{ hex: '#ff0000', position: 0 }])).toThrow(
      /at least 2 stops/
    )
  })

  it('no colours throws in the namer', () => {
    expect(() => namePalette([])).toThrow()
  })

  it('and every one of them is filtered out before it can', () => {
    const rows = [
      row({ id: 'good' }),
      row({ id: 'single', colors: ['#ff0000'] }),
      row({ id: 'empty', colors: [] }),
      row({ id: 'bad-hex', colors: ['zzz', '#0000ff'] }),
      row({ id: 'good2', colors: ['#00ff00', '#000000'] }),
    ]
    const kept = rows.map(toGradient).filter((g) => g !== null)
    expect(kept.map((g) => g!.id)).toEqual(['good', 'good2'])
    // And the survivors really do render.
    for (const g of kept) {
      expect(() => buildGradientCss(g!.type, g!.stops)).not.toThrow()
      expect(() => namePalette(g!.stops.map((s) => s.hex))).not.toThrow()
    }
  })
})

describe('paletteDna', () => {
  it('treats the same colours in the same shape as the same palette', () => {
    expect(paletteDna(toGradient(row({ id: 'a' }))!)).toBe(paletteDna(toGradient(row({ id: 'b' }))!))
  })

  it('separates the same colours in a different shape', () => {
    expect(paletteDna(toGradient(row())!)).not.toBe(paletteDna(toGradient(row({ shape: 'radial' }))!))
  })
})
