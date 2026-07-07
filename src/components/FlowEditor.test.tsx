import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlowEditor } from './FlowEditor'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

describe('FlowEditor', () => {
  it('renders one slider handle per stop at the correct aria-valuenow', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(3)
    expect(sliders.map((s) => s.getAttribute('aria-valuenow'))).toEqual(['0', '50', '100'])
  })

  it('labels each handle with its hex', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    expect(screen.getByLabelText('Stop #ff0000')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop #00ff00')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop #0000ff')).toBeInTheDocument()
  })

  it('sets aria-valuemin and aria-valuemax on every handle', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider.getAttribute('aria-valuemin')).toBe('0')
      expect(slider.getAttribute('aria-valuemax')).toBe('100')
    }
  })

  it('ArrowUp decreases position by 1 and ArrowDown increases it by 1', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onMove).toHaveBeenCalledWith('b', 49)
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onMove).toHaveBeenCalledWith('b', 51)
  })

  it('Shift+ArrowUp/ArrowDown moves position by 10', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true })
    expect(onMove).toHaveBeenCalledWith('b', 60)
  })

  it('tapping a handle (pointerdown/up with <6px movement) calls onTapStop with that stop id', () => {
    const onTapStop = vi.fn()
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={onTapStop} />)
    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handle, { clientX: 12, clientY: 11 })
    expect(onTapStop).toHaveBeenCalledWith('a')
  })

  it('dragging a handle (>=6px movement) does not call onTapStop', () => {
    const onTapStop = vi.fn()
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={onTapStop} />)
    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 40 })
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 40 })
    expect(onTapStop).not.toHaveBeenCalled()
  })
})
