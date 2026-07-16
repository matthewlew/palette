import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CanvasHandles } from './CanvasHandles'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

const size = { width: 200, height: 200 }

describe('CanvasHandles proximity reveal', () => {
  it('reveals no dot when the cursor is null', () => {
    render(<CanvasHandles stops={stops} type="linear" cursor={null} size={size} onReorder={vi.fn()} />)
    expect(screen.queryAllByTestId('canvas-handle-visible')).toHaveLength(0)
  })

  it('reveals only the nearest dot within 24px, hides the rest', () => {
    // linear anchors at (100,0), (100,100), (100,200) for a 200x200 canvas.
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 95 }} size={size} onReorder={vi.fn()} />)
    const visible = screen.getAllByTestId('canvas-handle-visible')
    expect(visible).toHaveLength(1)
    expect(visible[0].getAttribute('data-stop-id')).toBe('b')
  })

  it('reveals nothing when the cursor is farther than 24px from every dot', () => {
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 0, y: 0 }} size={size} onReorder={vi.fn()} />)
    expect(screen.queryAllByTestId('canvas-handle-visible')).toHaveLength(0)
  })
})

describe('CanvasHandles drag-to-reorder', () => {
  it('reorders live as the cursor moves toward another slot, and stays reordered on pointer up', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 100, clientY: 200 })
    expect(onReorder).toHaveBeenCalledWith([
      { id: 'b', hex: '#00ff00', position: 50 },
      { id: 'c', hex: '#0000ff', position: 100 },
      { id: 'a', hex: '#ff0000', position: 0 },
    ])
    fireEvent.pointerUp(dot, { pointerId: 1, clientX: 100, clientY: 200 })
    // No further reorder call on release (already-live commit).
    expect(onReorder).toHaveBeenCalledTimes(1)
  })

  it('does not call onReorder when the cursor stays over the same slot', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 100, clientY: 2 })
    expect(onReorder).not.toHaveBeenCalled()
  })
})
