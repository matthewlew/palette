import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { EditMode } from './EditMode'
import { useAppStore } from '../store/useAppStore'
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
  it('renders the preview, geometry tabs, flow handles, and color controls', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('edit-mode-preview')).toBeInTheDocument()
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
    // The swatch tray is gone; explicit color comes from the Add color button
    // and the (hidden) native color input.
    expect(screen.queryAllByTestId('swatch')).toHaveLength(0)
    expect(screen.getByTestId('add-color')).toBeInTheDocument()
    expect(screen.getByTestId('color-input')).toBeInTheDocument()
  })

  it('shows the scroll-position ticker when editing from the Create feed', () => {
    useAppStore.setState({ editReturnMode: 'create' })
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('scroll-ticker')).toBeInTheDocument()
  })

  it('hides the scroll-position ticker when editing a gradient from the Gallery', () => {
    useAppStore.setState({ editReturnMode: 'gallery' })
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.queryByTestId('scroll-ticker')).not.toBeInTheDocument()
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

  it('tapping a stop opens the color picker and recoloring updates it in place', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const handles = screen.getAllByTestId('flow-handle')
    // Tap the middle stop (#00ff00 at 50%) — a pointerdown/up within the tap
    // threshold, not a drag.
    fireEvent.pointerDown(handles[1], { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handles[1], { clientX: 10, clientY: 10 })
    fireEvent.change(screen.getByTestId('color-input'), { target: { value: '#123456' } })

    const updated = useAppStore.getState().current!
    // In-place recolor: count and positions untouched, only the tapped hex.
    expect(updated.stops).toHaveLength(3)
    expect(updated.stops.map((s) => s.position)).toEqual([0, 50, 100])
    expect(updated.stops[1].hex).toBe('#123456')
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

  it('renders a save pill on the gradient (not in the sheet) that toggles the saved state', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const saveButton = screen.getByTestId('like-button')
    expect(saveButton.textContent).toBe('Save')
    // The pill sits on the gradient preview, not inside the bottom sheet.
    expect(screen.getByTestId('edit-mode-preview').contains(saveButton)).toBe(true)
    expect(screen.getByTestId('edit-sheet').contains(saveButton)).toBe(false)

    fireEvent.click(saveButton)
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(saveButton.textContent).toBe('✓ Saved')
  })

  it('Add color opens the picker and appends a new stop with the chosen color', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('add-color'))
    fireEvent.change(screen.getByTestId('color-input'), { target: { value: '#abcdef' } })

    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(4)
    expect(updated.stops.some((s) => s.hex === '#abcdef')).toBe(true)
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

  it('shows the edit hint on mount and dismisses it on pointerdown anywhere in edit mode', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a color to recolor')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('edit-mode'))

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
  })

  it('auto-dismisses the edit hint after 4 seconds', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a color to recolor')).toBeInTheDocument()

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

  it('wraps geometry tabs, flow editor, and color controls in a bottom sheet container', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = screen.getByTestId('edit-sheet')
    expect(sheet).toContainElement(screen.getByTestId('flow-editor'))
    expect(sheet).toContainElement(screen.getByTestId('add-color'))
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

  it('tapping a stop handle selects it and recolors it in place via the color picker', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const handle = screen.getAllByTestId('flow-handle')[0]
    expect(handle).toBeInTheDocument()

    // Tap the handle — selects it (active class) and arms the color picker.
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0 })
    expect(handle.className).toContain('handleActive')

    // Committing a color from the (hidden) native picker recolors this stop.
    fireEvent.change(screen.getByTestId('color-input'), { target: { value: '#00ffee' } })
    const updated = useAppStore.getState().current!
    expect(updated.stops[0].hex).toBe('#00ffee') // Initially #ff0000

    // Tapping the sheet background clears the selection.
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

  it('cycles shapes via ArrowLeft/Right and flips orientation via F in EditMode', () => {
    const custom: Gradient = {
      id: 'g6',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    useAppStore.setState({ current: custom })
    render(<EditMode gradient={custom} onExit={vi.fn()} />)

    // Press ArrowRight to cycle type forward
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    let updated = useAppStore.getState().current!
    expect(updated.type).toBe('radial')

    // Press ArrowLeft to cycle type backward
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    updated = useAppStore.getState().current!
    expect(updated.type).toBe('linear')

    // Press F to flip orientation
    fireEvent.keyDown(window, { key: 'f' })
    updated = useAppStore.getState().current!
    expect(updated.reversed).toBe(true)

    // Press F to flip orientation back
    fireEvent.keyDown(window, { key: 'f' })
    updated = useAppStore.getState().current!
    expect(updated.reversed).toBe(false)
  })
})

describe('EditMode canvas handles', () => {
  it('mounts CanvasHandles over the preview canvas', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('canvas-handles')).toBeInTheDocument()
  })

  it('renders 4 handle dots per stop for radial, and no direction toggle arrow buttons are needed', () => {
    const { rerender } = render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.queryByTestId('direction-toggle')).not.toBeInTheDocument()
    rerender(<EditMode gradient={{ ...gradient, type: 'radial' }} onExit={vi.fn()} />)
    expect(screen.queryByTestId('direction-toggle')).not.toBeInTheDocument()
    // For 2 stops in radial, there should be 2 * 4 = 8 handle buttons rendered
    const handles = screen.getAllByTestId(/^canvas-handle-(?!visible|near)/)
    expect(handles.length).toBe(gradient.stops.length * 4)
  })

  it('reordering via a canvas handle updates the live gradient stop order', () => {
    vi.useFakeTimers()
    try {
      render(<EditMode gradient={gradient} onExit={vi.fn()} />)
      const preview = screen.getByTestId('edit-mode-preview')
      // Give the preview a real layout box so getBoundingClientRect-derived
      // cursor/size math is well-defined in jsdom.
      vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, toJSON() {},
      } as DOMRect)
      fireEvent.pointerMove(preview, { clientX: 100, clientY: 0 })
      const firstHandle = screen.getAllByTestId(/^canvas-handle-(?!visible|near)/)[0]
      fireEvent.pointerDown(firstHandle, { pointerId: 1, clientX: 100, clientY: 0 })
      // Wait out the hold delay that arms a drag (scroll-vs-drag intent).
      act(() => {
        vi.advanceTimersByTime(200)
      })
      fireEvent.pointerMove(firstHandle, { pointerId: 1, buttons: 1, clientX: 100, clientY: 200 })
      fireEvent.pointerUp(firstHandle, { pointerId: 1, clientX: 100, clientY: 200 })
      // The originally-first stop's hex should no longer be at position 0.
      const stops = useAppStore.getState().current!.stops
      expect(stops[0].hex).not.toBe(gradient.stops[0].hex)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hides all non-handle UI (FABs, sheet, back button) while a handle drag is active, restores them after', () => {
    vi.useFakeTimers()
    try {
      render(<EditMode gradient={gradient} onExit={vi.fn()} />)
      const preview = screen.getByTestId('edit-mode-preview')
      vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, toJSON() {},
      } as DOMRect)
      const sortFab = screen.getByTestId('sort-fab')
      const sheet = screen.getByTestId('edit-sheet')
      const backButton = screen.getByTestId('edit-mode-back')
      expect(sortFab.className).not.toMatch(/hidden/)
      expect(sheet.className).not.toMatch(/hidden/)
      expect(backButton.className).not.toMatch(/hidden/)

      const firstHandle = screen.getAllByTestId(/^canvas-handle-(?!visible|near)/)[0]
      fireEvent.pointerDown(firstHandle, { pointerId: 1, clientX: 100, clientY: 0 })
      act(() => {
        vi.advanceTimersByTime(200)
      })
      // Drag armed: all surrounding UI ducks out of the way.
      expect(sortFab.className).toMatch(/hidden/)
      expect(sheet.className).toMatch(/hidden/)
      expect(backButton.className).toMatch(/hidden/)

      fireEvent.pointerUp(firstHandle, { pointerId: 1, clientX: 100, clientY: 0 })
      expect(sortFab.className).not.toMatch(/hidden/)
      expect(sheet.className).not.toMatch(/hidden/)
      expect(backButton.className).not.toMatch(/hidden/)
    } finally {
      vi.useRealTimers()
    }
  })
})
