import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'
import type { Gradient } from '../store/types'

const gradients: Gradient[] = [
  { id: 'a', type: 'linear', stops: [{ hex: '#ff0000', position: 0 }, { hex: '#00ff00', position: 100 }] },
  { id: 'b', type: 'radial', stops: [{ hex: '#0000ff', position: 0 }, { hex: '#ffff00', position: 100 }] },
]

describe('Drawer', () => {
  it('renders one thumbnail per saved gradient', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    expect(screen.getAllByTestId('drawer-thumbnail')).toHaveLength(2)
  })

  it('renders nothing but the container when there are no saved gradients', () => {
    render(<Drawer saved={[]} onSelect={vi.fn()} />)
    expect(screen.queryAllByTestId('drawer-thumbnail')).toHaveLength(0)
  })

  it('calls onSelect with the gradient when a thumbnail is tapped', () => {
    const onSelect = vi.fn()
    render(<Drawer saved={gradients} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByTestId('drawer-thumbnail')[1])
    expect(onSelect).toHaveBeenCalledWith(gradients[1])
  })

  it('has no sort label or select — always shows saved order', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    expect(screen.queryByText('Sort saved palettes')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sort saved palettes')).not.toBeInTheDocument()
    const thumbnails = screen.getAllByTestId('drawer-thumbnail')
    expect(thumbnails.map((t) => t.getAttribute('aria-label'))).toEqual(['Saved linear gradient', 'Saved radial gradient'])
  })

  it('renders the TurrellSquare treatment (not a conic background) for saved square gradients', () => {
    const squareGradient: Gradient = {
      id: 'sq1',
      type: 'square',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
    }
    render(<Drawer saved={[squareGradient]} onSelect={vi.fn()} />)
    const thumbnail = screen.getByTestId('drawer-thumbnail')
    expect(screen.getByTestId('turrell-square')).toBeInTheDocument()
    expect(thumbnail.style.backgroundImage).toBe('')
  })
})
