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

  it('triggers edit when the user scrolls up past the threshold (reverse pull-to-refresh)', () => {
    const onRiff = vi.fn()
    render(<Gallery onRiff={onRiff} />)
    fireEvent.click(screen.getByRole('button', { name: /Saved Palette One,/ }))
    const viewer = screen.getByTestId('gallery-viewer')

    // Partial scroll shows the hint but does not trigger
    fireEvent.wheel(viewer, { deltaY: 200 })
    expect(screen.getByTestId('pull-to-edit-hint')).toBeInTheDocument()
    expect(onRiff).not.toHaveBeenCalled()

    // Crossing the threshold triggers edit
    fireEvent.wheel(viewer, { deltaY: 200 })
    expect(onRiff).toHaveBeenCalledTimes(1)
  })

  it('scrolling down does not trigger edit and resets progress', () => {
    const onRiff = vi.fn()
    render(<Gallery onRiff={onRiff} />)
    fireEvent.click(screen.getByRole('button', { name: /Saved Palette One,/ }))
    const viewer = screen.getByTestId('gallery-viewer')

    fireEvent.wheel(viewer, { deltaY: 200 })
    fireEvent.wheel(viewer, { deltaY: -50 })
    expect(screen.queryByTestId('pull-to-edit-hint')).not.toBeInTheDocument()
    // Accumulator was reset, so another partial scroll must not trigger
    fireEvent.wheel(viewer, { deltaY: 200 })
    expect(onRiff).not.toHaveBeenCalled()
  })

  it('swiping up past the threshold triggers edit; swiping down still closes', async () => {
    const onRiff = vi.fn()
    render(<Gallery onRiff={onRiff} />)
    fireEvent.click(screen.getByRole('button', { name: /Saved Palette One,/ }))
    const viewer = screen.getByTestId('gallery-viewer')

    // Swipe up 200px → edit
    fireEvent.touchStart(viewer, { touches: [{ clientY: 500 }] })
    fireEvent.touchEnd(viewer, { changedTouches: [{ clientY: 300 }] })
    expect(onRiff).toHaveBeenCalledTimes(1)

    // Swipe down 200px → close
    fireEvent.touchStart(viewer, { touches: [{ clientY: 300 }] })
    fireEvent.touchEnd(viewer, { changedTouches: [{ clientY: 500 }] })
    await waitFor(() => {
      expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument()
    })
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
