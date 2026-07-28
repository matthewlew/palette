import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

let table: Record<string, unknown>[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => chain
      chain.or = () => chain
      chain.ilike = () => chain
      chain.limit = () => Promise.resolve({ data: [], error: null })
      chain.range = (from: number, to: number) =>
        Promise.resolve({ data: table.slice(from, to + 1), error: null })
      chain.delete = () => chain
      chain.eq = () => Promise.resolve({ error: null })
      return chain
    },
  },
}))

vi.mock('../lib/likes', () => ({
  likePalette: async () => true,
  unlikePalette: async () => true,
}))

const saved: Gradient[] = [
  {
    id: 'g1',
    type: 'linear',
    name: 'Alpha',
    createdAt: 3000,
    stops: [{ hex: '#ff0000', position: 0 }, { hex: '#0000ff', position: 100 }],
  },
  {
    id: 'g2',
    type: 'radial',
    name: 'Beta',
    createdAt: 2000,
    stops: [{ hex: '#00ff00', position: 0 }, { hex: '#0000ff', position: 100 }],
  },
]

function preview(tile: HTMLElement): HTMLElement {
  return tile.firstElementChild as HTMLElement
}

beforeEach(() => {
  table = [
    {
      id: 'c0',
      display_name: 'Community 0',
      colors: ['#123456', '#ffffff'],
      offsets: null,
      shape: 'linear',
      angle: null,
      created_at: new Date(1_700_000_000_000).toISOString(),
      likes: 9,
    },
  ]
  localStorage.clear()
  useAppStore.setState({
    saved,
    mode: 'gallery',
    likedPaletteIds: [],
    galleryLayout: 'grid',
  })
})

afterEach(() => {
  cleanup()
})

describe('Gallery — the dense layout', () => {
  it('is a third choice beside grid and masonry, not a replacement', () => {
    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.getByLabelText('Show grid layout')).toBeInTheDocument()
    expect(screen.getByLabelText('Show Pinterest masonry layout')).toBeInTheDocument()
    expect(screen.getByTestId('layout-dense')).toBeInTheDocument()
  })

  it('is remembered, like the other two layouts', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('layout-dense'))
    expect(useAppStore.getState().galleryLayout).toBe('dense')
    expect(localStorage.getItem('palette-saved-gradients')).toContain('dense')
  })

  it('packs squares where the uniform grid holds 4:5 portraits', () => {
    render(<Gallery onRiff={vi.fn()} />)
    expect(preview(screen.getAllByTestId('gallery-tile')[0]).style.aspectRatio).toBe('4 / 5')

    fireEvent.click(screen.getByTestId('layout-dense'))
    expect(preview(screen.getAllByTestId('gallery-tile')[0]).style.aspectRatio).toBe('1 / 1')
  })

  it('keeps every palette on screen — density is the only thing that changes', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('layout-dense'))
    expect(screen.getAllByTestId('gallery-tile')).toHaveLength(saved.length)
  })

  it('drops the caption from the page, not from the accessible name', () => {
    // The tile is the only thing a screen reader gets in this layout, so the
    // name has to survive the caption being hidden.
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('layout-dense'))
    expect(screen.getAllByTestId('gallery-tile')[0]).toHaveAttribute(
      'aria-label',
      'Alpha, linear gradient'
    )
  })

  it('still opens the full-screen viewer on a tap', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('layout-dense'))
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])
    expect(screen.getByTestId('gallery-viewer')).toBeInTheDocument()
  })
})

describe('Gallery — likes in the dense layout', () => {
  async function showDenseCommunity() {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('layout-dense'))
    fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))
    await waitFor(() => expect(screen.getAllByTestId('gallery-tile').length).toBeGreaterThan(0))
  }

  it('shows the count but not a heart — three across leaves no room for a second target', async () => {
    await showDenseCommunity()
    expect(screen.getByTestId('like-count-badge')).toHaveTextContent('9')
    expect(screen.queryByTestId('heart-button')).not.toBeInTheDocument()
  })

  it('speaks the count, since the badge itself is decorative', async () => {
    await showDenseCommunity()
    expect(screen.getAllByTestId('gallery-tile')[0]).toHaveAttribute(
      'aria-label',
      'Community 0, linear gradient, 9 likes'
    )
  })

  it('puts the heart itself one tap away, in the viewer', async () => {
    await showDenseCommunity()
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])
    expect(screen.getByTestId('heart-button')).toHaveAttribute(
      'aria-label',
      'Like Community 0, 9 likes'
    )
  })
})
