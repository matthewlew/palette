import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CanvasHandles } from './CanvasHandles'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

const size = { width: 200, height: 200 }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** pointerDown + wait out the 150ms hold so the drag arms. */
function armDrag(dot: HTMLElement, clientX: number, clientY: number) {
  fireEvent.pointerDown(dot, { pointerId: 1, clientX, clientY })
  act(() => {
    vi.advanceTimersByTime(200)
  })
}

describe('CanvasHandles hover reveal', () => {
  it('reveals no dot when the cursor is null', () => {
    render(<CanvasHandles stops={stops} type="linear" cursor={null} size={size} onReorder={vi.fn()} />)
    expect(screen.queryAllByTestId('canvas-handle-visible')).toHaveLength(0)
    expect(screen.queryAllByTestId('canvas-handle-near')).toHaveLength(0)
  })

  it('reveals every dot when hovering the canvas, with the nearest emphasized', () => {
    // linear anchors at (100,0), (100,100), (100,200) for a 200x200 canvas.
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 95 }} size={size} onReorder={vi.fn()} />)
    // Cursor within 24px of 'b': it gets the emphasized marker, the other two
    // stay visible at reduced emphasis — all three are on screen.
    const near = screen.getAllByTestId('canvas-handle-near')
    expect(near).toHaveLength(1)
    expect(near[0].getAttribute('data-stop-id')).toBe('b')
    expect(screen.getAllByTestId('canvas-handle-visible')).toHaveLength(2)
  })

  it('still reveals all dots (none emphasized) when the cursor is far from every anchor', () => {
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 0, y: 0 }} size={size} onReorder={vi.fn()} />)
    expect(screen.getAllByTestId('canvas-handle-visible')).toHaveLength(3)
    expect(screen.queryAllByTestId('canvas-handle-near')).toHaveLength(0)
  })
})

describe('CanvasHandles drag-to-reorder', () => {
  it('reorders live once the hold delay has armed the drag, and stays reordered on pointer up', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    armDrag(dot, 100, 0)
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 1, clientX: 100, clientY: 200 })
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
    armDrag(dot, 100, 0)
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 1, clientX: 100, clientY: 2 })
    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('CanvasHandles scroll-vs-drag intent', () => {
  it('a quick swipe (movement before the hold elapses) never reorders', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    // Swipe away immediately — well past the 8px cancel slop, before 150ms.
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 1, clientX: 100, clientY: 60 })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // The hold timer was cancelled by the swipe: further movement is inert.
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 1, clientX: 100, clientY: 200 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('small jitter under the slop does not cancel the pending drag', () => {
    const onReorder = vi.fn()
    render(<CanvasHandles stops={stops} type="linear" cursor={{ x: 100, y: 0 }} size={size} onReorder={onReorder} />)
    const dot = screen.getByTestId('canvas-handle-a')
    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 1, clientX: 100, clientY: 4 })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 1, clientX: 100, clientY: 200 })
    expect(onReorder).toHaveBeenCalledTimes(1)
  })
})

describe('CanvasHandles stuck-drag recovery', () => {
  it('ends the drag when the next move arrives with no button held (released off-window)', () => {
    const onDraggingChange = vi.fn()
    render(
      <CanvasHandles
        stops={stops}
        type="linear"
        cursor={{ x: 100, y: 0 }}
        size={size}
        onReorder={vi.fn()}
        onDraggingChange={onDraggingChange}
      />,
    )
    const dot = screen.getByTestId('canvas-handle-a')
    armDrag(dot, 100, 0)
    expect(onDraggingChange).toHaveBeenLastCalledWith(true)
    // Pointer re-enters the window with the button no longer pressed — we never
    // saw the pointerup, so the drag must not stay stuck.
    fireEvent.pointerMove(dot, { pointerId: 1, buttons: 0, clientX: 100, clientY: 40 })
    expect(onDraggingChange).toHaveBeenLastCalledWith(false)
  })

  it('ends the drag on a window-level pointerup when capture was lost off-element', () => {
    const onDraggingChange = vi.fn()
    render(
      <CanvasHandles
        stops={stops}
        type="linear"
        cursor={{ x: 100, y: 0 }}
        size={size}
        onReorder={vi.fn()}
        onDraggingChange={onDraggingChange}
      />,
    )
    const dot = screen.getByTestId('canvas-handle-a')
    armDrag(dot, 100, 0)
    expect(onDraggingChange).toHaveBeenLastCalledWith(true)
    act(() => {
      fireEvent.pointerUp(window)
    })
    expect(onDraggingChange).toHaveBeenLastCalledWith(false)
  })
})

describe('CanvasHandles dragging chrome callback', () => {
  it('notifies the parent when a drag engages and releases', () => {
    const onDraggingChange = vi.fn()
    render(
      <CanvasHandles
        stops={stops}
        type="linear"
        cursor={{ x: 100, y: 0 }}
        size={size}
        onReorder={vi.fn()}
        onDraggingChange={onDraggingChange}
      />,
    )
    // Mount reports not-dragging.
    expect(onDraggingChange).toHaveBeenLastCalledWith(false)
    const dot = screen.getByTestId('canvas-handle-a')
    armDrag(dot, 100, 0)
    expect(onDraggingChange).toHaveBeenLastCalledWith(true)
    fireEvent.pointerUp(dot, { pointerId: 1, clientX: 100, clientY: 0 })
    expect(onDraggingChange).toHaveBeenLastCalledWith(false)
  })
})
