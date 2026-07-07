import { describe, it, expect } from 'vitest'
import { decayVelocity, shouldStartMomentum } from './momentum'

describe('decayVelocity', () => {
  it('roughly halves velocity every ~230ms of elapsed frame time', () => {
    let v = 1.0
    let elapsed = 0
    const frameDt = 16.67
    while (elapsed < 230) {
      v = decayVelocity(v, frameDt)
      elapsed += frameDt
    }
    expect(v).toBeGreaterThan(0.4)
    expect(v).toBeLessThan(0.6)
  })

  it('decays a single frame by pow(0.95, frameDt/16.67)', () => {
    const result = decayVelocity(1.0, 16.67)
    expect(result).toBeCloseTo(0.95, 2)
  })

  it('decays proportionally more for a larger frame delta', () => {
    const oneFrame = decayVelocity(1.0, 16.67)
    const twoFrames = decayVelocity(1.0, 33.34)
    expect(twoFrames).toBeLessThan(oneFrame)
  })
})

describe('shouldStartMomentum', () => {
  it('returns false for velocity at or below 0.29 px/ms', () => {
    expect(shouldStartMomentum(0.29)).toBe(false)
  })

  it('returns true for velocity at or above 0.31 px/ms', () => {
    expect(shouldStartMomentum(0.31)).toBe(true)
  })

  it('treats negative velocity magnitude the same as positive', () => {
    expect(shouldStartMomentum(-0.31)).toBe(true)
    expect(shouldStartMomentum(-0.29)).toBe(false)
  })
})
