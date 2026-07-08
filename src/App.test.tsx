import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './store/useAppStore'
import { resetFeedSession } from './components/Feed'
import { encodeToFragment } from './lib/gradientCodec'

beforeEach(() => {
  resetFeedSession()
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('App', () => {
  it('shows the Feed in explore mode', () => {
    render(<App />)
    expect(screen.getByTestId('feed-container')).toBeInTheDocument()
  })

  it('shows the EditMode after a single tap on the gradient', () => {
    vi.useFakeTimers()
    render(<App />)
    const [page] = screen.getAllByTestId('gradient-page')

    fireEvent.pointerUp(page)
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('edit-mode')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders the drawer with a saved gradient after tapping the like button', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('like-button'))

    expect(screen.getAllByTestId('drawer-thumbnail')).toHaveLength(1)
  })

  it('calls withViewTransition when exiting edit mode', async () => {
    const viewTransitionModule = await import('./lib/viewTransition')
    const spy = vi.spyOn(viewTransitionModule, 'withViewTransition').mockImplementation((update) => update())

    useAppStore.getState().setCurrentGradient({
      id: 'g1',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
    })
    useAppStore.getState().enterEditMode()

    render(<App />)
    fireEvent.click(screen.getByLabelText('Back'))

    expect(spy).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().mode).toBe('explore')

    spy.mockRestore()
  })
})

describe('App import flow', () => {
  it('shows the import banner when the URL hash contains a valid share payload on load', () => {
    const payload = {
      kind: 'gradient' as const,
      gradients: [
        {
          type: 'linear' as const,
          stops: [
            { hex: '#ff0000', position: 0 },
            { hex: '#0000ff', position: 100 },
          ],
          name: 'Test',
        },
      ],
    }
    const fragment = encodeToFragment(payload)
    window.location.hash = `#${fragment}`

    render(<App />)
    expect(screen.getByTestId('import-banner')).toBeInTheDocument()

    window.location.hash = ''
  })
})
