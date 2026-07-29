import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useCommunityGradients, type CommunityOrder } from './useCommunityGradients'

/** One pending request, held open so responses can be resolved out of order. */
type Pending = {
  orders: string[]
  resolve: (rows: Record<string, unknown>[]) => void
}

const pending: Pending[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const orders: string[] = []
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = (col: string) => {
        orders.push(col)
        return chain
      }
      chain.range = () =>
        new Promise((res) => {
          pending.push({
            orders: [...orders],
            resolve: (rows) => res({ data: rows, error: null }),
          })
        })
      chain.delete = () => chain
      chain.eq = () => Promise.resolve({ error: null })
      return chain
    },
  },
}))

function row(id: string, likes: number) {
  return {
    id,
    display_name: id,
    // Distinct colours, or the DNA dedupe treats these as the same palette.
    colors: [`#${id.slice(-6).padStart(6, '0')}`, '#ffffff'],
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: '2026-01-01T00:00:00.000Z',
    likes,
  }
}

beforeEach(() => {
  pending.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useCommunityGradients — switching order mid-flight', () => {
  it('drops a response whose order has been superseded', async () => {
    // Recent is asked for, then Popular before Recent answers, and Recent
    // answers LAST. Whichever lands last used to win, so date-ordered rows
    // would have been appended to a list the user had put in popularity order.
    const { result, rerender } = renderHook(
      ({ order }: { order: CommunityOrder }) => useCommunityGradients(order),
      { initialProps: { order: 'recent' as CommunityOrder } }
    )

    await waitFor(() => expect(pending).toHaveLength(1))
    const recentReq = pending[0]
    expect(recentReq.orders).toEqual(['created_at', 'id'])

    // Switch before the first answer arrives.
    rerender({ order: 'popular' })
    await waitFor(() => expect(pending).toHaveLength(2))
    const popularReq = pending[1]
    expect(popularReq.orders).toEqual(['likes', 'created_at', 'id'])

    // Popular answers first...
    await act(async () => {
      popularReq.resolve([row('aaa111', 9), row('bbb222', 4)])
    })
    await waitFor(() => expect(result.current.gradients).toHaveLength(2))

    // ...and the stale Recent answers after. It must be ignored.
    await act(async () => {
      recentReq.resolve([row('ccc333', 0), row('ddd444', 0)])
    })

    expect(result.current.gradients.map((g) => g.id)).toEqual(['aaa111', 'bbb222'])
  })

  it('does not let a superseded response turn off the live one’s loading state', async () => {
    const { result, rerender } = renderHook(
      ({ order }: { order: CommunityOrder }) => useCommunityGradients(order),
      { initialProps: { order: 'recent' as CommunityOrder } }
    )
    await waitFor(() => expect(pending).toHaveLength(1))
    const stale = pending[0]

    rerender({ order: 'popular' })
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(result.current.loading).toBe(true)

    await act(async () => {
      stale.resolve([row('eee555', 1)])
    })

    // Still loading: the request that matters has not answered.
    expect(result.current.loading).toBe(true)
    expect(result.current.gradients).toHaveLength(0)

    await act(async () => {
      pending[1].resolve([row('fff666', 7)])
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.gradients.map((g) => g.id)).toEqual(['fff666'])
  })

  it('clears the previous order’s rows rather than appending to them', async () => {
    const { result, rerender } = renderHook(
      ({ order }: { order: CommunityOrder }) => useCommunityGradients(order),
      { initialProps: { order: 'recent' as CommunityOrder } }
    )
    await waitFor(() => expect(pending).toHaveLength(1))
    await act(async () => {
      pending[0].resolve([row('aaa111', 0), row('bbb222', 0)])
    })
    await waitFor(() => expect(result.current.gradients).toHaveLength(2))

    rerender({ order: 'popular' })
    // Emptied immediately, before the new page arrives — the old order's rows
    // are not the answer to the new question.
    expect(result.current.gradients).toHaveLength(0)

    await waitFor(() => expect(pending).toHaveLength(2))
    await act(async () => {
      pending[1].resolve([row('ccc333', 99)])
    })
    expect(result.current.gradients.map((g) => g.id)).toEqual(['ccc333'])
  })
})
