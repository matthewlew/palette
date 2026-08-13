import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'
import { COMMUNITY_PAGE_SIZE } from '../hooks/useCommunityGradients'

type Row = {
  id: string
  display_name: string
  colors: string[]
  offsets: null
  shape: string
  angle: null
  created_at: string
  likes: number
}

/** Every query the feed issued: the order keys in the order they were chained,
 * and the page it asked for. */
type Query = { orders: [string, boolean][]; range: [number, number] }

const queries: Query[] = []
let table: Row[] = []

/** A fake that actually sorts, so tile order can be asserted rather than
 * assumed from the query shape alone. */
function applyOrders(rows: Row[], orders: [string, boolean][]): Row[] {
  return [...rows].sort((a, b) => {
    for (const [col, ascending] of orders) {
      const av = (a as unknown as Record<string, string | number>)[col]
      const bv = (b as unknown as Record<string, string | number>)[col]
      if (av === bv) continue
      const cmp = av < bv ? -1 : 1
      return ascending ? cmp : -cmp
    }
    return 0
  })
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInAnonymously: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => {
      const orders: [string, boolean][] = []
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.or = () => chain
      chain.ilike = () => chain
      chain.in = () => chain
      chain.limit = () => Promise.resolve({ data: [], error: null })
      chain.order = (col: string, opts?: { ascending?: boolean }) => {
        orders.push([col, opts?.ascending ?? true])
        return chain
      }
      chain.range = (from: number, to: number) => {
        queries.push({ orders: [...orders], range: [from, to] })
        return Promise.resolve({
          data: applyOrders(table, orders).slice(from, to + 1),
          error: null,
        })
      }
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

function row(i: number, likes: number): Row {
  return {
    id: `c${String(i).padStart(3, '0')}`,
    display_name: `Palette ${i}`,
    colors: [`#${i.toString(16).padStart(6, '0')}`, '#ffffff'],
    offsets: null,
    shape: 'linear',
    angle: null,
    // Older as i grows, so "recent" is ascending id and descending created_at.
    created_at: new Date(1_700_000_000_000 - i * 60_000).toISOString(),
    likes,
  }
}

function tileNames(): string[] {
  return screen
    .getAllByTestId('gallery-tile')
    .map((t) => t.getAttribute('aria-label')?.split(',')[0] ?? '')
}

async function showCommunity() {
  fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))
  await waitFor(() => expect(screen.getAllByTestId('gallery-tile').length).toBeGreaterThan(0))
}

beforeEach(() => {
  queries.length = 0
  // Palette 0 is newest and unloved; Palette 3 is oldest and the favourite.
  table = [row(0, 0), row(1, 5), row(2, 2), row(3, 41)]
  localStorage.clear()
  useAppStore.setState({ saved: [], mode: 'gallery', likedPaletteIds: [], galleryLayout: 'grid' })
})

afterEach(() => {
  cleanup()
})

describe('Community — sorting the feed', () => {
  it('opens on Recent, because a feed you return to should lead with what is new', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    expect(screen.getByTestId('community-order-recent')).toHaveAttribute('aria-pressed', 'true')
    expect(tileNames()).toEqual(['Palette 0', 'Palette 1', 'Palette 2', 'Palette 3'])
  })

  it('ranks by like count when Popular is chosen', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()

    fireEvent.click(screen.getByTestId('community-order-popular'))
    await waitFor(() => expect(tileNames()).toEqual(['Palette 3', 'Palette 1', 'Palette 2', 'Palette 0']))
    expect(screen.getByTestId('community-order-popular')).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back to Recent', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getByTestId('community-order-popular'))
    await waitFor(() => expect(tileNames()[0]).toBe('Palette 3'))

    fireEvent.click(screen.getByTestId('community-order-recent'))
    await waitFor(() => expect(tileNames()).toEqual(['Palette 0', 'Palette 1', 'Palette 2', 'Palette 3']))
  })

  it('sorts on the SERVER, not over the pages already loaded', async () => {
    // The most-liked palette in the table is very likely to be on page five.
    // Re-sorting pages one and two would rank a window and call it the feed.
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getByTestId('community-order-popular'))

    await waitFor(() => expect(queries.length).toBeGreaterThan(1))
    const popular = queries.at(-1)!
    expect(popular.orders[0]).toEqual(['likes', false])
  })

  it('breaks ties on a unique key, or offset paging repeats and skips rows', async () => {
    // Nearly every palette shares a like count (almost all of them zero), and
    // offset/limit over a non-unique sort key has no defined order between
    // equal rows — the same row can come back on two pages, or on none.
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getByTestId('community-order-popular'))
    await waitFor(() => expect(queries.length).toBeGreaterThan(1))

    for (const q of queries) {
      expect(q.orders.at(-1)).toEqual(['id', false])
      // And popular still falls back to newest before it reaches the id.
      if (q.orders[0][0] === 'likes') {
        expect(q.orders[1]).toEqual(['created_at', false])
      }
    }
  })

  it('restarts paging from the top, rather than continuing at the old offset', async () => {
    table = Array.from({ length: COMMUNITY_PAGE_SIZE + 5 }, (_, i) => row(i, i % 4))
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    await waitFor(() => expect(screen.getAllByTestId('gallery-tile')).toHaveLength(COMMUNITY_PAGE_SIZE))

    fireEvent.click(screen.getByTestId('community-load-more'))
    await waitFor(() =>
      expect(screen.getAllByTestId('gallery-tile')).toHaveLength(COMMUNITY_PAGE_SIZE + 5)
    )

    queries.length = 0
    fireEvent.click(screen.getByTestId('community-order-popular'))

    // A new order is a new feed: page 0, and the list replaced rather than
    // appended to — otherwise the old ordering's rows would sit above the new
    // one's, and paging would resume at an offset that means nothing.
    await waitFor(() => expect(queries.length).toBeGreaterThan(0))
    expect(queries[0].range[0]).toBe(0)
    await waitFor(() =>
      expect(screen.getAllByTestId('gallery-tile')).toHaveLength(COMMUNITY_PAGE_SIZE)
    )
  })

  it('leaves the Yours tab and its own orders alone', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    expect(screen.getByTestId('community-order')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Yours/ }))
    expect(screen.queryByTestId('community-order')).not.toBeInTheDocument()
  })
})
