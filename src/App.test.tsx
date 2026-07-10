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
  it('shows the Feed in create mode', () => {
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

  it('renders the gallery with a saved gradient after tapping the like button and switching tabs', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('like-button'))
    fireEvent.click(screen.getByText('Gallery'))

    expect(screen.getAllByTestId('gallery-tile')).toHaveLength(1)
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
    expect(useAppStore.getState().mode).toBe('create')

    spy.mockRestore()
  })

  it('enters edit mode on a gradient when riffing from the gallery', () => {
    useAppStore.setState({
      saved: [
        {
          id: 'g1',
          type: 'linear',
          stops: [
            { hex: '#ff0000', position: 0 },
            { hex: '#0000ff', position: 100 },
          ],
          name: 'Saved Palette One',
        },
      ],
      mode: 'gallery',
    })

    render(<App />)

    // Open viewer
    fireEvent.click(screen.getByRole('button', { name: /Saved Palette One/ }))

    // Click Riff
    fireEvent.click(screen.getByRole('button', { name: 'Riff' }))

    // Verify we are in EditMode
    expect(screen.getByTestId('edit-mode')).toBeInTheDocument()
    expect(useAppStore.getState().mode).toBe('edit')
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

  it('renders a thumbnail in the TabBar Gallery button once a gradient is saved', () => {
    render(<App />)

    // Initially, no thumbnail
    expect(screen.queryByTestId('tab-gallery-thumb')).not.toBeInTheDocument()

    // Like/save current gradient
    fireEvent.click(screen.getByTestId('like-button'))

    // Now it should render the thumbnail
    expect(screen.getByTestId('tab-gallery-thumb')).toBeInTheDocument()
  })
})
