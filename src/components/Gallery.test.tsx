import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

const savedGradients: Gradient[] = [
  {
    id: 'g1',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
    name: 'Saved Palette One',
  },
]

describe('Gallery component viewer interactions', () => {
  beforeEach(() => {
    useAppStore.setState({
      saved: savedGradients,
      mode: 'gallery',
    })
  })

  it('opens full-screen viewer on tile click, closes on background click, and keeps open on panel click', async () => {
    render(<Gallery onRiff={vi.fn()} />)

    // Verify tile is present
    const tile = screen.getByRole('button', { name: /Saved Palette One,/ })
    expect(tile).toBeInTheDocument()

    // Click tile to open Viewer
    fireEvent.click(tile)
    const viewer = screen.getByTestId('gallery-viewer')
    expect(viewer).toBeInTheDocument()

    // Clicking the title (the rename affordance) should NOT close it
    fireEvent.click(screen.getByTestId('palette-title-button'))
    expect(screen.queryByTestId('gallery-viewer')).toBeInTheDocument()

    // Clicking the background gradient itself (the outer viewer) should close it
    fireEvent.click(viewer)
    await waitFor(() => {
      expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument()
    })
  })

  it('closes full-screen viewer when the Close (✕) button is clicked', () => {
    render(<Gallery onRiff={vi.fn()} />)

    const tile = screen.getByRole('button', { name: /Saved Palette One,/ })
    fireEvent.click(tile)

    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()

    fireEvent.click(closeBtn)
    expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument()
  })

  const twoGradients: Gradient[] = [
    { id: 'n1', type: 'linear', stops: savedGradients[0].stops, name: 'First Palette' },
    { id: 'n2', type: 'linear', stops: savedGradients[0].stops, name: 'Second Palette' },
  ]

  it('scrolling steps between gradients without triggering edit', () => {
    const onRiff = vi.fn()
    useAppStore.setState({ saved: twoGradients, mode: 'gallery' })
    render(<Gallery onRiff={onRiff} />)
    fireEvent.click(screen.getByRole('button', { name: /First Palette,/ }))
    const viewer = screen.getByTestId('gallery-viewer')
    expect(viewer).toHaveAttribute('aria-label', 'First Palette')

    // Wheel down → next gradient
    fireEvent.wheel(viewer, { deltaY: 200 })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'Second Palette')

    // Wheel up → back to the first
    fireEvent.wheel(viewer, { deltaY: -200 })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'First Palette')

    // Scrolling is navigation, never edit
    expect(onRiff).not.toHaveBeenCalled()
    expect(screen.queryByTestId('pull-to-edit-hint')).not.toBeInTheDocument()
  })

  it('does not step past the ends of the list', () => {
    useAppStore.setState({ saved: twoGradients, mode: 'gallery' })
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /First Palette,/ }))
    const viewer = screen.getByTestId('gallery-viewer')

    // Already at the top: wheel up stays put
    fireEvent.wheel(viewer, { deltaY: -200 })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'First Palette')
  })

  it('swiping navigates (up → next, down → previous) and does not close', () => {
    const onRiff = vi.fn()
    useAppStore.setState({ saved: twoGradients, mode: 'gallery' })
    render(<Gallery onRiff={onRiff} />)
    fireEvent.click(screen.getByRole('button', { name: /First Palette,/ }))
    const viewer = screen.getByTestId('gallery-viewer')

    // Swipe up → next
    fireEvent.touchStart(viewer, { touches: [{ clientY: 500 }] })
    fireEvent.touchEnd(viewer, { changedTouches: [{ clientY: 300 }] })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'Second Palette')

    // Swipe down → previous (does not close the viewer)
    fireEvent.touchStart(viewer, { touches: [{ clientY: 300 }] })
    fireEvent.touchEnd(viewer, { changedTouches: [{ clientY: 500 }] })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'First Palette')
    expect(onRiff).not.toHaveBeenCalled()
  })

  it('labels the scroll ticker with the gradient name, not a number', () => {
    useAppStore.setState({ saved: twoGradients, mode: 'gallery' })
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /First Palette,/ }))
    expect(screen.getByTestId('ticker-count')).toHaveTextContent('First Palette')

    fireEvent.wheel(screen.getByTestId('gallery-viewer'), { deltaY: 200 })
    expect(screen.getByTestId('ticker-count')).toHaveTextContent('Second Palette')
  })

  it('arrow keys step between gradients', () => {
    useAppStore.setState({ saved: twoGradients, mode: 'gallery' })
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /First Palette,/ }))
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'First Palette')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'Second Palette')

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.getByTestId('gallery-viewer')).toHaveAttribute('aria-label', 'First Palette')
  })
})

describe('Gallery grid keyboard navigation', () => {
  const threeGradients: Gradient[] = [
    {
      id: 'g1',
      type: 'linear',
      stops: [{ hex: '#ff0000', position: 0 }, { hex: '#0000ff', position: 100 }],
      name: 'Tile One',
    },
    {
      id: 'g2',
      type: 'linear',
      stops: [{ hex: '#00ff00', position: 0 }, { hex: '#ffff00', position: 100 }],
      name: 'Tile Two',
    },
    {
      id: 'g3',
      type: 'linear',
      stops: [{ hex: '#00ffff', position: 0 }, { hex: '#ff00ff', position: 100 }],
      name: 'Tile Three',
    },
  ]

  beforeEach(() => {
    useAppStore.setState({
      saved: threeGradients,
      mode: 'gallery',
    })
  })

  it('navigates focus between grid items via arrow keys', () => {
    render(<Gallery onRiff={vi.fn()} />)

    const tile1 = screen.getByRole('button', { name: /Tile One,/ })
    const tile2 = screen.getByRole('button', { name: /Tile Two,/ })
    const tile3 = screen.getByRole('button', { name: /Tile Three,/ })

    // Focus first tile
    tile1.focus()
    expect(document.activeElement).toBe(tile1)

    // Press ArrowRight to focus tile 2
    fireEvent.keyDown(tile1, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tile2)

    // Press ArrowRight to focus tile 3
    fireEvent.keyDown(tile2, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tile3)

    // Press ArrowLeft to focus tile 2 again
    fireEvent.keyDown(tile3, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(tile2)

    // Press Home to focus tile 1
    fireEvent.keyDown(tile2, { key: 'Home' })
    expect(document.activeElement).toBe(tile1)

    // Press End to focus tile 3
    fireEvent.keyDown(tile1, { key: 'End' })
    expect(document.activeElement).toBe(tile3)
  })
})

describe('Gallery JSON Import', () => {
  it('renders the share options button, opens the import modal, and triggers onImport prop upon submitting', () => {
    const importSpy = vi.fn()
    render(<Gallery onRiff={vi.fn()} onImport={importSpy} />)

    // Click share trigger
    const shareTrigger = screen.getByRole('button', { name: /share options/i })
    expect(shareTrigger).toBeInTheDocument()
    fireEvent.click(shareTrigger)

    // Import JSON now lives under the "More options" overflow submenu.
    fireEvent.click(screen.getByRole('button', { name: /more options/i }))

    // Click "Import JSON..." menu item
    const importBtn = screen.getByRole('button', { name: /import json/i })
    expect(importBtn).toBeInTheDocument()
    fireEvent.click(importBtn)

    // The modal text area and button should be visible
    const textarea = screen.getByPlaceholderText(/Paste gradient or board JSON…/i)
    expect(textarea).toBeInTheDocument()

    const importSubmitBtn = screen.getByRole('button', { name: /^Import$/ })
    expect(importSubmitBtn).toBeDisabled()

    // Type draft JSON and submit
    fireEvent.change(textarea, { target: { value: '{"gradients": []}' } })
    expect(importSubmitBtn).not.toBeDisabled()

    fireEvent.click(importSubmitBtn)

    // Check if onImport was invoked
    expect(importSpy).toHaveBeenCalledWith('{"gradients": []}')
  })
})

describe('Gallery layout switcher', () => {
  it('toggles layout from grid to masonry and stores preference', () => {
    // Start with grid layout
    useAppStore.setState({ galleryLayout: 'grid' })

    render(<Gallery onRiff={vi.fn()} />)

    // Verify grid layout switcher buttons are in document
    const gridBtn = screen.getByRole('button', { name: /Show grid layout/i })
    const masonryBtn = screen.getByRole('button', { name: /Show Pinterest masonry layout/i })

    expect(gridBtn).toBeInTheDocument()
    expect(masonryBtn).toBeInTheDocument()

    // Click masonry layout button
    fireEvent.click(masonryBtn)

    // Check store updated
    expect(useAppStore.getState().galleryLayout).toBe('masonry')

    // Click grid layout button
    fireEvent.click(gridBtn)

    // Check store updated
    expect(useAppStore.getState().galleryLayout).toBe('grid')
  })
})

describe('Gallery load-in stagger', () => {
  beforeEach(() => {
    useAppStore.setState({
      saved: [
        { id: 'a', type: 'linear', stops: [{ hex: '#000000', position: 0 }, { hex: '#111111', position: 100 }], name: 'A' },
        { id: 'b', type: 'linear', stops: [{ hex: '#ffffff', position: 0 }, { hex: '#eeeeee', position: 100 }], name: 'B' },
        { id: 'c', type: 'linear', stops: [{ hex: '#888888', position: 0 }, { hex: '#777777', position: 100 }], name: 'C' },
      ],
      mode: 'gallery',
    })
  })

  it('staggers tile animationDelay by render order, not color', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const tiles = screen.getAllByTestId('gallery-tile')
    const delays = tiles.map((t) => (t as HTMLElement).style.animationDelay)
    // Index-based: 0ms, 35ms, 70ms in DOM/render order regardless of lightness.
    expect(delays).toEqual(['0ms', '35ms', '70ms'])
  })
})


describe('Gallery drag reorder', () => {
  const g = (id: string, hex: string): Gradient => ({
    id,
    type: 'linear',
    stops: [{ hex, position: 0 }, { hex: '#000000', position: 100 }],
    name: id.toUpperCase(),
  })

  beforeEach(() => {
    useAppStore.setState({ saved: [g('a', '#ff0000'), g('b', '#00ff00'), g('c', '#0000ff')], mode: 'gallery' })
  })

  it('tiles are draggable when no filter is active', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const tiles = screen.getAllByTestId('gallery-tile')
    expect(tiles[0].getAttribute('draggable')).toBe('true')
  })

  it('reorders the saved array when a tile is dropped on another', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const tiles = screen.getAllByTestId('gallery-tile')
    // Drag tile A (index 0) onto tile C (index 2).
    fireEvent.dragStart(tiles[0])
    fireEvent.dragEnter(tiles[2])
    fireEvent.dragOver(tiles[2])
    fireEvent.drop(tiles[2])
    expect(useAppStore.getState().saved.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not make tiles draggable while a type filter is active', () => {
    render(<Gallery onRiff={vi.fn()} />)
    // 'a','b','c' are all linear; click the Linear chip to filter.
    fireEvent.click(screen.getByRole('button', { name: /^Linear/ }))
    const tiles = screen.getAllByTestId('gallery-tile')
    expect(tiles[0].getAttribute('draggable')).toBe('false')
  })
})

describe('Gallery filter control', () => {
  const mixed: Gradient[] = [
    { id: 'a', type: 'linear', stops: [{ hex: '#111111', position: 0 }, { hex: '#eeeeee', position: 100 }], name: 'A' },
    { id: 'b', type: 'linear', stops: [{ hex: '#222222', position: 0 }, { hex: '#dddddd', position: 100 }], name: 'B' },
    { id: 'c', type: 'square', stops: [{ hex: '#333333', position: 0 }, { hex: '#cccccc', position: 100 }], name: 'C' },
  ]

  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
    useAppStore.setState({ saved: mixed, mode: 'gallery' })
  })

  it('offers only shapes that would return something', () => {
    // Seven of the fifteen chips read "0" before this. A filter that leads
    // nowhere is worse than no filter, and on mobile each one cost a row.
    render(<Gallery onRiff={vi.fn()} />)
    const options = [...screen.getByTestId('filter-select').querySelectorAll('option')]
      .map((o) => o.textContent)
    expect(options).toEqual(['All shapes (3)', 'Linear (2)', 'Turrell (1)'])
    expect(options.some((o) => /\(0\)/.test(o!))).toBe(false)
  })

  it('filters the grid by the selected shape', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.change(screen.getByTestId('filter-select'), { target: { value: 'square' } })
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('returns to everything when All is picked', () => {
    render(<Gallery onRiff={vi.fn()} />)
    const select = screen.getByTestId('filter-select')
    fireEvent.change(select, { target: { value: 'square' } })
    fireEvent.change(select, { target: { value: 'all' } })
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('keeps the ACTIVE shape listed even once nothing matches it', () => {
    // Otherwise selecting a shape and then deleting its last palette would
    // make the option vanish from the very control that selects it, stranding
    // the user in a filter they cannot see or clear.
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.change(screen.getByTestId('filter-select'), { target: { value: 'square' } })
    useAppStore.setState({ saved: mixed.filter((g) => g.type !== 'square') })
    const options = [...screen.getByTestId('filter-select').querySelectorAll('option')]
      .map((o) => o.getAttribute('value'))
    expect(options).toContain('square')
  })

  it('renders the chip row too, for the desktop breakpoint to reveal', () => {
    // Both controls are always in the DOM; a media query picks one. The chips
    // must therefore stay in sync with the select's options.
    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Linear/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mirror/ })).not.toBeInTheDocument()
  })
})

describe('Gallery bulk export', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
    useAppStore.setState({ saved: savedGradients, mode: 'gallery' })
  })

  it('offers Export Posts inside the share menu, not as its own header button', () => {
    // As a labelled pill beside the icon-only share trigger it was the odd one
    // out in a row where nothing shared a size, and it is a slow bulk action
    // rather than a primary control.
    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Export Posts/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Share options'))
    fireEvent.click(screen.getByText(/More options/))
    expect(screen.getByTestId('export-all-posts')).toBeInTheDocument()
  })
})
