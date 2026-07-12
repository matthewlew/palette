import { describe, it, expect } from 'vitest'
import { morphStops } from './morph'
import type { GradientStop } from './gradient'

const from: GradientStop[] = [
  { hex: '#2e7d32', position: 0 },
  { hex: '#1565c0', position: 100 },
]
const to: GradientStop[] = [
  { hex: '#66bb6a', position: 0 },
  { hex: '#42a5f5', position: 100 },
]

describe('morphStops', () => {
  it('at t=0 returns the from colors', () => {
    expect(morphStops(from, to, 0).map((s) => s.hex)).toEqual(from.map((s) => s.hex))
  })
  it('at t=1 returns the to colors', () => {
    expect(morphStops(from, to, 1).map((s) => s.hex)).toEqual(to.map((s) => s.hex))
  })
  it('preserves positions from the target', () => {
    expect(morphStops(from, to, 0.5).map((s) => s.position)).toEqual([0, 100])
  })
  it('at t=0.5 each stop lands strictly between the endpoints', () => {
    const mid = morphStops(from, to, 0.5)
    mid.forEach((s, i) => {
      expect(s.hex).not.toEqual(from[i].hex)
      expect(s.hex).not.toEqual(to[i].hex)
    })
  })
  it('throws on mismatched lengths (callers must guard)', () => {
    expect(() => morphStops(from, [to[0]], 0.5)).toThrow()
  })
})
