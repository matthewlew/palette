import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
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

const likePalette = vi.fn(async (_id: string) => true)
const unlikePalette = vi.fn(async (_id: string) => true)
vi.mock('../lib/likes', () => ({
  likePalette: (id: string) => likePalette(id),
  unlikePalette: (id: string) => unlikePalette(id),
}))

function communityRow(i: number, likes: number) {
  return {
    id: `c${i}`,
    display_name: `Community ${i}`,
    colors: [`#${i.toString(16).padStart(6, '0')}`, '#ffffff'],
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: new Date(1_700_000_000_000 - i * 1000).toISOString(),
    likes,
  }
}

const saved: Gradient[] = [
  {
    id: 'g1',
    type: 'linear',
    name: 'Mine',
    createdAt: 3000,
    stops: [{ hex: '#ff0000', position: 0 }, { hex: '#0000ff', position: 100 }],
  },
]

/** Open the Community tab and wait for its first page. */
async function showCommunity() {
  fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))
  await waitFor(() => expect(screen.getAllByTestId('gallery-tile').length).toBeGreaterThan(0))
}

beforeEach(() => {
  table = [communityRow(0, 4), communityRow(1, 0)]
  likePalette.mockClear().mockResolvedValue(true)
  unlikePalette.mockClear().mockResolvedValue(true)
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

describe('Gallery — liking a community palette', () => {
  it('shows the count the server sent', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    const hearts = screen.getAllByTestId('heart-button')
    expect(hearts[0]).toHaveAttribute('aria-label', 'Like Community 0, 4 likes')
    expect(hearts[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers no heart on your own saves, which have no row to like', async () => {
    // A local save's id is a browser-minted uuid, not a row in the shared
    // table. A heart there would be one nobody else could ever see.
    render(<Gallery onRiff={vi.fn()} />)
    expect(screen.getByTestId('gallery-tile')).toBeInTheDocument()
    expect(screen.queryByTestId('heart-button')).not.toBeInTheDocument()
  })

  it('fills the heart and bumps the count immediately, then records it', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getAllByTestId('heart-button')[0])

    await waitFor(() =>
      expect(screen.getAllByTestId('heart-button')[0]).toHaveAttribute(
        'aria-label',
        'Unlike Community 0, 5 likes'
      )
    )
    expect(screen.getAllByTestId('heart-button')[0]).toHaveAttribute('aria-pressed', 'true')
    expect(likePalette).toHaveBeenCalledWith('c0')
  })

  it('takes the like back when the write fails, rather than showing a lie', async () => {
    // This is also what an unapplied migration 0002 looks like. A like is a
    // shared signal; a heart that stays filled claims something about what
    // everyone else can see that simply is not true.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    likePalette.mockResolvedValue(false)
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()

    fireEvent.click(screen.getAllByTestId('heart-button')[0])
    await waitFor(() =>
      expect(screen.getAllByTestId('heart-button')[0]).toHaveAttribute(
        'aria-label',
        'Like Community 0, 4 likes'
      )
    )
    expect(useAppStore.getState().likedPaletteIds).toEqual([])
  })

  it('unlikes a palette it already liked', async () => {
    useAppStore.setState({ likedPaletteIds: ['c0'] })
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()

    const heart = screen.getAllByTestId('heart-button')[0]
    expect(heart).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(heart)

    await waitFor(() =>
      expect(screen.getAllByTestId('heart-button')[0]).toHaveAttribute(
        'aria-label',
        'Like Community 0, 3 likes'
      )
    )
    expect(unlikePalette).toHaveBeenCalledWith('c0')
  })

  it('remembers the like across a remount — no account, but not amnesia either', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getAllByTestId('heart-button')[0])
    await waitFor(() => expect(useAppStore.getState().likedPaletteIds).toEqual(['c0']))

    cleanup()
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    expect(screen.getAllByTestId('heart-button')[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('never shows a negative count, whatever the local delta says', async () => {
    // A like recorded on another device, unliked here: the row's cached count
    // is already 0 and the delta takes it to -1.
    table = [communityRow(0, 0)]
    useAppStore.setState({ likedPaletteIds: ['c0'] })
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()

    fireEvent.click(screen.getByTestId('heart-button'))
    await waitFor(() =>
      expect(screen.getByTestId('heart-button')).toHaveAttribute('aria-label', 'Like Community 0, 0 likes')
    )
  })

  it('carries the like into the full-screen viewer', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])

    // The grid stays mounted underneath, so scope to the viewer — its own
    // heart is the one that has to be there.
    const viewer = screen.getByTestId('gallery-viewer')
    expect(within(viewer).getByTestId('heart-button')).toHaveAttribute(
      'aria-label',
      'Like Community 0, 4 likes'
    )
  })

  it('does not close the viewer when the heart is tapped', async () => {
    // The whole backdrop closes the viewer, so anything sitting on it has to
    // stop the click — otherwise a like dismisses the palette you just liked.
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])

    const viewer = screen.getByTestId('gallery-viewer')
    fireEvent.click(within(viewer).getByTestId('heart-button'))
    await waitFor(() => expect(likePalette).toHaveBeenCalledWith('c0'))
    expect(screen.getByTestId('gallery-viewer')).toBeInTheDocument()
  })
})
