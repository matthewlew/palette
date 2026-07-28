import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCommunityGradients, COMMUNITY_PAGE_SIZE } from './useCommunityGradients'

/** Every .range() call the hook made, in order. */
const ranges: [number, number][] = []
/** Rows the fake table will serve, newest-first. */
let table: Record<string, unknown>[] = []
let failNextRange: boolean = false

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => chain
      chain.range = (from: number, to: number) => {
        ranges.push([from, to])
        if (failNextRange) {
          failNextRange = false
          return Promise.resolve({ data: null, error: new Error('network') })
        }
        return Promise.resolve({ data: table.slice(from, to + 1), error: null })
      }
      chain.delete = () => chain
      chain.eq = () => Promise.resolve({ error: null })
      return chain
    },
  },
}))

function row(i: number, colors = [`#${i.toString(16).padStart(6, '0')}`, '#ffffff']) {
  return {
    id: `p${i}`,
    display_name: `Palette ${i}`,
    colors,
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: new Date(1_700_000_000_000 - i * 1000).toISOString(),
  }
}

function makeTable(count: number) {
  return Array.from({ length: count }, (_, i) => row(i))
}

beforeEach(() => {
  ranges.length = 0
  failNextRange = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useCommunityGradients', () => {
  it('serves the first page and reports there is more when the page came back full', async () => {
    table = makeTable(COMMUNITY_PAGE_SIZE * 2)
    const { result } = renderHook(() => useCommunityGradients())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.gradients).toHaveLength(COMMUNITY_PAGE_SIZE)
    expect(result.current.hasMore).toBe(true)
    expect(ranges).toEqual([[0, COMMUNITY_PAGE_SIZE - 1]])
  })

  it('appends the next page on loadMore instead of replacing or discarding it', async () => {
    // The old hook fetched 200 and sliced to 50, so everything past the 50th
    // was fetched and then thrown away — unreachable, not just unpaginated.
    table = makeTable(COMMUNITY_PAGE_SIZE + 10)
    const { result } = renderHook(() => useCommunityGradients())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.gradients).toHaveLength(COMMUNITY_PAGE_SIZE + 10)
    expect(ranges[1]).toEqual([COMMUNITY_PAGE_SIZE, COMMUNITY_PAGE_SIZE * 2 - 1])
    // A short page is the end of the feed.
    expect(result.current.hasMore).toBe(false)
  })

  it('keeps paging past a page that is entirely duplicates', async () => {
    // hasMore reads the RAW row count. A page of reposts adds nothing to the
    // list while the feed plainly continues; calling that the end would
    // strand every palette after it.
    const dupe = ['#abcdef', '#ffffff']
    table = [
      ...Array.from({ length: COMMUNITY_PAGE_SIZE }, (_, i) => row(i, dupe)),
      ...Array.from({ length: 5 }, (_, i) => row(100 + i)),
    ]
    const { result } = renderHook(() => useCommunityGradients())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // 50 rows, all the same palette -> one tile, but more to fetch.
    expect(result.current.gradients).toHaveLength(1)
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.gradients).toHaveLength(6)
  })

  it('does not re-add a palette already on screen when it recurs on a later page', async () => {
    const dupe = ['#123456', '#ffffff']
    table = [
      ...Array.from({ length: COMMUNITY_PAGE_SIZE - 1 }, (_, i) => row(i)),
      row(998, dupe),
      row(999, dupe),
    ]
    const { result } = renderHook(() => useCommunityGradients())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.gradients).toHaveLength(COMMUNITY_PAGE_SIZE)

    await act(async () => {
      await result.current.loadMore()
    })
    // The second copy is dropped, so the list is unchanged.
    expect(result.current.gradients).toHaveLength(COMMUNITY_PAGE_SIZE)
  })

  it('leaves hasMore set after a failed page so the button stays a retry', async () => {
    table = makeTable(COMMUNITY_PAGE_SIZE * 2)
    const { result } = renderHook(() => useCommunityGradients())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(true)

    failNextRange = true
    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.hasMore).toBe(true)
    expect(result.current.loadingMore).toBe(false)
    // The cursor did not advance, so the retry asks for the same page.
    await act(async () => {
      await result.current.loadMore()
    })
    expect(ranges[2]).toEqual([COMMUNITY_PAGE_SIZE, COMMUNITY_PAGE_SIZE * 2 - 1])
    expect(result.current.gradients).toHaveLength(COMMUNITY_PAGE_SIZE * 2)
  })

  it('reports no more to load when the very first page is short', async () => {
    table = makeTable(3)
    const { result } = renderHook(() => useCommunityGradients())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.gradients).toHaveLength(3)
    expect(result.current.hasMore).toBe(false)
  })
})
