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

  it('square: last stop (innermost layer) anchors at the center, first walks to the edge', () => {
    // TurrellSquare nests by position — higher position renders innermost.
    expect(stopAnchor('square', [0, 100], 1)).toEqual({ x: 0.5, y: 0.5 })
    expect(stopAnchor('square', [0, 100], 0)).toEqual({ x: 0.5, y: 0 })
  })

  it('square: honors all four spokes for the outermost stop (p=0)', () => {
    expect(stopAnchor('square', [0], 0, { spoke: 'up' })).toEqual({ x: 0.5, y: 0 })
    expect(stopAnchor('square', [0], 0, { spoke: 'down' })).toEqual({ x: 0.5, y: 1 })
    expect(stopAnchor('square', [0], 0, { spoke: 'left' })).toEqual({ x: 0, y: 0.5 })
    expect(stopAnchor('square', [0], 0, { spoke: 'right' })).toEqual({ x: 1, y: 0.5 })
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
