import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getClientId, resetClientIdCache } from './clientId'

const KEY = 'palette-client-id'

beforeEach(() => {
  localStorage.clear()
  resetClientIdCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getClientId', () => {
  it('mints an id and persists it, so likes outlive a reload', () => {
    const id = getClientId()
    expect(id).toBeTruthy()
    expect(localStorage.getItem(KEY)).toBe(id)
  })

  it('returns the same id on every call within a session', () => {
    expect(getClientId()).toBe(getClientId())
  })

  it('reuses the stored id rather than minting a second one', () => {
    localStorage.setItem(KEY, 'existing-client')
    expect(getClientId()).toBe('existing-client')
  })

  it('still returns an id when storage cannot be read', () => {
    // Private mode / a partitioned storage context: throwing here would take
    // the whole app down at import time, since lib/supabase.ts calls this to
    // build its request headers.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(getClientId()).toBeTruthy()
  })

  it('still returns an id when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const id = getClientId()
    expect(id).toBeTruthy()
    // Unpersisted, but stable for the session — likes work until reload.
    expect(getClientId()).toBe(id)
  })

  it('falls back to a non-crypto id outside a secure context', () => {
    // crypto.randomUUID is absent on a plain-http LAN dev server.
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
      throw new TypeError('randomUUID is not a function')
    })
    expect(getClientId()).toMatch(/^c-/)
  })
})
