import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { useIdleFade } from './useIdleFade'

function Probe() {
  const active = useIdleFade(4000)
  return <span data-testid="active">{String(active)}</span>
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useIdleFade', () => {
  it('starts active', () => {
    render(<Probe />)
    expect(screen.getByTestId('active').textContent).toBe('true')
  })

  it('goes inactive after the timeout with no interaction', () => {
    render(<Probe />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByTestId('active').textContent).toBe('false')
  })

  it('reactivates on interaction and re-arms the timer', () => {
    render(<Probe />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByTestId('active').textContent).toBe('false')

    act(() => {
      fireEvent.pointerDown(window)
    })
    expect(screen.getByTestId('active').textContent).toBe('true')

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByTestId('active').textContent).toBe('false')
  })
})
