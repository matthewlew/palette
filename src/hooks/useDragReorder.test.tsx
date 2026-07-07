import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useDragReorder } from './useDragReorder'

const DRAG_START_DELAY_MS = 150
const SWAP_THRESHOLD_PX = 48

function TestList({ onReorder }: { onReorder: (next: string[]) => void }) {
  const items = ['a', 'b', 'c']
  const { draggingIndex, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(items, onReorder)
  return (
    <div
      data-testid="list"
      onPointerMove={(e) => handlePointerMove(e.clientY)}
      onPointerUp={handlePointerUp}
    >
      {items.map((item, index) => (
        <div
          key={item}
          data-testid={`item-${item}`}
          data-dragging={draggingIndex === index}
          onPointerDown={(e) => handlePointerDown(index, e.clientY)}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useDragReorder', () => {
  it('does not start dragging immediately on pointerdown (respects the start delay)', () => {
    render(<TestList onReorder={vi.fn()} />)
    fireEvent.pointerDown(screen.getByTestId('item-a'), { clientY: 100 })
    expect(screen.getByTestId('item-a').dataset.dragging).toBe('false')
  })

  it('starts dragging after the start delay elapses', () => {
    render(<TestList onReorder={vi.fn()} />)
    fireEvent.pointerDown(screen.getByTestId('item-a'), { clientY: 100 })
    act(() => {
      vi.advanceTimersByTime(DRAG_START_DELAY_MS)
    })
    expect(screen.getByTestId('item-a').dataset.dragging).toBe('true')
  })

  it('swaps with the next item once accumulated downward movement crosses the threshold', () => {
    const onReorder = vi.fn()
    render(<TestList onReorder={onReorder} />)
    fireEvent.pointerDown(screen.getByTestId('item-a'), { clientY: 100 })
    act(() => {
      vi.advanceTimersByTime(DRAG_START_DELAY_MS)
    })
    fireEvent.pointerMove(screen.getByTestId('list'), { clientY: 100 + SWAP_THRESHOLD_PX })
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('does not swap past the end of the list', () => {
    const onReorder = vi.fn()
    render(<TestList onReorder={onReorder} />)
    fireEvent.pointerDown(screen.getByTestId('item-c'), { clientY: 100 })
    act(() => {
      vi.advanceTimersByTime(DRAG_START_DELAY_MS)
    })
    fireEvent.pointerMove(screen.getByTestId('list'), { clientY: 100 + SWAP_THRESHOLD_PX * 2 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('clears dragging state on pointerup', () => {
    render(<TestList onReorder={vi.fn()} />)
    fireEvent.pointerDown(screen.getByTestId('item-a'), { clientY: 100 })
    act(() => {
      vi.advanceTimersByTime(DRAG_START_DELAY_MS)
    })
    fireEvent.pointerUp(screen.getByTestId('list'))
    expect(screen.getByTestId('item-a').dataset.dragging).toBe('false')
  })

  it('vibrates once per successful swap', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true })
    render(<TestList onReorder={vi.fn()} />)
    fireEvent.pointerDown(screen.getByTestId('item-a'), { clientY: 100 })
    act(() => {
      vi.advanceTimersByTime(DRAG_START_DELAY_MS)
    })
    fireEvent.pointerMove(screen.getByTestId('list'), { clientY: 100 + SWAP_THRESHOLD_PX })
    expect(vibrateMock).toHaveBeenCalledTimes(1)
  })
})
