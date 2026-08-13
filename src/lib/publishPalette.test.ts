import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The rule under test is accounts plan §6: a DNA match reuses the existing row
 * only when it is the same author's (or nobody's). Get it wrong in the
 * permissive direction and one person's publish silently files their work
 * under someone else's byline.
 */

let existingRow: Record<string, unknown> | null = null
let sessionUserId: string | null = null
const inserts: Record<string, unknown>[] = []

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
          error: null,
        }),
    },
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.maybeSingle = () => Promise.resolve({ data: existingRow, error: null })
      chain.insert = (payload: Record<string, unknown>) => {
        inserts.push(payload)
        // publishPalette reads the new row's id back so the save layer can
        // reference it — see savedSync.pushSave.
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'new-row-id' }, error: null }),
          }),
        }
      }
      return chain
    },
  },
}))

const { publishPalette } = await import('./publishPalette')

const HEXES = ['#ff0000', '#0000ff']

beforeEach(() => {
  existingRow = null
  sessionUserId = null
  inserts.length = 0
})

describe('publishPalette — attribution', () => {
  it('stamps the publisher onto the row', async () => {
    sessionUserId = 'user-a'
    await publishPalette(HEXES, 'linear', undefined, 'Ash Vellum')
    expect(inserts[0].author_id).toBe('user-a')
  })

  it('publishes unattributed when there is no session', async () => {
    // Anonymous sign-in disabled or rate limited (plan §13) — publishing has
    // to keep working, exactly as it did before accounts existed.
    await publishPalette(HEXES, 'linear', undefined, 'Ash Vellum')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].author_id).toBeNull()
  })
})

describe('publishPalette — duplicate resolution', () => {
  it('reuses your own row rather than spawning a second copy', async () => {
    sessionUserId = 'user-a'
    existingRow = { slug: 'ash-vellum', colors: HEXES, shape: 'linear', author_id: 'user-a' }

    const result = await publishPalette(HEXES, 'linear', undefined, 'Ash Vellum')

    expect(result).toEqual({ success: true, slug: 'ash-vellum', displayName: 'Ash Vellum' })
    expect(inserts).toHaveLength(0)
  })

  it('gives a DIFFERENT author their own row, not somebody else’s byline', async () => {
    sessionUserId = 'user-b'
    existingRow = { slug: 'ash-vellum', colors: HEXES, shape: 'linear', author_id: 'user-a' }

    await publishPalette(HEXES, 'linear', undefined, 'Ash Vellum')

    expect(inserts).toHaveLength(1)
    expect(inserts[0].author_id).toBe('user-b')
  })

  it('reuses an unattributed row, which nobody is credited for', async () => {
    sessionUserId = 'user-a'
    existingRow = { slug: 'ash-vellum', colors: HEXES, shape: 'linear', author_id: null }

    await publishPalette(HEXES, 'linear', undefined, 'Ash Vellum')

    expect(inserts).toHaveLength(0)
  })

  it('does not reuse a row that merely shares a slug', async () => {
    sessionUserId = 'user-a'
    existingRow = { slug: 'ash-vellum', colors: ['#00ff00', '#000000'], shape: 'linear', author_id: 'user-a' }

    await publishPalette(HEXES, 'linear', undefined, 'Ash Vellum')

    expect(inserts).toHaveLength(1)
  })
})
