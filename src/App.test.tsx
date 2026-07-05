import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './store/useAppStore'

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('App', () => {
  it('shows the Feed in explore mode', () => {
    render(<App />)
    expect(screen.getByTestId('feed-container')).toBeInTheDocument()
  })

  it('shows the EditModeStub after a single tap on the gradient', () => {
    vi.useFakeTimers()
    render(<App />)
    const [page] = screen.getAllByTestId('gradient-page')

    fireEvent.pointerUp(page)
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('edit-mode-stub')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders the drawer with a saved gradient after double-tap', () => {
    render(<App />)
    const [page] = screen.getAllByTestId('gradient-page')

    fireEvent.pointerUp(page)
    fireEvent.pointerUp(page)

    expect(screen.getAllByTestId('drawer-thumbnail')).toHaveLength(1)
  })
})
