import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'
import type { Gradient } from '../store/types'

const gradients: Gradient[] = [
  { id: 'a', type: 'linear', stops: [{ hex: '#ff0000', position: 0 }, { hex: '#00ff00', position: 100 }] },
  { id: 'b', type: 'radial', stops: [{ hex: '#0000ff', position: 0 }, { hex: '#ffff00', position: 100 }] },
]

describe('Drawer', () => {
  it('renders one thumbnail per saved gradient', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} onImport={vi.fn()} />)
    expect(screen.getAllByTestId('drawer-thumbnail')).toHaveLength(2)
  })

  it('renders nothing but the container when there are no saved gradients', () => {
    render(<Drawer saved={[]} onSelect={vi.fn()} onImport={vi.fn()} />)
    expect(screen.queryAllByTestId('drawer-thumbnail')).toHaveLength(0)
  })

  it('calls onSelect with the gradient when a thumbnail is tapped', () => {
    const onSelect = vi.fn()
    render(<Drawer saved={gradients} onSelect={onSelect} onImport={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('drawer-thumbnail')[1])
    expect(onSelect).toHaveBeenCalledWith(gradients[1])
  })

  it('has no sort label or select — always shows saved order', () => {
    render(<Drawer saved={gradients} onSelect={vi.fn()} onImport={vi.fn()} />)
    expect(screen.queryByText('Sort saved palettes')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sort saved palettes')).not.toBeInTheDocument()
    const thumbnails = screen.getAllByTestId('drawer-thumbnail')
    expect(thumbnails.map((t) => t.getAttribute('aria-label'))).toEqual(['Saved linear gradient', 'Saved radial gradient'])
  })

  it('renders the TurrellSquare treatment (not a conic background) for saved square gradients', () => {
    const squareGradient: Gradient = {
      id: 'sq1',
      type: 'square',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
    }
    render(<Drawer saved={[squareGradient]} onSelect={vi.fn()} onImport={vi.fn()} />)
    const thumbnail = screen.getByTestId('drawer-thumbnail')
    expect(screen.getByTestId('turrell-square')).toBeInTheDocument()
    expect(thumbnail.style.backgroundImage).toBe('')
  })
})

const board: Gradient[] = [
  {
    id: 'g1',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
    name: 'Test Gradient',
  },
]

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('Drawer board-level actions', () => {
  it('copies a share link when "Share board" is clicked', async () => {
    render(<Drawer saved={board} onSelect={() => {}} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share board/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(`${window.location.origin}${window.location.pathname}#d=`)
    )
  })

  it('copies board JSON when "Copy JSON" is clicked', async () => {
    render(<Drawer saved={board} onSelect={() => {}} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /copy json/i }))
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(JSON.parse(copiedText)).toMatchObject({ kind: 'board' })
  })

  it('does not render board actions when there are no saved gradients', () => {
    render(<Drawer saved={[]} onSelect={() => {}} onImport={() => {}} />)
    expect(screen.queryByRole('button', { name: /share board/i })).not.toBeInTheDocument()
  })
})

describe('Drawer per-gradient actions', () => {
  it('copies a single-gradient share link from a thumbnail action', async () => {
    render(<Drawer saved={board} onSelect={() => {}} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share this gradient/i }))
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copiedText).toContain('#d=')
  })

  it('does not trigger onSelect when the share action is clicked', async () => {
    const onSelect = vi.fn()
    render(<Drawer saved={board} onSelect={onSelect} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share this gradient/i }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
