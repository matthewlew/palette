import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TurrellSquare } from './TurrellSquare'
import type { GradientStop } from '../lib/gradient'

const stops: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#00ff00', position: 50 },
  { hex: '#0000ff', position: 100 },
]

describe('TurrellSquare', () => {
  it('renders one layer per stop', () => {
    render(<TurrellSquare stops={stops} />)
    expect(screen.getAllByTestId('turrell-layer')).toHaveLength(3)
  })

  it('renders the outermost layer as the last stop by default', () => {
    render(<TurrellSquare stops={stops} />)
    const layers = screen.getAllByTestId('turrell-layer')
    // DOM renders largest (pos 100) first, so layers[0] is blue.
    expect(layers[0].style.backgroundColor).toBe('rgb(0, 0, 255)')
    // Smallest (pos 0) is rendered last, so layers[2] is red.
    expect(layers[2].style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('reverses colors when reversed=true', () => {
    render(<TurrellSquare stops={stops} reversed />)
    const layers = screen.getAllByTestId('turrell-layer')
    // Outermost layer (pos 100) gets hexes[0] when reversed.
    expect(layers[0].style.backgroundColor).toBe('rgb(255, 0, 0)')
    // Innermost layer (pos 0) gets hexes[2] when reversed.
    expect(layers[2].style.backgroundColor).toBe('rgb(0, 0, 255)')
  })

  it('renders layers with monotonically decreasing, square (width === height) sizes from outermost to innermost', () => {
    const fourStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#00ff00', position: 33 },
      { hex: '#0000ff', position: 66 },
      { hex: '#ffff00', position: 100 },
    ]
    render(<TurrellSquare stops={fourStops} />)
    const layers = screen.getAllByTestId('turrell-layer')
    // Outermost layer oversizes past the container so its blur can't bleed
    // a background halo at the edges; the rest shrink monotonically.
    // Outermost layer's default blur/bleed is now a percentage of the
    // container's own size (TURRELL_SOFTNESS_PERCENT * 4), not a flat px
    // bleed, so the on-screen render stays resolution-independent.
    expect(layers[0].style.width).toBe('calc(107%)')
    expect(layers[0].style.height).toBe('calc(107%)')
    const sizes = layers.slice(1).map((l) => {
      const width = parseFloat(l.style.width)
      const height = parseFloat(l.style.height)
      expect(width).toBe(height)
      return width
    })
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1])
    }
    // Position 0 is TURRELL_EXTENT_FLOOR of the reach, doubled to a width.
    // Was 20%, which damped a stop's travel to 80% of the range and made the
    // control feel unresponsive next to linear or radial.
    expect(sizes[sizes.length - 1]).toBe(10)
  })

  it('handles a single stop without dividing by zero, rendering it beyond full size', () => {
    render(<TurrellSquare stops={[{ hex: '#ff0000', position: 0 }]} />)
    const layer = screen.getByTestId('turrell-layer')
    expect(layer.style.width).toBe('calc(107%)')
    expect(layer.style.height).toBe('calc(107%)')
  })

  it('sizes layers from each stop\'s actual position, not just its index', () => {
    // Two stops bunched close together (10, 20) should produce two similarly
    // sized layers, distinct from a third stop far away at 90.
    const skewed: GradientStop[] = [
      { hex: '#ff0000', position: 10 },
      { hex: '#00ff00', position: 20 },
      { hex: '#0000ff', position: 90 },
    ]
    render(<TurrellSquare stops={skewed} />)
    const layers = screen.getAllByTestId('turrell-layer')
    // DOM rendering: pos 90 (layers[0]), pos 20 (layers[1]), pos 10 (layers[2])
    // layers[0] bleeds past 100% so check layers 1 and 2 directly.
    expect(layers[1].style.width).toBe(`${10 + (20 / 100) * 90}%`) // 28%
    expect(layers[2].style.width).toBe(`${10 + (10 / 100) * 90}%`) // 19%
    
    const gapNear = Math.abs(parseFloat(layers[1].style.width) - parseFloat(layers[2].style.width))
    // Virtual size for layers[0] without bleed would be 92%.
    const gapFar = Math.abs(92 - parseFloat(layers[1].style.width))
    expect(gapNear).toBeLessThan(gapFar)
  })

  it('reversed swaps colors per layer depth without changing which depth is largest', () => {
    const skewed: GradientStop[] = [
      { hex: '#ff0000', position: 10 },
      { hex: '#00ff00', position: 50 },
      { hex: '#0000ff', position: 90 },
    ]
    const { rerender } = render(<TurrellSquare stops={skewed} />)
    const forwardSizes = screen.getAllByTestId('turrell-layer').map((l) => l.style.width)

    rerender(<TurrellSquare stops={skewed} reversed />)
    const layers = screen.getAllByTestId('turrell-layer')
    const reversedSizes = layers.map((l) => l.style.width)
    // Sizes (depth structure) are unaffected by reversed — only colors change.
    expect(reversedSizes).toEqual(forwardSizes)
    expect(layers[0].style.backgroundColor).toBe('rgb(255, 0, 0)') // 90 was blue, now red
    expect(layers[2].style.backgroundColor).toBe('rgb(0, 0, 255)') // 10 was red, now blue
  })

  it('applies a custom blur radius when blurPx is provided', () => {
    render(<TurrellSquare stops={stops} blurPx={4} />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.filter).toBe('blur(4px)')
  })
})
