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

  it('renders the outermost layer as the first stop by default', () => {
    render(<TurrellSquare stops={stops} />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(layers[2].style.backgroundColor).toBe('rgb(0, 0, 255)')
  })

  it('reverses layer order when reversed=true', () => {
    render(<TurrellSquare stops={stops} reversed />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.backgroundColor).toBe('rgb(0, 0, 255)')
    expect(layers[2].style.backgroundColor).toBe('rgb(255, 0, 0)')
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
    expect(layers[0].style.width).toBe('calc(100% + 96px)')
    expect(layers[0].style.height).toBe('calc(100% + 96px)')
    const sizes = layers.slice(1).map((l) => {
      const width = parseFloat(l.style.width)
      const height = parseFloat(l.style.height)
      expect(width).toBe(height)
      return width
    })
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1])
    }
    expect(sizes[sizes.length - 1]).toBe(20)
  })

  it('handles a single stop without dividing by zero, rendering it beyond full size', () => {
    render(<TurrellSquare stops={[{ hex: '#ff0000', position: 0 }]} />)
    const layer = screen.getByTestId('turrell-layer')
    expect(layer.style.width).toBe('calc(100% + 96px)')
    expect(layer.style.height).toBe('calc(100% + 96px)')
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
    // layers[0] bleeds past 100% so it isn't comparable in raw percent; check
    // layers 1 and 2 against the position-derived formula directly.
    expect(layers[1].style.width).toBe(`${100 - (20 / 100) * 80}%`)
    expect(layers[2].style.width).toBe(`${100 - (90 / 100) * 80}%`)
    // The two close-together positions (10, 20) should be much nearer in
    // size to each other than to the far-away stop at 90.
    const gapNear = Math.abs(parseFloat(layers[1].style.width) - (100 - (10 / 100) * 80))
    const gapFar = Math.abs(parseFloat(layers[2].style.width) - (100 - (10 / 100) * 80))
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
    expect(layers[0].style.backgroundColor).toBe('rgb(0, 0, 255)')
    expect(layers[2].style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('applies a custom blur radius when blurPx is provided', () => {
    render(<TurrellSquare stops={stops} blurPx={4} />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.filter).toBe('blur(4px)')
  })
})
