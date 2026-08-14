import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

/**
 * The reappearing-delete bug lived exactly at the seam between the store
 * (synchronous, no network) and this hook (the network side). A store-only
 * test can show pendingUnsaves gets recorded; it can't show the hook actually
 * reads it back out on the next reconcile. This is that second half.
 */

let serverRows: { palette_id: string; created_at: string; palettes: unknown }[] = []
const deletes: string[] = []
let deleteFailsFor: Set<string> = new Set()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => Promise.resolve({ data: serverRows, error: null })
      chain.upsert = () => Promise.resolve({ error: null })
      chain.delete = () => {
        const del: Record<string, unknown> = {}
        del.eq = (col: string, val: unknown) => {
          if (col === 'palette_id') {
            if (deleteFailsFor.has(val as string)) return Promise.resolve({ error: new Error('offline') })
            deletes.push(val as string)
            // A real DELETE actually removes the row, so the very next
            // select (syncSaves' fetchServerSaves) would not see it either —
            // the mock has to make that true too, or a test here would be
            // asserting against a database that doesn't behave like Postgres.
            serverRows = serverRows.filter((r) => r.palette_id !== val)
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

const { useSavedSync } = await import('./useSavedSync')

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

const gradient: Gradient = {
  id: 'local-1',
  name: 'G',
  type: 'linear',
  stops: [{ hex: '#00ff00', position: 0 }, { hex: '#000000', position: 100 }],
} as Gradient

beforeEach(() => {
  serverRows = []
  deletes.length = 0
  deleteFailsFor = new Set()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('useSavedSync — pending-delete flush', () => {
  it('flushes a pending delete and does not let the union bring it back', async () => {
    // The server still has the row (the delete that was supposed to remove it
    // never landed before the tab closed), and the store remembers it was
    // meant to go — exactly the state a reload leaves behind.
    serverRows = [serverRow('p1', ['#00ff00', '#000000'])]
    useAppStore.setState({ saved: [], pendingUnsaves: ['p1'] })

    renderHook(() => useSavedSync('user-a'))

    await waitFor(() => expect(deletes).toEqual(['p1']))
    await waitFor(() => expect(useAppStore.getState().pendingUnsaves).toEqual([]))
    // The whole point: the gradient the flush just deleted must not be
    // sitting back in `saved` because the union treated it as a foreign save.
    expect(useAppStore.getState().saved).toEqual([])
  })

  it('keeps tracking a pending delete that fails to flush, and still excludes it from the union', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000'])]
    deleteFailsFor = new Set(['p1'])
    useAppStore.setState({ saved: [], pendingUnsaves: ['p1'] })

    renderHook(() => useSavedSync('user-a'))

    // Give the async reconcile a tick to run to completion.
    await waitFor(() => expect(useAppStore.getState().saved).toEqual([]))
    expect(useAppStore.getState().pendingUnsaves).toEqual(['p1'])
  })

  it('leaves an unrelated server save alone while one delete is pending', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000']), serverRow('p2', ['#ff00ff', '#ffff00'])]
    useAppStore.setState({ saved: [], pendingUnsaves: ['p1'] })

    renderHook(() => useSavedSync('user-a'))

    await waitFor(() => expect(useAppStore.getState().saved.map((g) => g.paletteId)).toEqual(['p2']))
  })

  it('does nothing when there is no pending delete to flush', async () => {
    serverRows = [serverRow('p1', ['#00ff00', '#000000'])]
    useAppStore.setState({ saved: [gradient] })

    renderHook(() => useSavedSync('user-a'))

    await waitFor(() => expect(useAppStore.getState().saved.length).toBeGreaterThan(0))
    expect(deletes).toEqual([])
  })
})
