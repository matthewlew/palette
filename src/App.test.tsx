import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
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
    // The single bottom control is the back-to-Gallery button while creating.
    fireEvent.click(screen.getByTestId('tab-gallery'))

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
    // Trailing comma matches the tile's "<name>, <type> gradient" label but
    // not the hover overlay's "Delete Saved Palette One" button.
    fireEvent.click(screen.getByRole('button', { name: /Saved Palette One,/ }))

    // Click Edit
    const viewer = screen.getByTestId('gallery-viewer')
    fireEvent.click(within(viewer).getByRole('button', { name: 'Edit' }))

    // Verify we are in EditMode
    expect(screen.getByTestId('edit-mode')).toBeInTheDocument()
    expect(useAppStore.getState().mode).toBe('edit')
  })
})

describe('App import flow', () => {
  beforeEach(() => {
    useAppStore.setState({ saved: [], lastImported: null })
  })

  it('auto-adds gradients from a share link on load and shows an undo toast', () => {
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
    window.location.hash = `#${encodeToFragment(payload)}`
    render(<App />)
    expect(screen.getByTestId('undo-toast')).toBeInTheDocument()
    expect(screen.getByText(/added 1 gradient to gallery/i)).toBeInTheDocument()
    expect(screen.queryByTestId('import-banner')).not.toBeInTheDocument()
    window.location.hash = ''
  })

  it('undo removes the just-imported gradient', () => {
    const payload = {
      kind: 'board' as const,
      gradients: [
        {
          type: 'linear' as const,
          stops: [
            { hex: '#00ff00', position: 0 },
            { hex: '#000000', position: 100 },
          ],
          name: 'UndoMe',
        },
      ],
    }
    window.location.hash = `#${encodeToFragment(payload)}`
    render(<App />)
    fireEvent.click(screen.getByTestId('undo-import'))
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument()
    window.location.hash = ''
  })

  function dispatchPaste(text: string) {
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { getData: (t: string) => string }
    }
    ev.clipboardData = { getData: (t: string) => (t === 'text/plain' ? text : '') }
    act(() => {
      document.dispatchEvent(ev)
    })
    return ev
  }

  const pastePayload = JSON.stringify({
    kind: 'gradient',
    gradients: [
      {
        type: 'linear',
        stops: [
          { hex: '#123456', position: 0 },
          { hex: '#abcdef', position: 100 },
        ],
        name: 'Pasted',
      },
    ],
  })

  it('auto-adds a gradient pasted from the clipboard and shows an undo toast', () => {
    render(<App />)
    expect(useAppStore.getState().saved).toHaveLength(0)
    dispatchPaste(pastePayload)
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(screen.getByTestId('undo-toast')).toBeInTheDocument()
  })

  it('ignores paste while a text field is focused (native paste wins)', () => {
    render(<App />)
    const input = document.createElement('textarea')
    document.body.appendChild(input)
    input.focus()
    dispatchPaste(pastePayload)
    expect(useAppStore.getState().saved).toHaveLength(0)
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument()
    input.remove()
  })

  it('ignores a paste that is not a Palette payload', () => {
    render(<App />)
    dispatchPaste('just some text')
    expect(useAppStore.getState().saved).toHaveLength(0)
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument()
  })

  it('copies the current gradient to the clipboard on the copy event', () => {
    render(<App />)
    const written = new Map<string, string>()
    const ev = new Event('copy', { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { setData: (t: string, v: string) => void }
    }
    ev.clipboardData = { setData: (t: string, v: string) => written.set(t, v) }
    act(() => {
      document.dispatchEvent(ev)
    })
    // A current gradient exists in create mode, so JSON + SVG get written.
    expect(written.get('text/plain')).toContain('"kind": "gradient"')
    expect(written.get('image/svg+xml')).toContain('<svg')
    expect(screen.getByText(/copied gradient/i)).toBeInTheDocument()
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
