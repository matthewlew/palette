import { describe, it, expect } from 'vitest'
import { dropRandomStop, reorderColors, varySpacing } from './gradientVoting'
import type { GradientStop } from './gradient'

const stops: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#00ff00', position: 33 },
  { hex: '#0000ff', position: 67 },
  { hex: '#ffff00', position: 100 },
]

describe('dropRandomStop', () => {
  it('removes exactly one stop, never the first or last', () => {
    const result = dropRandomStop(stops)
    expect(result.length).toBe(stops.length - 1)
    expect(result[0].hex).toBe('#ff0000')
    expect(result[result.length - 1].hex).toBe('#ffff00')
  })

  it('is a no-op at 2 stops (nothing interior to drop)', () => {
    const two = stops.slice(0, 2)
    expect(dropRandomStop(two)).toEqual(two)
  })
})

describe('reorderColors', () => {
  it('keeps the same set of hex values and positions, in a different order', () => {
    const result = reorderColors(stops)
    expect(result.map((s) => s.position)).toEqual(stops.map((s) => s.position))
    expect(result.map((s) => s.hex).sort()).toEqual(stops.map((s) => s.hex).sort())
    expect(result.map((s) => s.hex)).not.toEqual(stops.map((s) => s.hex))
  })

  it('is a no-op below 2 stops', () => {
    const one = stops.slice(0, 1)
    expect(reorderColors(one)).toEqual(one)
  })
})

describe('varySpacing', () => {
  it('keeps hex order and endpoint positions, changes interior spacing', () => {
    const result = varySpacing(stops)
    expect(result.map((s) => s.hex)).toEqual(stops.map((s) => s.hex))
    expect(result[0].position).toBe(0)
    expect(result[result.length - 1].position).toBe(100)
    // Positions stay sorted ascending.
    for (let i = 1; i < result.length; i++) {
      expect(result[i].position).toBeGreaterThanOrEqual(result[i - 1].position)
    }
  })

  it('is a no-op below 3 stops', () => {
    const two = stops.slice(0, 2)
    expect(varySpacing(two)).toEqual(two)
  })
})
