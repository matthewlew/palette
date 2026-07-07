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
    const sizes = layers.map((l) => {
      const width = parseFloat(l.style.width)
      const height = parseFloat(l.style.height)
      expect(width).toBe(height)
      return width
    })
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1])
    }
    expect(sizes[0]).toBe(100)
    expect(sizes[sizes.length - 1]).toBe(20)
  })

  it('handles a single stop without dividing by zero, rendering it at full size', () => {
    render(<TurrellSquare stops={[{ hex: '#ff0000', position: 0 }]} />)
    const layer = screen.getByTestId('turrell-layer')
    expect(parseFloat(layer.style.width)).toBe(100)
    expect(parseFloat(layer.style.height)).toBe(100)
  })

  it('applies a custom blur radius when blurPx is provided', () => {
    render(<TurrellSquare stops={stops} blurPx={4} />)
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers[0].style.filter).toBe('blur(4px)')
  })
})
