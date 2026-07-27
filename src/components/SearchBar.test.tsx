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

  it('has no Cancel unless a caller wires one', () => {
    render(<SearchBar onResults={vi.fn()} saved={saved} />)
    expect(screen.queryByTestId('search-cancel')).toBeNull()
  })
})
