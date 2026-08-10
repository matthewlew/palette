import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'

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

let table: Row[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.or = () => chain
      chain.ilike = () => chain
      chain.in = () => chain
      chain.limit = () => Promise.resolve({ data: [], error: null })
      chain.order = () => chain
      chain.range = () => Promise.resolve({ data: table, error: null })
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

function row(i: number): Row {
  return {
    id: `c${String(i).padStart(3, '0')}`,
    display_name: `Community ${i}`,
    colors: [`#${i.toString(16).padStart(6, '0')}`, '#ffffff'],
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: new Date(1_700_000_000_000 - i * 60_000).toISOString(),
    likes: 0,
  }
}

async function showCommunity() {
  fireEvent.click(screen.getByRole('button', { name: /^Community$/ }))
  await waitFor(() => expect(screen.getAllByTestId('gallery-tile').length).toBeGreaterThan(0))
}

beforeEach(() => {
  table = [row(0), row(1)]
  localStorage.clear()
  useAppStore.setState({ saved: [], mode: 'gallery', likedPaletteIds: [], galleryLayout: 'grid', carouselPicks: [] })
})

afterEach(() => {
  cleanup()
})

describe('Community — picking for the carousel', () => {
  it('saves a community palette locally and picks it, since the carousel only renders from saves', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()

    fireEvent.click(screen.getByTestId('carousel-pick-toggle'))
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])

    await waitFor(() => expect(useAppStore.getState().saved).toHaveLength(1))
    const savedId = useAppStore.getState().saved[0].id
    expect(useAppStore.getState().carouselPicks).toEqual([savedId])
    expect(screen.getAllByTestId('pick-badge')[0]).toHaveTextContent('1')
  })

  it('un-picks on a second tap without duplicating the saved copy', async () => {
    render(<Gallery onRiff={vi.fn()} />)
    await showCommunity()

    fireEvent.click(screen.getByTestId('carousel-pick-toggle'))
    const tile = screen.getAllByTestId('gallery-tile')[0]
    fireEvent.click(tile)
    await waitFor(() => expect(useAppStore.getState().carouselPicks).toHaveLength(1))

    fireEvent.click(tile)
    expect(useAppStore.getState().carouselPicks).toHaveLength(0)
    // The local copy stays — un-picking is not un-saving.
    expect(useAppStore.getState().saved).toHaveLength(1)

    fireEvent.click(tile)
    await waitFor(() => expect(useAppStore.getState().carouselPicks).toHaveLength(1))
    // Picking it again reuses the existing saved copy rather than making a second one.
    expect(useAppStore.getState().saved).toHaveLength(1)
  })

  it('hides the selection tray as soon as Select is turned off', async () => {
    useAppStore.setState({
      saved: [
        {
          id: 'local-1',
          name: 'Local',
          type: 'linear',
          angle: 90,
          stops: [
            { hex: '#ff0000', position: 0 },
            { hex: '#0000ff', position: 100 },
          ],
        } as never,
      ],
    })
    render(<Gallery onRiff={vi.fn()} />)
    fireEvent.click(screen.getByTestId('carousel-pick-toggle'))
    fireEvent.click(screen.getAllByTestId('gallery-tile')[0])
    await waitFor(() => expect(screen.getByTestId('selection-bar')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('carousel-pick-toggle'))
    expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument()

    // The pick itself survives — turning Select back on brings the tray right back.
    fireEvent.click(screen.getByTestId('carousel-pick-toggle'))
    expect(screen.getByTestId('selection-bar')).toBeInTheDocument()
  })
})
