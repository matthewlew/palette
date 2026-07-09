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
