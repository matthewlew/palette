import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from './SearchBar'
import type { Gradient } from '../store/types'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.or = self
      chain.ilike = self
      chain.limit = () => Promise.resolve({ data: [], error: null })
      return chain
    },
  },
}))

const saved: Gradient[] = [
  { id: 's1', name: 'Warm Clay Creek', type: 'linear',
    stops: [{ hex: '#111111', position: 0 }, { hex: '#eeeeee', position: 100 }] },
  { id: 's2', name: 'Cold Steel', type: 'linear',
    stops: [{ hex: '#222222', position: 0 }, { hex: '#dddddd', position: 100 }] },
  { id: 's3', name: 'Quiet Dune', type: 'radial',
    stops: [{ hex: '#333333', position: 0 }, { hex: '#cccccc', position: 100 }] },
  { id: 's4', name: 'Warm Tide', type: 'mirror',
    stops: [{ hex: '#444444', position: 0 }, { hex: '#bbbbbb', position: 100 }] },
]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('SearchBar', () => {
  it('returns YOUR matches on the first keystroke, before the network', () => {
    // The community query is debounced 400ms. If local matches waited for it,
    // the screen would be blank for that whole time — which is the thing the
    // Yours-first grouping exists to prevent.
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'clay' } })

    expect(onResults).toHaveBeenLastCalledWith({
      mine: [saved[0]],
      community: [],
    })
    // ...and that happened without any timer running.
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('matches on every word, not just the first', () => {
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'warm creek' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [saved[0]], community: [] })

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'warm steel' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [], community: [] })
  })

  it('keeps your matches when the community query fails', async () => {
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'clay' } })
    await act(async () => { await vi.runAllTimersAsync() })
    const last = onResults.mock.calls.at(-1)![0]
    expect(last.mine).toEqual([saved[0]])
  })

  it('clears back to no results, not to an empty group', () => {
    // null means "not searching" and restores the browse view; an empty group
    // would read as "no matches" and leave the gallery hidden.
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'clay' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(onResults).toHaveBeenLastCalledWith(null)
  })

  it('reports active state so the gallery can go full-screen', () => {
    const onActiveChange = vi.fn()
    render(<SearchBar onResults={vi.fn()} saved={saved} onActiveChange={onActiveChange} />)
    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'clay' } })
    expect(onActiveChange).toHaveBeenLastCalledWith(true)
    fireEvent.change(input, { target: { value: '' } })
    expect(onActiveChange).toHaveBeenLastCalledWith(false)
  })

  it('Cancel clears the query and closes search', () => {
    const onResults = vi.fn()
    const onCancel = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} onCancel={onCancel} />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'clay' } })
    fireEvent.click(screen.getByTestId('search-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onResults).toHaveBeenLastCalledWith(null)
    expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe('')
  })

  it('finds palettes by SHAPE, not just by name', () => {
    // "radial" used to look for the word radial in generated names and miss
    // every actual radial gradient. None of these palettes is named for its
    // geometry, which is the point.
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'radial' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [saved[2]], community: [] })
  })

  it('accepts the words people actually use for a shape', () => {
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'circular' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [saved[2]], community: [] })
    fireEvent.change(input, { target: { value: 'lines' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [saved[0], saved[1]], community: [] })
  })

  it('combines a shape with a name term', () => {
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    // "warm" alone matches the linear AND the mirror; adding the shape narrows.
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'warm mirror' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [saved[3]], community: [] })
  })

  it('treats several shapes as OR, since a palette has only one', () => {
    const onResults = vi.fn()
    render(<SearchBar onResults={onResults} saved={saved} />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'radial mirror' } })
    expect(onResults).toHaveBeenLastCalledWith({ mine: [saved[2], saved[3]], community: [] })
  })

  it('shows no Cancel while the field is empty — there is nothing to cancel', () => {
    // It used to render whenever onCancel was passed, which the Gallery always
    // does, so a dead Cancel sat beside an empty search box at every width and
    // cost ~70px of a header row that had already been cut to fit.
    const onCancel = vi.fn()
    render(<SearchBar onResults={vi.fn()} saved={saved} onCancel={onCancel} />)
    expect(screen.queryByTestId('search-cancel')).toBeNull()
  })

  it('brings Cancel in with the query and takes it away again', () => {
    const onCancel = vi.fn()
    render(<SearchBar onResults={vi.fn()} saved={saved} onCancel={onCancel} />)
    const input = screen.getByTestId('search-input')

    fireEvent.change(input, { target: { value: 'clay' } })
    expect(screen.getByTestId('search-cancel')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByTestId('search-cancel')).toBeNull()
  })

  it('treats whitespace as no search, so it summons no way out of one', () => {
    // Matches the condition the effect uses to decide a search is running —
    // the two must agree, or Cancel appears without the full-screen takeover
    // it exists to escape.
    const onActiveChange = vi.fn()
    render(
      <SearchBar onResults={vi.fn()} saved={saved} onCancel={vi.fn()} onActiveChange={onActiveChange} />
    )
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: '   ' } })

    expect(onActiveChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByTestId('search-cancel')).toBeNull()
  })

  it('has no Cancel unless a caller wires one', () => {
    render(<SearchBar onResults={vi.fn()} saved={saved} />)
    expect(screen.queryByTestId('search-cancel')).toBeNull()
  })
})
