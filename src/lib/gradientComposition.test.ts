import { describe, it, expect } from 'vitest'
import {
  orderByHueWalk,
  spacingBufferNeutral,
  spacingDominantBand,
  mirrorStops,
} from './gradientComposition'
import type { GradientStop } from './gradient'

// #000 darkest, #fff lightest, #808080 mid-gray. Positions held fixed by
// the ordering functions, so we assert on which HEX ends up where.
const stops: GradientStop[] = [
  { hex: '#000000', position: 0 },
  { hex: '#ffffff', position: 25 },
  { hex: '#808080', position: 50 },
  { hex: '#404040', position: 75 },
  { hex: '#c0c0c0', position: 100 },
]

describe('orderByHueWalk', () => {
  it('keeps the same set of hexes and positions', () => {
    const hueStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#00ff00', position: 33 },
      { hex: '#0000ff', position: 67 },
      { hex: '#ff8800', position: 100 },
    ]
    const result = orderByHueWalk(hueStops)
    expect(result.map((s) => s.position)).toEqual(hueStops.map((s) => s.position))
    expect(result.map((s) => s.hex).sort()).toEqual(hueStops.map((s) => s.hex).sort())
  })
})

describe('spacingBufferNeutral', () => {
  it('keeps hex order, widens the gaps around the lowest-chroma stop', () => {
    const chromaStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#888888', position: 33 }, // lowest chroma (near-gray)
      { hex: '#0000ff', position: 67 },
      { hex: '#00ff00', position: 100 },
    ]
    const result = spacingBufferNeutral(chromaStops)
    expect(result.map((s) => s.hex)).toEqual(chromaStops.map((s) => s.hex))
    expect(result[0].position).toBe(0)
    expect(result[result.length - 1].position).toBe(100)
    const gapBefore = result[1].position - result[0].position
    const gapAfter = result[2].position - result[1].position
    const originalGap = chromaStops[2].position - chromaStops[0].position
    expect(gapBefore + gapAfter).toBeGreaterThan(originalGap * 0.9) // widened, not shrunk
  })

  it('is a no-op below 3 stops', () => {
    const two = stops.slice(0, 2)
    expect(spacingBufferNeutral(two)).toEqual(two)
  })
})

describe('spacingDominantBand', () => {
  it('keeps hex order, widens the gaps around the lightest stop', () => {
    const result = spacingDominantBand(stops)
    expect(result.map((s) => s.hex)).toEqual([...stops].sort((a, b) => a.position - b.position).map((s) => s.hex))
    expect(result[0].position).toBe(0)
    expect(result[result.length - 1].position).toBe(100)
  })

  it('is a no-op below 3 stops', () => {
    const two = stops.slice(0, 2)
    expect(spacingDominantBand(two)).toEqual(two)
  })
})

describe('mirrorStops', () => {
  it('builds a palindrome from the first half, spread across 0-100', () => {
    const odd: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#00ff00', position: 50 },
      { hex: '#0000ff', position: 100 },
    ]
    const result = mirrorStops(odd)
    expect(result.map((s) => s.hex)).toEqual(['#ff0000', '#00ff00', '#ff0000'])
    expect(result[0].position).toBe(0)
    expect(result[result.length - 1].position).toBe(100)
  })

  it('is a no-op below 3 stops', () => {
    const two = stops.slice(0, 2)
    expect(mirrorStops(two)).toEqual(two)
  })
})
