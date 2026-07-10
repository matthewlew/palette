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
    const tile = screen.getByRole('button', { name: /Saved Palette One/ })
    expect(tile).toBeInTheDocument()

    // Click tile to open Viewer
    fireEvent.click(tile)
    const viewer = screen.getByTestId('gallery-viewer')
    expect(viewer).toBeInTheDocument()

    // Clicking inside the details panel should NOT close it
    const panel = screen.getByRole('heading', { name: 'Saved Palette One' }).closest('div')
    expect(panel).toBeInTheDocument()
    fireEvent.click(panel!)
    expect(screen.queryByTestId('gallery-viewer')).toBeInTheDocument()

    // Clicking the background gradient itself (the outer viewer) should close it
    fireEvent.click(viewer)
    await waitFor(() => {
      expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument()
    })
  })

  it('closes full-screen viewer when the Close (✕) button is clicked', () => {
    render(<Gallery onRiff={vi.fn()} />)

    const tile = screen.getByRole('button', { name: /Saved Palette One/ })
    fireEvent.click(tile)

    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()

    fireEvent.click(closeBtn)
    expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument()
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

    const tile1 = screen.getByRole('button', { name: /Tile One/ })
    const tile2 = screen.getByRole('button', { name: /Tile Two/ })
    const tile3 = screen.getByRole('button', { name: /Tile Three/ })

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
