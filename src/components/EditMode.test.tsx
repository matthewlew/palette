import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditMode } from './EditMode'
import { useAppStore } from '../store/useAppStore'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { oklchToHex } from '../lib/oklch'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 50 },
    { hex: '#0000ff', position: 100 },
  ],
  reversed: false,
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().setCurrentGradient(gradient)
})

afterEach(() => {
  cleanup()
})

describe('EditMode', () => {
  it('renders the preview, geometry tabs, block stack, and swatch tray', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('edit-mode-preview')).toBeInTheDocument()
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
    expect(screen.getAllByTestId('swatch').length).toBe(78)
  })

  it('renders FlowEditor (not BlockWheel) for square/Turrell gradients', () => {
    render(<EditMode gradient={{ ...gradient, type: 'square' }} onExit={vi.fn()} />)
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
    expect(screen.queryByTestId('wheel-container')).not.toBeInTheDocument()
  })

  it('renders FlowEditor (not BlockWheel) for angular gradients', () => {
    const angular: Gradient = {
      id: 'g-angular',
      type: 'angular',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#00ff00', position: 50 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    render(<EditMode gradient={angular} onExit={vi.fn()} />)
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
    expect(screen.queryByTestId('wheel-container')).not.toBeInTheDocument()
  })

  it('switching tabs updates the store current gradient type without changing stop colors', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Radial'))
    const updated = useAppStore.getState().current!
    expect(updated.type).toBe('radial')
    expect(updated.stops.map((s) => s.hex)).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('switching geometry type preserves custom (non-equalized) stop positions', () => {
    const custom: Gradient = {
      id: 'g-custom',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 5 },
        { hex: '#00ff00', position: 40 },
        { hex: '#0000ff', position: 95 },
      ],
      reversed: false,
    }
    useAppStore.getState().setCurrentGradient(custom)
    render(<EditMode gradient={custom} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Radial'))
    const updated = useAppStore.getState().current!
    expect(updated.type).toBe('radial')
    expect(updated.stops.map((s) => s.position)).toEqual([5, 40, 95])
  })

  it('toggling reversed preserves custom (non-equalized) stop positions', () => {
    const custom: Gradient = {
      id: 'g-custom',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 5 },
        { hex: '#00ff00', position: 40 },
        { hex: '#0000ff', position: 95 },
      ],
      reversed: false,
    }
    useAppStore.getState().setCurrentGradient(custom)
    render(<EditMode gradient={custom} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    const updated = useAppStore.getState().current!
    expect(updated.reversed).toBe(true)
    expect(updated.stops.map((s) => s.position)).toEqual([5, 40, 95])
  })

  it('tapping the repeat and hard filter chips toggles them on the store, preserving positions', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('filter-repeat'))
    expect(useAppStore.getState().current!.repeatEnabled).toBe(true)
    fireEvent.click(screen.getByTestId('filter-hard'))
    expect(useAppStore.getState().current!.hardStops).toBe(true)
    expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([0, 50, 100])
  })

  it('tapping the already-active tab toggles reversed on the store', () => {
    const { rerender } = render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(useAppStore.getState().current!.reversed).toBe(true)

    rerender(<EditMode gradient={useAppStore.getState().current!} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(useAppStore.getState().current!.reversed).toBe(false)
  })

  it('tapping an already-selected swatch removes a stop, re-equalizing positions', () => {
    vi.useFakeTimers()
    const swatchHex = oklchToHex(DEFAULT_COLOR_SET.colors[5].value)
    const gradientWithSwatchStop: Gradient = {
      id: 'g4',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: swatchHex, position: 50 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    render(<EditMode gradient={gradientWithSwatchStop} onExit={vi.fn()} />)
    const selectedSwatch = screen.getAllByTestId('swatch')[5]
    fireEvent.pointerDown(selectedSwatch)
    fireEvent.pointerUp(document)
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(2)
    expect(updated.stops.map((s) => s.position)).toEqual([0, 100])
    vi.useRealTimers()
  })

  it('has no Done button; has a back chevron that calls onExit', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Back'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('tapping the preview exits immediately, with no debounce wait', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    fireEvent.pointerUp(screen.getByTestId('edit-mode-preview'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('renders a LikeButton in the preview that toggles the saved state', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const likeButton = screen.getByTestId('like-button')
    expect(likeButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(likeButton)
    expect(useAppStore.getState().saved).toHaveLength(1)
  })

  it('tapping an unselected swatch appends a new stop', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const swatch = screen.getAllByTestId('swatch')[5]
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(useAppStore.getState().current!.stops).toHaveLength(4)
    vi.useRealTimers()
  })

  it('renders an order control showing the ACTIVE order, cycling Original -> Lightness -> Chroma -> Hue -> Original', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)

    const preview = screen.getByTestId('edit-mode-preview')
    const fab = screen.getByTestId('sort-fab')
    expect(preview).toContainElement(fab)
    expect(fab.textContent).toBe('Order: Original')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Order: Lightness')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Order: Chroma')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Order: Hue')

    fireEvent.click(fab)
    expect(fab.textContent).toBe('Order: Original')
  })

  it('cycling back to Original restores the pre-sort stop order', () => {
    const darkFirst: Gradient = {
      id: 'g-restore',
      type: 'linear',
      stops: [
        { hex: '#00ff00', position: 0 },
        { hex: '#0000ff', position: 50 },
        { hex: '#ff0000', position: 100 },
      ],
      reversed: false,
    }
    render(<EditMode gradient={darkFirst} onExit={vi.fn()} />)
    const fab = screen.getByTestId('sort-fab')
    fireEvent.click(fab) // lightness
    fireEvent.click(fab) // chroma
    fireEvent.click(fab) // hue
    fireEvent.click(fab) // original
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#00ff00', '#0000ff', '#ff0000'])
  })

  it('tapping the sort FAB sorts stops by the labeled key', () => {
    const darkFirst: Gradient = {
      id: 'g-sort',
      type: 'linear',
      stops: [
        { hex: '#00ff00', position: 0 }, // light, l~0.87
        { hex: '#0000ff', position: 50 }, // dark, l~0.45
        { hex: '#ff0000', position: 100 }, // mid, l~0.63
      ],
      reversed: false,
    }
    render(<EditMode gradient={darkFirst} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sort-fab')) // applies lightness
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })

  it('tapping "Sort by lightness" reorders stops darkest to lightest', () => {
    const darkFirst: Gradient = {
      id: 'g2',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 0 }, // dark, l~0.45
        { hex: '#00ff00', position: 50 }, // light, l~0.87
        { hex: '#ff0000', position: 100 }, // mid, l~0.63
      ],
      reversed: false,
    }
    render(<EditMode gradient={darkFirst} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sort-fab'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })

  it('sorting by lightness also re-equalizes stop positions evenly', () => {
    const unequalPositions: Gradient = {
      id: 'g3',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 5 }, // dark
        { hex: '#00ff00', position: 40 }, // light
        { hex: '#ff0000', position: 95 }, // mid
      ],
      reversed: false,
    }
    render(<EditMode gradient={unequalPositions} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sort-fab'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.position)).toEqual([0, 50, 100])
  })

  it('sorting also re-equalizes the on-screen flow handle positions, not just the store', () => {
    const unequalPositions: Gradient = {
      id: 'g3b',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 5 }, // dark
        { hex: '#00ff00', position: 40 }, // light
        { hex: '#ff0000', position: 95 }, // mid
      ],
      reversed: false,
    }
    render(<EditMode gradient={unequalPositions} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('sort-fab'))
    const handles = screen.getAllByRole('slider')
    expect(handles.map((h) => h.getAttribute('aria-valuenow'))).toEqual(['0', '50', '100'])
  })

  it('drag-adding a swatch onto the flow track (non-wheel type) inserts using the largest-gap heuristic', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const swatch = screen.getAllByTestId('swatch')[10]
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(document, { clientX: 0, clientY: 0 })
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(4)
    vi.useRealTimers()
  })

  it('shows the edit hint on mount and dismisses it on pointerdown anywhere in edit mode', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a swatch to edit')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('edit-mode'))

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
  })

  it('auto-dismisses the edit hint after 4 seconds', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a swatch to edit')).toBeInTheDocument()

    vi.advanceTimersByTime(4000)

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
    vi.useRealTimers()
  })

  it('dragging a flow handle updates the store gradient position for that stop in real time', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 10 })

    const updated = useAppStore.getState().current!
    const movedStop = updated.stops.find((s) => s.hex === '#00ff00')!
    expect(movedStop.position).toBe(100)
  })

  it('exiting preserves exact custom positions without re-equalizing', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 10 })

    fireEvent.click(screen.getByLabelText('Back'))
    expect(onExit).toHaveBeenCalledTimes(1)

    const updated = useAppStore.getState().current!
    const movedStop = updated.stops.find((s) => s.hex === '#00ff00')!
    expect(movedStop.position).toBe(100)
  })

  it('wraps geometry tabs, controller, and swatch tray in a bottom sheet container', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = screen.getByTestId('edit-sheet')
    expect(sheet).toContainElement(screen.getByTestId('flow-editor'))
  })

  it('renders a grabber handle at the top of the sheet that exits edit mode when tapped', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const handle = screen.getByTestId('sheet-handle')
    expect(screen.getByTestId('edit-sheet')).toContainElement(handle)
    fireEvent.click(handle)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('does not exit when tapping the sort FAB, and still cycles the sort', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const fab = screen.getByTestId('sort-fab')
    fireEvent.pointerDown(fab, { clientX: 20, clientY: 20 })
    fireEvent.pointerUp(fab, { clientX: 20, clientY: 20 })
    fireEvent.click(fab)
    expect(onExit).not.toHaveBeenCalled()
    expect(useAppStore.getState().current).not.toBeNull()
  })

  it('does not exit when the pointer moved more than a tap threshold over the preview', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const preview = screen.getByTestId('edit-mode-preview')
    fireEvent.pointerDown(preview, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(preview, { clientX: 100, clientY: 300 })
    expect(onExit).not.toHaveBeenCalled()
  })

  it('exits when the sheet is dragged down past 30% of its height', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = screen.getByTestId('edit-sheet')
    Object.defineProperty(sheet, 'offsetHeight', { configurable: true, value: 200 })

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 200 }] })
    fireEvent.touchEnd(sheet)

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('skips the drag-to-dismiss gesture at tablet/desktop widths (matchMedia min-width: 768px matches)', () => {
    const onExit = vi.fn()
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = screen.getByTestId('edit-sheet')
    Object.defineProperty(sheet, 'offsetHeight', { configurable: true, value: 200 })

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 200 }] })
    fireEvent.touchEnd(sheet)

    expect(onExit).not.toHaveBeenCalled()
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 768px)')
    vi.unstubAllGlobals()
  })

  it('does not exit for a small sheet drag, and restores the sheet height', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = screen.getByTestId('edit-sheet')
    Object.defineProperty(sheet, 'offsetHeight', { configurable: true, value: 200 })

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 130 }] })
    fireEvent.touchEnd(sheet)

    expect(onExit).not.toHaveBeenCalled()
    expect(sheet.style.height).toBe('')
  })

  it('tapping a stop handle selects it, and tapping a swatch replaces its color in-place', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const handle = screen.getAllByTestId('flow-handle')[0]
    expect(handle).toBeInTheDocument()

    // Tap the handle
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0 })

    // Check if it is selected (has active class)
    expect(handle.className).toContain('handleActive')

    // Tap a swatch (e.g. index 5)
    const swatch = screen.getAllByTestId('swatch')[5]
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(swatch, { clientX: 0, clientY: 0 })

    // Verify that the color of the first stop has been updated to match the swatch's color
    const updated = useAppStore.getState().current!
    expect(updated.stops[0].hex).not.toBe('#ff0000') // Initially #ff0000
    
    // Tapping again outside (on the sheet background) should clear the selection
    const sheet = screen.getByTestId('edit-sheet')
    fireEvent.pointerDown(sheet)
    expect(handle.className).not.toContain('handleActive')
  })

  it('pressing Backspace or Delete on the selected stop handle removes the stop', () => {
    const custom: Gradient = {
      id: 'g5',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#00ff00', position: 50 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    useAppStore.setState({ current: custom })
    render(<EditMode gradient={custom} onExit={vi.fn()} />)

    const handles = screen.getAllByTestId('flow-handle')
    expect(handles).toHaveLength(3)

    // Select second handle
    fireEvent.pointerDown(handles[1], { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handles[1], { clientX: 0, clientY: 0 })

    // Press Backspace
    fireEvent.keyDown(handles[1], { key: 'Backspace' })

    // Verify stop is removed
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(2)
  })
})
