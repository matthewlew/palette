import { describe, it, expect, beforeEach, vi } from 'vitest'
import { likePalette, unlikePalette } from './likes'
import { getClientId } from './clientId'

const inserted: unknown[] = []
const deleteFilters: [string, unknown][] = []
let insertError: { code?: string; message: string } | null = null
let deleteError: { code?: string; message: string } | null = null

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserted.push({ table, row })
        return Promise.resolve({ error: insertError })
      },
      delete: () => {
        const chain = {
          eq: (col: string, val: unknown) => {
            deleteFilters.push([col, val])
            // PostgREST resolves on await, so every .eq() has to be thenable.
            return Object.assign(Promise.resolve({ error: deleteError }), chain)
          },
        }
        return chain
      },
    }),
  },
}))

beforeEach(() => {
  inserted.length = 0
  deleteFilters.length = 0
  insertError = null
  deleteError = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('likePalette', () => {
  it('records the like against this browser, which is the whole account model', async () => {
    await expect(likePalette('p1')).resolves.toBe(true)
    expect(inserted).toEqual([
      { table: 'palette_likes', row: { palette_id: 'p1', client_id: getClientId() } },
    ])
  })

  it('treats an already-liked row as success, not failure', async () => {
    // A double tap, or a retry after a response that never arrived. The end
    // state the caller asked for holds, so rolling the heart back would be
    // wrong — the like really is on the server.
    insertError = { code: '23505', message: 'duplicate key value' }
    await expect(likePalette('p1')).resolves.toBe(true)
  })

  it('reports failure so the caller can roll the heart back', async () => {
    // What an unapplied migration 0002 looks like from here.
    insertError = { code: '42P01', message: 'relation "palette_likes" does not exist' }
    await expect(likePalette('p1')).resolves.toBe(false)
  })
})

describe('unlikePalette', () => {
  it('removes only this browser’s like for that palette', async () => {
    await expect(unlikePalette('p1')).resolves.toBe(true)
    expect(deleteFilters).toEqual([
      ['palette_id', 'p1'],
      ['client_id', getClientId()],
    ])
  })

  it('reports failure so the caller can restore the heart', async () => {
    deleteError = { code: '42501', message: 'permission denied' }
    await expect(unlikePalette('p1')).resolves.toBe(false)
  })
})
