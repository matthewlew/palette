import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Gradient } from '../store/types'

let table: Record<string, unknown>[] = []
let isFilter: [string, unknown] | null = null
const rpcCalls: { fn: string; args: unknown }[] = []

vi.mock('./supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.is = (col: string, val: unknown) => {
        isFilter = [col, val]
        // The candidate query filters unsigned rows in the DATABASE. Honour
        // that here rather than returning the whole table, or the test would
        // pass while the real filter was missing.
        return Promise.resolve({
          data: table.filter((r) => r[col] === val),
          error: null,
        })
      }
      return chain
    },
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return Promise.resolve({ data: 2, error: null })
    },
  },
}))

const { findClaimable, claimPalettes } = await import('./claimPalettes')

function row(id: string, hexes: string[], authorId: string | null = null) {
  return {
    id,
    display_name: 'G',
    colors: hexes,
    offsets: null,
    shape: 'linear',
    angle: null,
    created_at: '2026-01-01T00:00:00.000Z',
    likes: 0,
    author_id: authorId,
  }
}

function gradient(hexes: string[]): Gradient {
  return {
    id: `local-${hexes.join('')}`,
    name: 'G',
    type: 'linear',
    stops: hexes.map((hex, i) => ({ hex, position: i * 100, id: `s${i}` })),
  } as Gradient
}

const RED_BLUE = ['#ff0000', '#0000ff']
const GREEN_BLACK = ['#00ff00', '#000000']

beforeEach(() => {
  table = []
  isFilter = null
  rpcCalls.length = 0
})

describe('findClaimable', () => {
  it('offers an unsigned row whose colours are on the shelf', async () => {
    table = [row('p1', RED_BLUE)]
    const found = await findClaimable([gradient(RED_BLUE)])
    expect(found.map((c) => c.paletteId)).toEqual(['p1'])
  })

  it('asks the database for unsigned rows rather than filtering here', async () => {
    // An owned row must not be a candidate under any circumstance, so the
    // filter belongs server-side where the client cannot skip it.
    table = [row('p1', RED_BLUE)]
    await findClaimable([gradient(RED_BLUE)])
    expect(isFilter).toEqual(['author_id', null])
  })

  it('never offers a row that already has an author', async () => {
    table = [row('p1', RED_BLUE, 'someone-else')]
    expect(await findClaimable([gradient(RED_BLUE)])).toEqual([])
  })

  it('ignores unsigned rows that are not on the shelf', async () => {
    table = [row('p1', GREEN_BLACK)]
    expect(await findClaimable([gradient(RED_BLUE)])).toEqual([])
  })

  it('matches on shape as well as colour', async () => {
    table = [{ ...row('p1', RED_BLUE), shape: 'radial' }]
    expect(await findClaimable([gradient(RED_BLUE)])).toEqual([])
  })

  it('offers duplicated unsigned rows once, not once each', async () => {
    table = [row('p1', RED_BLUE), row('p2', RED_BLUE)]
    const found = await findClaimable([gradient(RED_BLUE)])
    expect(found).toHaveLength(1)
  })

  it('does not query at all for an empty shelf', async () => {
    expect(await findClaimable([])).toEqual([])
    expect(isFilter).toBeNull()
  })
})

describe('claimPalettes', () => {
  it('sends the ids to the RPC and returns how many moved', async () => {
    await expect(claimPalettes(['p1', 'p2'])).resolves.toBe(2)
    expect(rpcCalls).toEqual([{ fn: 'claim_palettes', args: { p_ids: ['p1', 'p2'] } }])
  })

  it('does not call the RPC with nothing to claim', async () => {
    await expect(claimPalettes([])).resolves.toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })
})
