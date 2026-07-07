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
})
