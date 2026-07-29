import { describe, it, expect } from 'vitest'
import {
  toEditableStops,
  equalizePositions,
  equalizeEditableStops,
  isEvenlyDistributed,
  reassignPositions,
  removeStopAt,
  addStop,
  removeLastByHex,
  moveStop,
  toGradientStops,
} from './stopOrdering'
import type { EditableStop } from './stopOrdering'
import type { GradientStop } from './gradient'

describe('toEditableStops', () => {
  it('assigns a unique id to each stop, preserves hex order, and copies position', () => {
    const stops: GradientStop[] = [
      { hex: '#111111', position: 0 },
      { hex: '#222222', position: 100 },
    ]
    const editable = toEditableStops(stops)
    expect(editable.map((s) => s.hex)).toEqual(['#111111', '#222222'])
    expect(editable.map((s) => s.position)).toEqual([0, 100])
    expect(editable[0].id).not.toBe(editable[1].id)
    expect(editable[0].id).toBeTruthy()
  })
})

describe('equalizePositions', () => {
  it('spreads 4 stops evenly across 0-100', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 0 },
      { id: 'c', hex: '#333333', position: 0 },
      { id: 'd', hex: '#444444', position: 0 },
    ]
    const positioned = equalizePositions(editable)
    expect(positioned.map((s) => s.position)).toEqual([0, 33, 67, 100])
  })

  it('handles a single stop without dividing by zero', () => {
    const positioned = equalizePositions([{ id: 'a', hex: '#111111', position: 0 }])
    expect(positioned).toEqual([{ hex: '#111111', position: 0 }])
  })
})

describe('removeStopAt', () => {
  it('removes the stop with the matching id and leaves the rest in order', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 50 },
      { id: 'c', hex: '#333333', position: 100 },
    ]
    const result = removeStopAt(editable, 'b')
    expect(result.map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('addStop', () => {
  it('appends a new stop with the given hex, a fresh id, and inserts at the largest gap midpoint', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 100 },
    ]
    const result = addStop(editable, '#999999')
    expect(result).toHaveLength(3)
    const added = result.find((s) => s.hex === '#999999')!
    expect(added.position).toBe(50)
    expect(added.id).not.toBe('a')
    expect(added.id).not.toBe('b')
  })

  it('inserts at the midpoint of the largest gap when gaps are uneven', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 10 },
      { id: 'c', hex: '#333333', position: 100 },
    ]
    const result = addStop(editable, '#999999')
    const added = result.find((s) => s.hex === '#999999')!
    // Largest gap is 10 -> 100 (width 90); midpoint = 55
    expect(added.position).toBe(55)
  })
})

describe('removeLastByHex', () => {
  it('removes the last stop matching the given hex, leaving earlier ones', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 50 },
      { id: 'c', hex: '#111111', position: 100 },
    ]
    const result = removeLastByHex(editable, '#111111')
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when the hex is not present', () => {
    const editable = [
      { id: 'a', hex: '#111111', position: 0 },
      { id: 'b', hex: '#222222', position: 100 },
    ]
    expect(removeLastByHex(editable, '#999999')).toEqual(editable)
  })
})

describe('moveStop', () => {
  const base = [
    { id: 'a', hex: '#111111', position: 0 },
    { id: 'b', hex: '#222222', position: 50 },
    { id: 'c', hex: '#333333', position: 100 },
  ]

  it('updates the position of the matching stop', () => {
    const result = moveStop(base, 'b', 75)
    expect(result.find((s) => s.id === 'b')!.position).toBe(75)
  })

  it('clamps position to [0, 100]', () => {
    expect(moveStop(base, 'a', -10).find((s) => s.id === 'a')!.position).toBe(0)
    expect(moveStop(base, 'c', 150).find((s) => s.id === 'c')!.position).toBe(100)
  })

  it('re-sorts stops by position, stably for ties', () => {
    const result = moveStop(base, 'c', 10)
    expect(result.map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not mutate the input array', () => {
    const original = base.map((s) => ({ ...s }))
    moveStop(base, 'b', 20)
    expect(base).toEqual(original)
  })
})

describe('toGradientStops', () => {
  it('maps {hex, position} straight through, sorted by position', () => {
    const editable = [
      { id: 'a', hex: '#333333', position: 100 },
      { id: 'b', hex: '#111111', position: 0 },
      { id: 'c', hex: '#222222', position: 50 },
    ]
    expect(toGradientStops(editable)).toEqual([
      { hex: '#111111', position: 0 },
      { hex: '#222222', position: 50 },
      { hex: '#333333', position: 100 },
    ])
  })

  it('round-trips positions from toEditableStops without change', () => {
    const original: GradientStop[] = [
      { hex: '#aaaaaa', position: 12 },
      { hex: '#bbbbbb', position: 88 },
    ]
    const roundTripped = toGradientStops(toEditableStops(original))
    expect(roundTripped).toEqual(original)
  })
})

describe('isEvenlyDistributed', () => {
  const at = (...positions: number[]): EditableStop[] =>
    positions.map((position, i) => ({ id: String(i), hex: '#000000', position }))

  it('accepts the ladder equalize produces, rounding and all', () => {
    // 7 stops round to 0/17/33/50/67/83/100 — half of those are already a
    // point off the exact fraction, which is why the check has a tolerance.
    for (const count of [2, 3, 4, 5, 6, 7, 8]) {
      const even = equalizeEditableStops(at(...Array.from({ length: count }, () => 0)))
      expect(isEvenlyDistributed(even)).toBe(true)
    }
  })

  it('rejects a hand-placed ladder', () => {
    expect(isEvenlyDistributed(at(0, 20, 60))).toBe(false)
    expect(isEvenlyDistributed(at(5, 40, 95))).toBe(false)
  })

  it('reads the SORTED ladder, so a reorder is not mistaken for customizing', () => {
    // Same three positions, colors re-paired to them by a sort.
    expect(isEvenlyDistributed(at(100, 0, 50))).toBe(true)
  })

  it('treats 0 and 1 stops as even — there is no spacing to be wrong about', () => {
    expect(isEvenlyDistributed([])).toBe(true)
    expect(isEvenlyDistributed(at(37))).toBe(true)
  })
})

describe('reassignPositions', () => {
  it('keeps the ladder and gives stop i the i-th step', () => {
    const stops: EditableStop[] = [
      { id: 'a', hex: '#aaaaaa', position: 95 },
      { id: 'b', hex: '#bbbbbb', position: 5 },
      { id: 'c', hex: '#cccccc', position: 40 },
    ]
    const next = reassignPositions(stops)
    expect(next.map((s) => s.position)).toEqual([5, 40, 95])
    // Array order — i.e. which color goes where — is untouched.
    expect(next.map((s) => s.hex)).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc'])
  })

  it('is equalize when the ladder was already even', () => {
    const even: EditableStop[] = [
      { id: 'a', hex: '#aaaaaa', position: 100 },
      { id: 'b', hex: '#bbbbbb', position: 0 },
      { id: 'c', hex: '#cccccc', position: 50 },
    ]
    expect(reassignPositions(even).map((s) => s.position)).toEqual([0, 50, 100])
  })
})

describe('equalizeEditableStops', () => {
  it('spreads evenly by array order while keeping ids', () => {
    const stops: EditableStop[] = [
      { id: 'a', hex: '#aaaaaa', position: 12 },
      { id: 'b', hex: '#bbbbbb', position: 13 },
      { id: 'c', hex: '#cccccc', position: 14 },
    ]
    expect(equalizeEditableStops(stops)).toEqual([
      { id: 'a', hex: '#aaaaaa', position: 0 },
      { id: 'b', hex: '#bbbbbb', position: 50 },
      { id: 'c', hex: '#cccccc', position: 100 },
    ])
  })

  it('agrees with equalizePositions', () => {
    const stops = toEditableStops([
      { hex: '#111111', position: 3 },
      { hex: '#222222', position: 9 },
      { hex: '#333333', position: 80 },
      { hex: '#444444', position: 81 },
    ])
    expect(equalizeEditableStops(stops).map((s) => ({ hex: s.hex, position: s.position }))).toEqual(
      equalizePositions(stops)
    )
  })
})
