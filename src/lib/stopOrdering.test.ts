import { describe, it, expect } from 'vitest'
import { toEditableStops, equalizePositions, removeStopAt, addStop, removeLastByHex, moveStop, toGradientStops } from './stopOrdering'
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
