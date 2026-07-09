import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'
import type { Gradient } from '../store/types'

const gradients: Gradient[] = [
  { id: 'a', name: 'First', type: 'linear', stops: [{ hex: '#ff0000', position: 0 }, { hex: '#00ff00', position: 100 }] },
  { id: 'b', name: 'Second', type: 'radial', stops: [{ hex: '#0000ff', position: 0 }, { hex: '#ffff00', position: 100 }] },
]

const manyGradients: Gradient[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
  id,
  name: `Palette ${id}`,
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: `#00${(i + 1).toString(16).padStart(2, '0')}ff`, position: 100 },
  ],
}))

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('Drawer collapsed stack', () => {
  it('shows a dashed empty-state placeholder when there are no saved gradients', () => {
    render(<Drawer saved={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('drawer-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('drawer-thumbnail')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Browse saved palettes (none yet)' })).toBeInTheDocument()
  })

  it('shows at most three stacked thumbnails, most recent on top', () => {
    render(<Drawer saved={manyGradients} onSelect={vi.fn()} />)
    const thumbs = screen.getAllByTestId('drawer-thumbnail')
    expect(thumbs).toHaveLength(3)
  })

  it('shows an overflow badge counting the palettes beyond the stack', () => {
    render(<Drawer saved={manyGradients} onSelect={vi.fn()} />)
    expect(screen.getByTestId('saved-overflow').textContent).toBe('+2')
  })

  it('shows no overflow badge when three or fewer are saved', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    expect(screen.queryByTestId('saved-overflow')).not.toBeInTheDocument()
  })

  it('labels the stack with the total saved count', () => {
    render(<Drawer saved={manyGradients} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Browse 5 saved palettes' })).toBeInTheDocument()
  })
})

describe('Drawer browse expansion', () => {
  it('opens the saved browser when the stack is tapped', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByTestId('saved-stack'))
    expect(screen.getByTestId('saved-browser')).toBeInTheDocument()
    expect(screen.getAllByTestId('saved-card')).toHaveLength(2)
  })

  it('selecting a palette in the browser calls onSelect and closes the browser', () => {
    const onSelect = vi.fn()
    render(<Drawer saved={gradients} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('saved-stack'))
    fireEvent.click(screen.getByRole('button', { name: 'Open Second' }))
    expect(onSelect).toHaveBeenCalledWith(gradients[1])
    expect(screen.queryByTestId('saved-browser')).not.toBeInTheDocument()
  })

  it('closes the browser via the close button', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByTestId('saved-stack'))
    fireEvent.click(screen.getByRole('button', { name: 'Close saved palettes' }))
    expect(screen.queryByTestId('saved-browser')).not.toBeInTheDocument()
  })
})
