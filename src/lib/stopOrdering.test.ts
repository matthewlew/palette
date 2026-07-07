import { describe, it, expect } from 'vitest'
import { toEditableStops, equalizePositions, removeStopAt, addStop, removeLastByHex } from './stopOrdering'
import type { GradientStop } from './gradient'

describe('toEditableStops', () => {
  it('assigns a unique id to each stop and preserves hex order', () => {
    const stops: GradientStop[] = [
      { hex: '#111111', position: 0 },
      { hex: '#222222', position: 100 },
    ]
    const editable = toEditableStops(stops)
    expect(editable.map((s) => s.hex)).toEqual(['#111111', '#222222'])
    expect(editable[0].id).not.toBe(editable[1].id)
    expect(editable[0].id).toBeTruthy()
  })
})

describe('equalizePositions', () => {
  it('spreads 4 stops evenly across 0-100', () => {
    const editable = [
      { id: 'a', hex: '#111111' },
      { id: 'b', hex: '#222222' },
      { id: 'c', hex: '#333333' },
      { id: 'd', hex: '#444444' },
    ]
    const positioned = equalizePositions(editable)
    expect(positioned.map((s) => s.position)).toEqual([0, 33, 67, 100])
  })

  it('handles a single stop without dividing by zero', () => {
    const positioned = equalizePositions([{ id: 'a', hex: '#111111' }])
    expect(positioned).toEqual([{ hex: '#111111', position: 0 }])
  })
})

describe('removeStopAt', () => {
  it('removes the stop with the matching id and leaves the rest in order', () => {
    const editable = [
      { id: 'a', hex: '#111111' },
      { id: 'b', hex: '#222222' },
      { id: 'c', hex: '#333333' },
    ]
    const result = removeStopAt(editable, 'b')
    expect(result.map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('addStop', () => {
  it('appends a new stop with the given hex and a fresh id at the end', () => {
    const editable = [{ id: 'a', hex: '#111111' }]
    const result = addStop(editable, '#999999')
    expect(result).toHaveLength(2)
    expect(result[1].hex).toBe('#999999')
    expect(result[1].id).not.toBe('a')
  })
})

describe('removeLastByHex', () => {
  it('removes the last stop matching the given hex, leaving earlier ones', () => {
    const editable = [
      { id: 'a', hex: '#111111' },
      { id: 'b', hex: '#222222' },
      { id: 'c', hex: '#111111' },
    ]
    const result = removeLastByHex(editable, '#111111')
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('is a no-op when the hex is not present', () => {
    const editable = [
      { id: 'a', hex: '#111111' },
      { id: 'b', hex: '#222222' },
    ]
    expect(removeLastByHex(editable, '#999999')).toEqual(editable)
  })
})
