import { describe, it, expect } from 'vitest'
import { verticalInsertionIndex, wheelInsertionIndex } from './insertionIndex'

describe('verticalInsertionIndex', () => {
  const midpoints = [50, 150, 250] // 3 blocks, each 100px tall, midpoints at 50/150/250

  it('returns 0 when the pointer is above the first midpoint', () => {
    expect(verticalInsertionIndex(10, midpoints)).toBe(0)
  })

  it('returns an index between blocks when the pointer is between their midpoints', () => {
    expect(verticalInsertionIndex(160, midpoints)).toBe(2)
  })

  it('returns the block count when the pointer is below the last midpoint', () => {
    expect(verticalInsertionIndex(300, midpoints)).toBe(3)
  })
})

describe('wheelInsertionIndex', () => {
  it('maps an angle to the nearest wedge boundary index', () => {
    // 4 wedges -> boundaries every 90deg at 0/90/180/270/360
    expect(wheelInsertionIndex(10, 4)).toBe(0)
    expect(wheelInsertionIndex(100, 4)).toBe(1)
    expect(wheelInsertionIndex(179, 4)).toBe(2)
    expect(wheelInsertionIndex(359, 4)).toBe(0)
  })

  it('normalizes negative angles', () => {
    expect(wheelInsertionIndex(-10, 4)).toBe(0)
  })
})
