import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { EditMode, clampWithRubberBand, chooseDetent } from './EditMode'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

/** jsdom has no layout, so the sheet's two detents have to be declared.
 * `peek` is what the collapsed sheet measures; `open` is its full content. */
function sizeSheet(sheet: HTMLElement, { peek, open }: { peek: number; open: number }) {
  let current = peek
  Object.defineProperty(sheet, 'offsetHeight', {
    configurable: true,
    // Reads back whatever the drag last wrote, so the settle decision sees a
    // real height rather than the constant 0 jsdom would otherwise report.
    get: () => (sheet.style.height ? parseFloat(sheet.style.height) : current),
    set: (v: number) => { current = v },
  })
  Object.defineProperty(sheet, 'scrollHeight', { configurable: true, get: () => open })
}

/** The sheet now opens OPEN on every layout, so this is just a handle on it.
 * Kept as a named step so the tests that need the open state say so. */
function openSheet(): HTMLElement {
  return screen.getByTestId('edit-sheet')
}

/** Drop the sheet to its peek — the state entering edit mode used to start in.
 * Tapping the handle is how a user gets there without a drag. */
function collapseSheet(): HTMLElement {
  fireEvent.click(screen.getByTestId('sheet-handle'))
  return screen.getByTestId('edit-sheet')
}

/** Drive the gesture with a controlled clock.
 *
 * fireEvent ignores a `timeStamp` in its init (Event.timeStamp is readonly),
 * so events fired back to back land microseconds apart and EVERY drag reads as
 * a flick. Stubbing performance.now is what makes the position rule and the
 * flick rule separately testable — `msPerStep` large is a slow deliberate
 * drag, small is a flick.
 */
function drag(sheet: HTMLElement, fromY: number, toY: number, msPerStep = 500) {
  const real = performance.now
  let t = 0
  performance.now = () => t
  try {
    fireEvent.touchStart(sheet, { touches: [{ clientY: fromY }] })
    t += msPerStep
    fireEvent.touchMove(sheet, { touches: [{ clientY: (fromY + toY) / 2 }] })
    t += msPerStep
    fireEvent.touchMove(sheet, { touches: [{ clientY: toY }] })
    fireEvent.touchEnd(sheet)
  } finally {
    performance.now = real
  }
}

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
    // The swatch tray is gone; colors are added by tapping a blank spot on the
    // flow editor track, and recolored via the hidden native color input.
    expect(screen.queryAllByTestId('swatch')).toHaveLength(0)
    expect(screen.getByTestId('color-input')).toBeInTheDocument()
  })

  it('shows the scroll-position ticker when editing from the Create feed', () => {
    useAppStore.setState({ editEnteredFrom: 'create' })
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('scroll-ticker')).toBeInTheDocument()
  })

  it('hides the scroll-position ticker when editing a gradient from the Gallery', () => {
    useAppStore.setState({ editEnteredFrom: 'gallery' })
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

  it('toggling reversed inverts stop colors in place (100 - position, then sorted)', () => {
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
    // handleToggleReversed physically flips positions (100 - pos).
    // toGradientStops sorts them, resulting in reversed colors at flipped positions.
    // 5 -> 95, 40 -> 60, 95 -> 5.
    // So the new stops are: blue at 5, green at 60, red at 95.
    expect(updated.stops.map((s) => ({ hex: s.hex, position: s.position }))).toEqual([
      { hex: '#0000ff', position: 5 },
      { hex: '#00ff00', position: 60 },
      { hex: '#ff0000', position: 95 }
    ])
  })

  it('tapping the repeat and hard filter chips toggles them on the store, preserving positions', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('filter-repeat'))
    expect(useAppStore.getState().current!.repeatEnabled).toBe(true)
    fireEvent.click(screen.getByTestId('filter-hard'))
    expect(useAppStore.getState().current!.hardStops).toBe(true)
    expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([0, 50, 100])
  })

  it('tapping the already-active tab inverts stop colors (toggle reversed)', () => {
    const { rerender } = render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const beforeHex = useAppStore.getState().current!.stops.map((s) => s.hex)
    fireEvent.click(screen.getByText('Linear'))
    
    // handleToggleReversed maps pos to 100 - pos, then toGradientStops sorts by pos.
    // The net effect is the color array is reversed.
    const afterHex = useAppStore.getState().current!.stops.map((s) => s.hex)
    expect(afterHex).toEqual([...beforeHex].reverse())

    rerender(<EditMode gradient={useAppStore.getState().current!} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    // Double-invert restores original colors
    const restoredHex = useAppStore.getState().current!.stops.map((s) => s.hex)
    expect(restoredHex).toEqual(beforeHex)
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

  it('tapping a blank spot on the flow track opens the picker and adds a stop', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    // Colors are added by tapping a blank spot on the flow editor track
    // (FlowEditor's onAddStopAt), then picking a color from the native input.
    const flowEditor = screen.getByTestId('flow-editor')
    fireEvent.pointerDown(flowEditor, { clientX: 50, clientY: 5 })
    fireEvent.change(screen.getByTestId('color-input'), { target: { value: '#abcdef' } })

    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(4)
    expect(updated.stops.some((s) => s.hex === '#abcdef')).toBe(true)
  })

  it('renders an order control showing the ACTIVE order, cycling Original -> Lightness -> Chroma -> Hue -> Original', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)

    // sort-button lives in the bottom sheet, not the preview canvas.
    const sheet = screen.getByTestId('edit-sheet')
    const fab = screen.getByTestId('sort-button')
    expect(sheet).toContainElement(fab)
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
    const fab = screen.getByTestId('sort-button')
    fireEvent.click(fab) // lightness
    fireEvent.click(fab) // chroma
    fireEvent.click(fab) // hue
    fireEvent.click(fab) // original
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#00ff00', '#0000ff', '#ff0000'])
  })

  it('tapping the sort button sorts stops by the labeled key', () => {
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
    fireEvent.click(screen.getByTestId('sort-button')) // applies lightness
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
    fireEvent.click(screen.getByTestId('sort-button'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })

  it('sorting re-ranks the colours across the placements, leaving them alone', () => {
    // Two independent things: which colour comes first, and where the stops
    // sit. Sorting used to run through equalizePositions, which assigns
    // positions by array index — so re-ranking a palette whose stops had been
    // dragged into place threw that placement away and re-spaced it evenly.
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
    fireEvent.click(screen.getByTestId('sort-button'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.position)).toEqual([5, 40, 95])
    // Re-ranked dark -> mid -> light, onto the ladder that was already there.
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })

  it('keeps the on-screen flow handles on their placements through a sort', () => {
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
    fireEvent.click(screen.getByTestId('sort-button'))
    const handles = screen.getAllByRole('slider')
    expect(handles.map((h) => h.getAttribute('aria-valuenow'))).toEqual(['5', '40', '95'])
  })

  it('carries the placements through every step of the order cycle and back', () => {
    // Original -> lightness -> chroma -> hue -> original. A ladder that
    // survived one sort but not the round trip would still lose the placement,
    // just later.
    const unequalPositions: Gradient = {
      id: 'g3c',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 5 },
        { hex: '#00ff00', position: 40 },
        { hex: '#ff0000', position: 95 },
      ],
      reversed: false,
    }
    render(<EditMode gradient={unequalPositions} onExit={vi.fn()} />)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('sort-button'))
      expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([5, 40, 95])
    }
    // Back at Original, with the colours in the order they started.
    expect(screen.getByTestId('sort-button').textContent).toBe('Order: Original')
    expect(useAppStore.getState().current!.stops.map((s) => s.hex))
      .toEqual(['#0000ff', '#00ff00', '#ff0000'])
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

  it('wraps geometry tabs, flow editor, and sort control in a bottom sheet container', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = screen.getByTestId('edit-sheet')
    expect(sheet).toContainElement(screen.getByTestId('flow-editor'))
    expect(sheet).toContainElement(screen.getByTestId('sort-button'))
  })

  it('opens with the colour stops in reach on the mobile bottom-sheet layout', () => {
    // It used to start at the peek, which shows the Shape/Effect switch and one
    // section and nothing else — so tapping a gradient to edit it gave you six
    // shape buttons and no stops, and the stops needed a second tap on a 4px
    // grab handle to find. Opening with the controls you came for beats opening
    // with a bigger picture of the gradient you were already looking at.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = screen.getByTestId('edit-sheet')
    expect(sheet.className).not.toMatch(/collapsed/)
    expect(sheet).toContainElement(screen.getByTestId('flow-editor'))
    vi.unstubAllGlobals()
  })

  it('starts expanded on the desktop side-panel layout, which never collapses', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('edit-sheet').className).not.toMatch(/collapsed/)
    vi.unstubAllGlobals()
  })

  it('tapping the handle on mobile toggles the peek rather than exiting', () => {
    const onExit = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = screen.getByTestId('edit-sheet')
    expect(sheet.className).not.toMatch(/collapsed/)
    fireEvent.click(screen.getByTestId('sheet-handle'))
    expect(sheet.className).toMatch(/collapsed/)
    fireEvent.click(screen.getByTestId('sheet-handle'))
    expect(sheet.className).not.toMatch(/collapsed/)
    expect(onExit).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('puts the Order control in the modifier chip row, not its own row', () => {
    // It is a modifier like Repeat/Smooth/Hard/Rotate, and its own row cost
    // the mobile sheet 91px that the preview needed back.
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sort = screen.getByTestId('sort-button')
    expect(sort.closest('[data-noscroll-hide="true"]')).not.toBeNull()
    expect(sort).toHaveAttribute('aria-label', 'Stop order: original. Tap to change')
    expect(sort.textContent).toBe('Order: Original')
  })

  it('renders a grabber handle at the top of the sheet that exits on desktop', () => {
    const onExit = vi.fn()
    // On desktop (min-width: 768px matches), tapping the handle exits.
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const handle = screen.getByTestId('sheet-handle')
    expect(screen.getByTestId('edit-sheet')).toContainElement(handle)
    fireEvent.click(handle)
    expect(onExit).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('does not exit when tapping the sort button, and still cycles the sort', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const fab = screen.getByTestId('sort-button')
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

  it('settles to the peek (not an exit) when the open sheet is dragged most of the way down', async () => {
    const onExit = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = openSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })

    drag(sheet, 100, 280)

    // Collapses to the full-screen gradient view, still in edit mode. Only a
    // deliberate Back/Esc leaves edit mode.
    await waitFor(() => expect(sheet.className).toContain('collapsed'))
    expect(onExit).not.toHaveBeenCalled()
    // And the drag never leaves an inline height behind to fight the class.
    expect(sheet.style.height).toBe('')
    vi.unstubAllGlobals()
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

  it('opens the collapsed sheet when it is dragged up', () => {
    // The peek used to be a one-way door: the drag gesture only handled
    // downward, so the only ways out were a 4px-tall grab handle or tapping
    // the gradient. Pulling up on it opens the panel.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = collapseSheet()
    expect(sheet.className).toContain('collapsed')

    fireEvent.touchStart(sheet, { touches: [{ clientY: 500 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 450 }] })
    fireEvent.touchEnd(sheet)

    expect(sheet.className).not.toContain('collapsed')
    vi.unstubAllGlobals()
  })

  it('treats a wobble under the slop as a tap, not a drag', async () => {
    // The handle's own click toggles the sheet; a thumb that shifts a few
    // pixels while tapping it must not also start moving the sheet.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = collapseSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })

    drag(sheet, 500, 496)

    expect(sheet.className).toContain('collapsed')
    expect(sheet.className).not.toContain('dragging')
    expect(sheet.style.height).toBe('')
    vi.unstubAllGlobals()
  })

  it('answers a downward drag on the collapsed sheet with resistance, not silence', async () => {
    // There is nothing below the peek, but doing NOTHING is what made the
    // sheet feel broken — "sometimes it does something and sometimes it
    // doesn't". It now tracks the thumb with a rubber band and returns.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = collapseSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })

    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 300 }], timeStamp: 100 })

    // It moved — and stayed within a rubber band of the peek rather than
    // sliding to somewhere it cannot rest.
    const mid = parseFloat(sheet.style.height)
    expect(mid).toBeLessThan(100)
    expect(mid).toBeGreaterThan(20)

    fireEvent.touchEnd(sheet)

    await waitFor(() => expect(sheet.className).toContain('collapsed'))
    expect(sheet.style.height).toBe('')
    expect(onExit).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('runs the whole cycle on one gesture: peek -> open -> back, with short drags returning', async () => {
    // The point of the rebuild. Every quadrant is the same gesture, so a round
    // trip is one test rather than four with different rules.
    const onExit = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const sheet = collapseSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })
    expect(sheet.className).toContain('collapsed')

    // Pull up most of the way: opens. Wait on the inline height clearing —
    // that is the end of the settle. The collapsed class drops the moment the
    // drag starts, so waiting on it would pass mid-gesture.
    drag(sheet, 400, 220)
    await waitFor(() => expect(sheet.style.height).toBe(''))
    expect(sheet.className).not.toContain('collapsed')

    // A short pull down from open does not reach the halfway mark: stays open.
    drag(sheet, 100, 130)
    await waitFor(() => expect(sheet.style.height).toBe(''))
    expect(sheet.className).not.toContain('collapsed')

    // All the way down: back to the peek.
    drag(sheet, 100, 280)
    await waitFor(() => expect(sheet.style.height).toBe(''))
    expect(sheet.className).toContain('collapsed')

    expect(onExit).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
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

  it('still cycles shapes with arrows when a control button holds focus', () => {
    const custom: Gradient = {
      id: 'g6b',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    useAppStore.setState({ current: custom })
    render(<EditMode gradient={custom} onExit={vi.fn()} />)

    // A geometry tab (or any control button) is focused after tapping it.
    const button = screen.getByRole('button', { name: 'Radial' })
    button.focus()
    fireEvent.keyDown(button, { key: 'ArrowRight' })
    expect(useAppStore.getState().current!.type).toBe('radial')

    // Space, however, is left to the focused button so it can activate.
    fireEvent.keyDown(button, { key: ' ' })
    expect(useAppStore.getState().current!.type).toBe('radial')
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

  it('hides all non-handle UI (sheet, back button) while a handle drag is active, restores them after', () => {
    vi.useFakeTimers()
    try {
      render(<EditMode gradient={gradient} onExit={vi.fn()} />)
      const preview = screen.getByTestId('edit-mode-preview')
      vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, toJSON() {},
      } as DOMRect)
      // The sheet (which contains sort-button) and back button get the hidden
      // class; sort-button itself doesn't carry hidden — its parent sheet does.
      const sheet = screen.getByTestId('edit-sheet')
      const backButton = screen.getByTestId('edit-mode-back')
      expect(sheet.className).not.toMatch(/hidden/)
      expect(backButton.className).not.toMatch(/hidden/)

      const firstHandle = screen.getAllByTestId(/^canvas-handle-(?!visible|near)/)[0]
      fireEvent.pointerDown(firstHandle, { pointerId: 1, clientX: 100, clientY: 0 })
      // Wait out the hold delay, then move past the threshold to arm the drag.
      act(() => {
        vi.advanceTimersByTime(200)
      })
      fireEvent.pointerMove(firstHandle, { pointerId: 1, buttons: 1, clientX: 100, clientY: 200 })
      // Drag armed: all surrounding UI ducks out of the way.
      expect(sheet.className).toMatch(/hidden/)
      expect(backButton.className).toMatch(/hidden/)

      fireEvent.pointerUp(firstHandle, { pointerId: 1, clientX: 100, clientY: 0 })
      expect(sheet.className).not.toMatch(/hidden/)
      expect(backButton.className).not.toMatch(/hidden/)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the sheet gesture, as arithmetic', () => {
  // Extracted from the drag handler so the two rules that decide where the
  // sheet ends up can be checked without a layout engine.
  describe('clampWithRubberBand', () => {
    it('passes values between the detents straight through', () => {
      expect(clampWithRubberBand(150, 100, 300)).toBe(150)
      expect(clampWithRubberBand(100, 100, 300)).toBe(100)
      expect(clampWithRubberBand(300, 100, 300)).toBe(300)
    })

    it('gives past a detent instead of stopping dead', () => {
      // The old sheet did nothing at all here, which is what "sometimes it
      // doesn't do anything" meant. It should move, just not freely.
      const below = clampWithRubberBand(0, 100, 300)
      expect(below).toBeLessThan(100)
      expect(below).toBeGreaterThan(0)

      const above = clampWithRubberBand(400, 100, 300)
      expect(above).toBeGreaterThan(300)
      expect(above).toBeLessThan(400)
    })

    it('resists more the further past the end it is pushed', () => {
      const near = 100 - clampWithRubberBand(50, 100, 300)
      const far = 100 - clampWithRubberBand(0, 100, 300)
      expect(far).toBeGreaterThan(near)
      // Never a free ride: the overshoot is always a fraction of the drag.
      expect(far).toBeLessThan(100)
    })
  })

  describe('chooseDetent', () => {
    it('settles to whichever detent is nearer', () => {
      expect(chooseDetent(120, 100, 300, 0)).toBe('peek')
      expect(chooseDetent(280, 100, 300, 0)).toBe('open')
    })

    it('gives an exact halfway release to open — the sheet is the controls', () => {
      expect(chooseDetent(200, 100, 300, 0)).toBe('open')
    })

    it('lets a fast flick beat position, in both directions', () => {
      // Thrown down from nearly open: goes to the peek anyway.
      expect(chooseDetent(290, 100, 300, 2)).toBe('peek')
      // Thrown up from nearly closed: opens anyway.
      expect(chooseDetent(110, 100, 300, -2)).toBe('open')
    })

    it('ignores a slow drift, however long', () => {
      expect(chooseDetent(290, 100, 300, 0.1)).toBe('open')
      expect(chooseDetent(110, 100, 300, -0.1)).toBe('peek')
    })
  })
})

describe('EditMode sheet — one gesture in every direction', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens on a short upward flick, which position alone would have refused', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = collapseSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })

    // 20px of travel, thrown fast. Nearest-detent would keep this at the peek.
    drag(sheet, 400, 380, 4)

    return waitFor(() => {
      expect(sheet.style.height).toBe('')
      expect(sheet.className).not.toContain('collapsed')
    })
  })

  it('marks the sheet as dragging so the collapsed class stops clipping mid-gesture', () => {
    // The collapsed class hides the lower half with display:none, which cannot
    // be interpolated through — dropping it for the drag is what makes the
    // reveal continuous rather than a jump at a threshold.
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = collapseSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })

    fireEvent.touchStart(sheet, { touches: [{ clientY: 400 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 340 }] })

    expect(sheet.className).toContain('dragging')
    expect(sheet.className).not.toContain('collapsed')
    // Tracking the thumb, not jumping to a detent.
    expect(parseFloat(sheet.style.height)).toBeGreaterThan(100)
    expect(parseFloat(sheet.style.height)).toBeLessThan(300)

    fireEvent.touchEnd(sheet)
  })

  it('never slides past the peek and springs back, which is what read as broken', async () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = openSheet()
    sizeSheet(sheet, { peek: 100, open: 300 })

    // Pull 350px when only 200px of travel exists.
    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 450 }] })

    // Held near the peek, resisting. The old sheet shrank freely toward zero
    // and then jumped back up to the peek on release — the "it slides but not
    // all the way down" complaint was that spring.
    const held = parseFloat(sheet.style.height)
    expect(held).toBeLessThan(100)
    expect(held).toBeGreaterThan(0)
    // Far short of where an unclamped drag would have put it (300 - 350).
    expect(held).toBeGreaterThan(300 - 350)

    fireEvent.touchEnd(sheet)
    await waitFor(() => expect(sheet.style.height).toBe(''))
    expect(sheet.className).toContain('collapsed')
  })

  it('leaves a drag that starts on a flow handle alone', () => {
    // Stop handles own their own vertical gesture (drag-to-delete).
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const sheet = screen.getByTestId('edit-sheet')
    sizeSheet(sheet, { peek: 100, open: 300 })
    const handle = screen.getAllByTestId('flow-handle')[0]

    // Fired ON the handle so it bubbles to the sheet with the handle as the
    // real target — a `target` in fireEvent's init does not reassign it.
    fireEvent.touchStart(handle, { touches: [{ clientY: 400 }] })
    fireEvent.touchMove(handle, { touches: [{ clientY: 300 }] })

    expect(sheet.style.height).toBe('')
    expect(sheet.className).not.toContain('dragging')
  })
})
