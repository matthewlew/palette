import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockWheel } from './BlockWheel'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000' },
  { id: 'b', hex: '#00ff00' },
  { id: 'c', hex: '#0000ff' },
  { id: 'd', hex: '#ffff00' },
]

describe('BlockWheel', () => {
  it('renders one wedge per stop', () => {
    render(<BlockWheel stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getAllByTestId('wheel-wedge')).toHaveLength(4)
  })

  it('sizes each wedge to an equal share of 360 degrees', () => {
    render(<BlockWheel stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} />)
    const wedges = screen.getAllByTestId('wheel-wedge')
    // 4 wedges -> 90deg each; check the data attribute we expose for testability
    // (SVG path geometry itself is awkward to assert on directly).
    for (const wedge of wedges) {
      expect(wedge.dataset.wedgeDegrees).toBe('90')
    }
  })

  it('shows a remove button per wedge when more than 2 stops remain', () => {
    render(<BlockWheel stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getAllByTestId('remove-block')).toHaveLength(4)
  })

  it('hides remove buttons once only 2 stops remain', () => {
    render(<BlockWheel stops={stops.slice(0, 2)} onReorder={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryAllByTestId('remove-block')).toHaveLength(0)
  })

  it('calls onRemove with the clicked wedge id', () => {
    const onRemove = vi.fn()
    render(<BlockWheel stops={stops} onReorder={vi.fn()} onRemove={onRemove} />)
    fireEvent.click(screen.getAllByTestId('remove-block')[2])
    expect(onRemove).toHaveBeenCalledWith('c')
  })
})
