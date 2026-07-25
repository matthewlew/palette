import { describe, it, expect } from 'vitest'
import { nearestAnchorIndex, anchorWithinThreshold } from './canvasReorder'

const anchors = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

describe('nearestAnchorIndex', () => {
  it('returns the index of the closest anchor to the cursor', () => {
    expect(nearestAnchorIndex(anchors, { x: 5, y: 5 })).toBe(0)
    expect(nearestAnchorIndex(anchors, { x: 90, y: 5 })).toBe(1)
    expect(nearestAnchorIndex(anchors, { x: 95, y: 95 })).toBe(2)
  })

  it('picks the nearest even when the cursor is far from every anchor', () => {
    expect(nearestAnchorIndex(anchors, { x: 1000, y: 1000 })).toBe(2)
  })
})

describe('anchorWithinThreshold', () => {
  it('returns the nearest index when within the pixel threshold', () => {
    expect(anchorWithinThreshold(anchors, { x: 10, y: 0 }, 24)).toBe(0)
  })

  it('returns null when the nearest anchor exceeds the threshold', () => {
    expect(anchorWithinThreshold(anchors, { x: 50, y: 50 }, 24)).toBeNull()
  })

  it('returns null for an empty anchor list', () => {
    expect(anchorWithinThreshold([], { x: 0, y: 0 }, 24)).toBeNull()
  })
})
