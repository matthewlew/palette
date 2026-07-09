import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SavedBrowser, sortSaved } from './SavedBrowser'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

const saved: Gradient[] = [
  // red (hue ~29), green (hue ~142), blue (hue ~264) as single-hue palettes
  { id: 'r', name: 'Bravo', type: 'linear', stops: [{ hex: '#ff0000', position: 0 }, { hex: '#ff0000', position: 100 }] },
  { id: 'g', name: 'Alpha', type: 'linear', stops: [{ hex: '#00ff00', position: 0 }, { hex: '#00ff00', position: 100 }] },
  { id: 'b', name: 'Charlie', type: 'linear', stops: [{ hex: '#0000ff', position: 0 }, { hex: '#0000ff', position: 100 }] },
]

beforeEach(() => {
  useAppStore.setState({ saved: [...saved] })
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('sortSaved', () => {
  it('defaults to saved order, untouched', () => {
    expect(sortSaved(saved, 'saved').map((g) => g.id)).toEqual(['r', 'g', 'b'])
  })

  it('sorts most recent first', () => {
    expect(sortSaved(saved, 'recent').map((g) => g.id)).toEqual(['b', 'g', 'r'])
  })

  it('sorts by name alphabetically', () => {
    expect(sortSaved(saved, 'name').map((g) => g.id)).toEqual(['g', 'r', 'b'])
  })

  it('sorts by average hue', () => {
    expect(sortSaved(saved, 'hue').map((g) => g.id)).toEqual(['r', 'g', 'b'])
  })
})

describe('SavedBrowser', () => {
  it('shows the saved count and a labeled sort control defaulting to saved order', () => {
    render(<SavedBrowser saved={saved} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Saved palettes' })).toBeInTheDocument()
    const select = screen.getByLabelText('Sort saved palettes') as HTMLSelectElement
    expect(select.value).toBe('saved')
  })

  it('reorders cards when the sort changes', () => {
    render(<SavedBrowser saved={saved} onSelect={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Sort saved palettes'), { target: { value: 'name' } })
    const names = screen.getAllByTestId('saved-card').map((c) => c.querySelector('button[title="Tap to rename"]')?.textContent)
    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('renames a palette inline via its name field', () => {
    render(<SavedBrowser saved={saved} onSelect={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename Alpha' }))
    const input = screen.getByLabelText('Palette name')
    fireEvent.change(input, { target: { value: 'Meadow Glow' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useAppStore.getState().saved.find((g) => g.id === 'g')?.name).toBe('Meadow Glow')
  })

  it('deletes a palette from its card', () => {
    render(<SavedBrowser saved={saved} onSelect={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bravo' }))
    expect(useAppStore.getState().saved.map((g) => g.id)).toEqual(['g', 'b'])
  })

  it('copies a single-gradient share link from a card', () => {
    render(<SavedBrowser saved={saved} onSelect={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy share link' })[0])
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copiedText).toContain('#d=')
  })

  it('closes when the backdrop is tapped', () => {
    const onClose = vi.fn()
    render(<SavedBrowser saved={saved} onSelect={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('saved-browser-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
