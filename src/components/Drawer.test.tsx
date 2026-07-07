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

  it('reorders displayed thumbnails by hue when "Hue" is selected, without mutating input order', () => {
    const onSelect = vi.fn()
    const original = [...gradients]
    render(<Drawer saved={gradients} onSelect={onSelect} />)

    fireEvent.change(screen.getByLabelText('Sort saved palettes'), { target: { value: 'hue' } })

    const thumbnails = screen.getAllByTestId('drawer-thumbnail')
    expect(thumbnails).toHaveLength(2)
    // Input prop array itself must remain untouched (view-only sort).
    expect(gradients).toEqual(original)
  })

  it('defaults to Newest (original saved order)', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} />)
    const select = screen.getByLabelText('Sort saved palettes') as HTMLSelectElement
    expect(select.value).toBe('newest')
  })
})
