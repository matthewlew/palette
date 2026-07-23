import { describe, it, expect } from 'vitest'
import { stopAnchor } from './stopAnchor'

describe('stopAnchor', () => {
  it('linear: runs down the vertical axis', () => {
    expect(stopAnchor('linear', [0, 50, 100], 0)).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('linear', [0, 50, 100], 1)).toEqual({ x: 0.5, y: 0.5 })
    expect(stopAnchor('linear', [0, 50, 100], 2)).toEqual({ x: 0.5, y: 1 })
  })

  it('mirror: runs down the top half of the axis', () => {
    expect(stopAnchor('mirror', [0, 100], 0)).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('mirror', [0, 100], 1)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('radial: defaults to the up spoke, center to top edge', () => {
    expect(stopAnchor('radial', [0, 100], 0)).toEqual({ x: 0.5, y: 0.5 })
    expect(stopAnchor('radial', [0, 100], 1)).toEqual({ x: 0.5, y: 0 })
  })

  it('radial: honors all four spokes at p=1 (full extent)', () => {
    expect(stopAnchor('radial', [100], 0, { spoke: 'up' })).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('radial', [100], 0, { spoke: 'down' })).toEqual({ x: 0.5, y: 1 })
    expect(stopAnchor('radial', [100], 0, { spoke: 'left' })).toEqual({ x: 0, y: 0.5 })
    expect(stopAnchor('radial', [100], 0, { spoke: 'right' })).toEqual({ x: 1, y: 0.5 })
  })

  it('square: each stop anchors at the middle of its color ring along the spoke', () => {
    // TurrellSquare nests by position — higher position renders innermost.
    // Edges at half(p)=0.5-0.4p: outer ring [0.5,0.1] -> mid 0.3 -> y 0.2;
    // inner ring [0.1,0] -> mid 0.05 -> y 0.45.
    const outer = stopAnchor('square', [0, 100], 0)
    expect(outer.x).toBeCloseTo(0.5)
    expect(outer.y).toBeCloseTo(0.2)
    const inner = stopAnchor('square', [0, 100], 1)
    expect(inner.x).toBeCloseTo(0.5)
    expect(inner.y).toBeCloseTo(0.45)
  })

  it('square: honors all four spokes for a single stop (ring [0.5,0] -> mid 0.25)', () => {
    const up = stopAnchor('square', [0], 0, { spoke: 'up' })
    expect(up.x).toBeCloseTo(0.5); expect(up.y).toBeCloseTo(0.25)
    const down = stopAnchor('square', [0], 0, { spoke: 'down' })
    expect(down.x).toBeCloseTo(0.5); expect(down.y).toBeCloseTo(0.75)
    const left = stopAnchor('square', [0], 0, { spoke: 'left' })
    expect(left.x).toBeCloseTo(0.25); expect(left.y).toBeCloseTo(0.5)
    const right = stopAnchor('square', [0], 0, { spoke: 'right' })
    expect(right.x).toBeCloseTo(0.75); expect(right.y).toBeCloseTo(0.5)
  })

  it('angular: sits at mid-radius, sweeping clockwise from the top', () => {
    const top = stopAnchor('angular', [0], 0)
    expect(top.x).toBeCloseTo(0.5, 5)
    expect(top.y).toBeCloseTo(0.5 - 0.32, 5)
    const quarter = stopAnchor('angular', [25], 0)
    expect(quarter.x).toBeCloseTo(0.5 + 0.32, 5)
    expect(quarter.y).toBeCloseTo(0.5, 5)
  })

  it('angular: scales positions by count/(count+1) when count > 1 so first and last stops do not overlap at 0/360deg', () => {
    const lastOfFive = stopAnchor('angular', [0, 25, 50, 75, 100], 4)
    // p=1, scale=5/6 => theta = 300deg. sin(300deg) = -sqrt(3)/2, cos(300deg) = 0.5
    expect(lastOfFive.x).toBeCloseTo(0.5 + 0.32 * Math.sin((5 / 6) * 2 * Math.PI), 4)
    expect(lastOfFive.y).toBeCloseTo(0.5 - 0.32 * Math.cos((5 / 6) * 2 * Math.PI), 4)
  })

  it('fan: sits at mid-radius from the anchor pivot, sweeping the 180deg cone', () => {
    const start = stopAnchor('fan', [0], 0, { fanAnchor: 'bottom' })
    // bottom pivot is (0.5, 1); at p=0 the cone starts at 270deg (from FAN_ANCHOR_CONFIG).
    expect(start.x).toBeCloseTo(0.5 - 0.35, 4)
    expect(start.y).toBeCloseTo(1, 4)
  })
})
