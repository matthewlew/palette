import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useDoubleTap } from './useDoubleTap'

function TestTarget({ onDoubleTap, onSingleTap }: { onDoubleTap: () => void; onSingleTap?: () => void }) {
  const handlers = useDoubleTap(onDoubleTap, onSingleTap)
  return <div data-testid="target" {...handlers} />
}

describe('useDoubleTap', () => {
  it('fires onDoubleTap when two pointerups occur within 300ms', () => {
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<TestTarget onDoubleTap={onDoubleTap} />)
    const target = getByTestId('target')

    fireEvent.pointerUp(target)
    fireEvent.pointerUp(target)

    expect(onDoubleTap).toHaveBeenCalledTimes(1)
  })

  it('does not fire onDoubleTap when pointerups are more than 300ms apart', async () => {
    vi.useFakeTimers()
    const onDoubleTap = vi.fn()
    const { getByTestId } = render(<TestTarget onDoubleTap={onDoubleTap} />)
    const target = getByTestId('target')

    fireEvent.pointerUp(target)
    vi.advanceTimersByTime(400)
    fireEvent.pointerUp(target)

    expect(onDoubleTap).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('fires onSingleTap after the debounce window if no second tap occurs', () => {
    vi.useFakeTimers()
    const onSingleTap = vi.fn()
    const { getByTestId } = render(<TestTarget onDoubleTap={vi.fn()} onSingleTap={onSingleTap} />)
    const target = getByTestId('target')

    fireEvent.pointerUp(target)
    vi.advanceTimersByTime(350)

    expect(onSingleTap).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
