import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockStack } from './BlockStack'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ffffff' },
  { id: 'b', hex: '#000000' },
  { id: 'c', hex: '#3388cc' },
]

describe('BlockStack', () => {
  it('renders one block per stop', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getAllByTestId('stack-block')).toHaveLength(3)
  })

  it('uses dark text/border on a light background block, light text/border on a dark one', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} />)
    const blocks = screen.getAllByTestId('stack-block')
    // stops[0] is #ffffff (light) -> dark (#000) text.
    expect(blocks[0].style.color).toBe('rgb(0, 0, 0)')
    // stops[1] is #000000 (dark) -> light (#fff) text.
    expect(blocks[1].style.color).toBe('rgb(255, 255, 255)')
  })

  it('shows a remove button on each block when there are more than 2 stops', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getAllByTestId('remove-block')).toHaveLength(3)
  })

  it('hides remove buttons entirely once only 2 stops remain', () => {
    render(<BlockStack stops={stops.slice(0, 2)} onReorder={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryAllByTestId('remove-block')).toHaveLength(0)
  })

  it('calls onRemove with the clicked block id', () => {
    const onRemove = vi.fn()
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={onRemove} />)
    fireEvent.click(screen.getAllByTestId('remove-block')[1])
    expect(onRemove).toHaveBeenCalledWith('b')
  })
})

describe('BlockStack insertion gap', () => {
  it('renders a gap element at the given insertionIndex', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} insertionIndex={1} />)
    const gap = screen.getByTestId('insertion-gap')
    const blocks = screen.getAllByTestId('stack-block')
    // The gap should appear between the first and second block in DOM order.
    const children = Array.from(gap.parentElement!.children)
    expect(children.indexOf(gap)).toBe(1)
    expect(children.indexOf(blocks[0])).toBe(0)
    expect(children.indexOf(blocks[1])).toBe(2)
  })

  it('renders no gap when insertionIndex is null', () => {
    render(<BlockStack stops={stops} onReorder={vi.fn()} onRemove={vi.fn()} insertionIndex={null} />)
    expect(screen.queryByTestId('insertion-gap')).not.toBeInTheDocument()
  })
})
