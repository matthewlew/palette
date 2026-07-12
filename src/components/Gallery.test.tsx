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

describe('Gallery collections', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
    useAppStore.setState({ mode: 'gallery' })
  })

  it('shows a Collections row and opens a board detail view with Open-in-feed', () => {
    const store = useAppStore.getState()
    store.saveGradient({
      id: 's1',
      type: 'linear',
      stops: [
        { hex: '#b5643c', position: 0 },
        { hex: '#3a5a78', position: 100 },
      ],
    })
    const savedId = useAppStore.getState().saved[0].id
    const cid = store.createCollection('Kiln')
    store.addToCollection(cid, savedId)

    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.getByTestId('collections-row')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(`collection-cover-${cid}`))
    expect(screen.getByTestId('collection-detail')).toBeInTheDocument()
    expect(screen.getByTestId('collection-open-in-feed')).toBeInTheDocument()
  })
})
