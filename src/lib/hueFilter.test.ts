import { describe, it, expect } from 'vitest'
import { gradientHueFamily } from './hueFilter'

describe('gradientHueFamily', () => {
  it('identifies hue families based on center degree values', () => {
    // Red center is 25°
    expect(gradientHueFamily([{ hex: '#c0392b', position: 0 }])).toBe('red') // Red OKLCH

    // Green center is 145° (fern/moss-like)
    expect(gradientHueFamily([{ hex: '#4a8a5c', position: 0 }])).toBe('green')

    // Blue center is 255°
    expect(gradientHueFamily([{ hex: '#3f6bb0', position: 0 }])).toBe('blue')
  })

  it('selects the stop with the highest chroma above the floor as dominant', () => {
    // Stop 1: Muted green (low chroma, but above floor)
    // Stop 2: Saturated Red (high chroma)
    // The red stop should dictate the hue family.
    expect(
      gradientHueFamily([
        { hex: '#829c89', position: 0 }, // Celadon / Muted green
        { hex: '#c0392b', position: 100 }, // Vivid Red
      ])
    ).toBe('red')
  })

  it('returns null (neutral) if all stops are below the chroma floor', () => {
    // Pure neutrals / very low chroma grays/whites
    expect(
      gradientHueFamily([
        { hex: '#ffffff', position: 0 },
        { hex: '#888888', position: 50 },
        { hex: '#000000', position: 100 },
      ])
    ).toBeNull()
  })

  it('correctly handles boundary conditions and wrapping around 0/360 degrees', () => {
    // Pink is centered at 350°
    // Red is centered at 25°
    // A hue of 5° is closer to Red than Pink
    expect(gradientHueFamily([{ hex: '#c2543a', position: 0 }])).toBe('red')
  })
})
