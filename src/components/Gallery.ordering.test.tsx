import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { COMMUNITY_PAGE_SIZE } from '../hooks/useCommunityGradients'

const ranges: [number, number][] = []
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
      chain.range = (from: number, to: number) => {
        ranges.push([from, to])
        return Promise.resolve({ data: table.slice(from, to + 1), error: null })
      }
      chain.delete = () => chain
      chain.eq = () => Promise.resolve({ error: null })
      return chain
    },
  },
}))

function communityRow(i: number) {
  return {
    id: `c${i}`,
    display_name: `Community ${i}`,
    colors: [`#${i.toString(16).padStart(6, '0')}`, '#ffffff'],
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: new Date(1_700_000_000_000 - i * 1000).toISOString(),
  }
}

/** Saved in hand-arranged order Alpha, Beta, Gamma; created Beta, Gamma, Alpha. */
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
    type: 'linear',
    name: 'Beta',
    createdAt: 1000,
    stops: [{ hex: '#00ff00', position: 0 }, { hex: '#0000ff', position: 100 }],
  },
  {
    id: 'g3',
    type: 'linear',
    name: 'Gamma',
    createdAt: 2000,
    stops: [{ hex: '#ffff00', position: 0 }, { hex: '#0000ff', position: 100 }],
  },
]

function tileNames(): string[] {
  return screen
    .getAllByTestId('gallery-tile')
    .map((tile) => tile.getAttribute('aria-label')?.split(',')[0] ?? '')
}

beforeEach(() => {
  ranges.length = 0
  table = []
  localStorage.clear()
  useAppStore.setState({ saved, mode: 'gallery' })
})

afterEach(() => {
  cleanup()
})

describe('Gallery — ordering the Yours tab', () => {
  it('opens in the hand-arranged order, which drag-reorder writes', () => {
    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.getByTestId('saves-order-custom')).toHaveAttribute('aria-pressed', 'true')
    expect(tileNames()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('sorts newest first when Recent is chosen', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('saves-order-recent'))
    expect(tileNames()).toEqual(['Alpha', 'Gamma', 'Beta'])
    expect(screen.getByTestId('saves-order-recent')).toHaveAttribute('aria-pressed', 'true')
  })

  it('returns to the hand-arranged order when Custom is chosen again', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('saves-order-recent'))
    fireEvent.click(screen.getByTestId('saves-order-custom'))
    expect(tileNames()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('sorts palettes saved before createdAt existed to the END, not the top', () => {
    // An absent timestamp is unknown, not old. Floating undated palettes above
    // this morning's work would make the control look broken.
    useAppStore.setState({
      saved: [
        { ...saved[0], createdAt: undefined },
        { ...saved[1] },
        { ...saved[2] },
      ],
    })
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('saves-order-recent'))
    expect(tileNames()).toEqual(['Gamma', 'Beta', 'Alpha'])
  })

  it('turns off drag-reorder under Recent, since a drop would write an order you cannot see', () => {
    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.getAllByTestId('gallery-tile')[0]).toHaveAttribute('draggable', 'true')
    fireEvent.click(screen.getByTestId('saves-order-recent'))
    expect(screen.getAllByTestId('gallery-tile')[0]).toHaveAttribute('draggable', 'false')
  })

  it('offers no sort control on the Community tab, which has one meaningful order', () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))
    expect(screen.queryByTestId('saves-order')).not.toBeInTheDocument()
  })
})

describe('Gallery — loading more community palettes', () => {
  it('offers Load more while the server still has rows, and appends them', async () => {
    table = Array.from({ length: COMMUNITY_PAGE_SIZE + 3 }, (_, i) => communityRow(i))
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))

    await waitFor(() => expect(screen.getAllByTestId('gallery-tile')).toHaveLength(COMMUNITY_PAGE_SIZE))
    const loadMore = screen.getByTestId('community-load-more')

    fireEvent.click(loadMore)
    await waitFor(() =>
      expect(screen.getAllByTestId('gallery-tile')).toHaveLength(COMMUNITY_PAGE_SIZE + 3)
    )
    // Feed exhausted — the button retires rather than sitting there doing nothing.
    await waitFor(() => expect(screen.queryByTestId('community-load-more')).not.toBeInTheDocument())
  })

  it('shows no Load more when the whole feed arrived in the first page', async () => {
    table = Array.from({ length: 4 }, (_, i) => communityRow(i))
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))

    await waitFor(() => expect(screen.getAllByTestId('gallery-tile')).toHaveLength(4))
    expect(screen.queryByTestId('community-load-more')).not.toBeInTheDocument()
  })

  it('keeps Load more on the Yours tab out of the way entirely', async () => {
    table = Array.from({ length: COMMUNITY_PAGE_SIZE + 3 }, (_, i) => communityRow(i))
    render(<Gallery onRiff={vi.fn()} />)
    await waitFor(() => expect(ranges.length).toBeGreaterThan(0))
    expect(screen.queryByTestId('community-load-more')).not.toBeInTheDocument()
  })
})

describe('Gallery — first-run hint for leaving the full-screen viewer', () => {
  it('tells you the whole screen is the way back, then never again', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])

    const hint = await screen.findByText(/tap anywhere to go back to your gallery/i)
    expect(hint).toBeInTheDocument()

    // Tapping out is learning it.
    fireEvent.click(screen.getByTestId('gallery-viewer'))
    await waitFor(() => expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument())

    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])
    expect(screen.queryByText(/tap anywhere to go back to your gallery/i)).not.toBeInTheDocument()
  })

  it('is also spent by using the ✕, so it does not outlive being understood', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])
    expect(await screen.findByText(/tap anywhere to go back/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('gallery-viewer')).not.toBeInTheDocument())

    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])
    expect(screen.queryByText(/tap anywhere to go back/i)).not.toBeInTheDocument()
  })
})
