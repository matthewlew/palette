import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Gradient } from '../store/types'

/**
 * syncSaves is the one place a user's shelf can be destroyed, so the tests
 * that matter are the two directions of loss: the server overwriting saves
 * made while signed out, and the client wiping saves made on another browser.
 */

let serverRows: { palette_id: string; created_at: string; palettes: unknown }[] = []
const upserts: Record<string, unknown>[] = []
const deletes: Record<string, unknown>[] = []
let publishedCount = 0
let publishFails = false
let deleteFailsFor: Set<string> = new Set()

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-a' } } } }),
    },
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.order = () => Promise.resolve({ data: serverRows, error: null })
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
      chain.upsert = (payload: Record<string, unknown>) => {
        upserts.push(payload)
        return Promise.resolve({ error: null })
      }
      chain.delete = () => {
        const del: Record<string, unknown> = {}
        const captured: Record<string, unknown> = { table }
        // `.eq()` is chainable and Supabase only actually sends the request
        // once it's awaited, but this mock has no separate "send" step — the
        // second `.eq()` (palette_id, always called last by removeSave) is
        // what stands in for that, including the error path.
        del.eq = (col: string, val: unknown) => {
          captured[col] = val
          if (col === 'palette_id') {
            if (deleteFailsFor.has(val as string)) {
              return Promise.resolve({ error: new Error('offline') })
            }
            deletes.push(captured)
            return Promise.resolve({ error: null })
          }
          return del
        }
        return del
      }
      return chain
    },
  },
}))

vi.mock('./publishPalette', () => ({
  publishGradient: () => {
    if (publishFails) return Promise.reject(new Error('offline'))
    publishedCount++
    return Promise.resolve({ success: true, id: `published-${publishedCount}`, slug: 's', displayName: 'n' })
  },
}))

const { syncSaves, fetchServerSaves, removeSave, flushPendingUnsaves } = await import('./savedSync')

function gradient(hexes: string[], patch: Partial<Gradient> = {}): Gradient {
  return {
    id: `local-${hexes.join('')}`,
    name: 'G',
    type: 'linear',
    stops: hexes.map((hex, i) => ({ hex, position: i * 100, id: `s${i}` })),
    ...patch,
  } as Gradient
}

function serverRow(id: string, hexes: string[]) {
  return {
    palette_id: id,
    created_at: '2026-01-02T00:00:00.000Z',
    palettes: {
      id,
      display_name: 'G',
      colors: hexes,
      offsets: null,
      shape: 'linear',
      angle: null,
      created_at: '2026-01-01T00:00:00.000Z',
      likes: 0,
    },
  }
}

beforeEach(() => {
  serverRows = []
  upserts.length = 0
  deletes.length = 0
  publishedCount = 0
  publishFails = false
  deleteFailsFor = new Set()
})

describe('fetchServerSaves', () => {
  it('drops a save whose palette row is gone rather than rendering a hole', async () => {
    serverRows = [
      serverRow('p1', ['#ff0000', '#0000ff']),
      { palette_id: 'p2', created_at: '2026-01-02T00:00:00.000Z', palettes: null },
    ]
    const saves = await fetchServerSaves()
    expect(saves.map((g) => g.paletteId)).toEqual(['p1'])
  })
})

describe('syncSaves', () => {
  it('pushes a gradient saved while signed out', async () => {
    const local = [gradient(['#ff0000', '#0000ff'])]
    const merged = await syncSaves('user-a', local)

    expect(upserts).toHaveLength(1)
    expect(merged).toHaveLength(1)
    // And remembers the row, so a later unsave knows what to delete.
    expect(merged[0].paletteId).toBe('published-1')
  })

  it('pulls down what another browser saved', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000'])]
    const merged = await syncSaves('user-a', [])

    expect(merged.map((g) => g.paletteId)).toEqual(['p1'])
    expect(upserts).toHaveLength(0)
  })

  it('keeps both sides — the union is the whole point', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000'])]
    const local = [gradient(['#ff0000', '#0000ff'])]

    const merged = await syncSaves('user-a', local)

    expect(merged).toHaveLength(2)
  })

  it('does not re-publish something already on the shelf', async () => {
    const hexes = ['#ff0000', '#0000ff']
    serverRows = [serverRow('p1', hexes)]

    const merged = await syncSaves('user-a', [gradient(hexes)])

    expect(publishedCount).toBe(0)
    expect(upserts).toHaveLength(0)
    expect(merged).toHaveLength(1)
    // Matched by DNA, not by id: the local copy's uuid never went near the db.
    expect(merged[0].paletteId).toBe('p1')
  })

  it('keeps a save locally when pushing it fails, rather than dropping it', async () => {
    publishFails = true

    const merged = await syncSaves('user-a', [gradient(['#ff0000', '#0000ff'])])

    expect(merged).toHaveLength(1)
    expect(merged[0].paletteId).toBeUndefined()
  })

  // The reappearing-delete bug: a delete removed the gradient locally, but
  // the request that was supposed to remove the server's palette_saves row
  // never landed before this reconcile ran (tab closed, reload, offline).
  // Without pendingUnsaveIds, "local doesn't have it, server does" reads as
  // indistinguishable from a save made on another browser, and the union
  // pulls the deleted gradient straight back.
  it('does not resurrect a gradient whose delete is still pending', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000'])]

    const merged = await syncSaves('user-a', [], new Set(['p1']))

    expect(merged).toHaveLength(0)
  })

  it('still pulls down a genuinely different save while one delete is pending', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000']), serverRow('p2', ['#ff00ff', '#ffff00'])]

    const merged = await syncSaves('user-a', [], new Set(['p1']))

    expect(merged.map((g) => g.paletteId)).toEqual(['p2'])
  })
})

describe('flushPendingUnsaves', () => {
  it('removes each pending id and reports which ones succeeded', async () => {
    const cleared = await flushPendingUnsaves('user-a', ['p1', 'p2'])

    expect(cleared).toEqual(['p1', 'p2'])
    expect(deletes).toEqual([
      { table: 'palette_saves', user_id: 'user-a', palette_id: 'p1' },
      { table: 'palette_saves', user_id: 'user-a', palette_id: 'p2' },
    ])
  })

  it('returns nothing for an empty list without touching the network', async () => {
    const cleared = await flushPendingUnsaves('user-a', [])
    expect(cleared).toEqual([])
    expect(deletes).toEqual([])
  })

  it('leaves a failed id out of the cleared list, so the caller keeps tracking it', async () => {
    deleteFailsFor = new Set(['p2'])

    const cleared = await flushPendingUnsaves('user-a', ['p1', 'p2', 'p3'])

    expect(cleared).toEqual(['p1', 'p3'])
  })
})

describe('removeSave', () => {
  it('scopes the delete to one row of one user', async () => {
    await removeSave('user-a', 'p1')
    expect(deletes).toEqual([{ table: 'palette_saves', user_id: 'user-a', palette_id: 'p1' }])
  })
})
