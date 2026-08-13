import { describe, it, expect, beforeEach, vi } from 'vitest'

const oauthCalls: unknown[] = []
const linkCalls: unknown[] = []
let hasSession = true
let linkError: { message: string } | null = null

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: hasSession ? { user: { id: 'u' } } : null } }),
      signInWithOAuth: (opts: unknown) => {
        oauthCalls.push(opts)
        return Promise.resolve({ error: null })
      },
      linkIdentity: (opts: unknown) => {
        linkCalls.push(opts)
        return Promise.resolve({ error: linkError })
      },
    },
  },
}))

const { signInWithGoogle, linkGoogle, consumeSignInPending } = await import('./auth')

beforeEach(() => {
  oauthCalls.length = 0
  linkCalls.length = 0
  hasSession = true
  linkError = null
  sessionStorage.clear()
})

describe('consumeSignInPending', () => {
  it('is false when no sign-in was started', () => {
    expect(consumeSignInPending()).toBe(false)
  })

  it('reports a sign-in that was started before the redirect', async () => {
    // The mark is the only thing that survives OAuth's full page navigation —
    // by the time the app remounts the session is simply named, with no
    // "before" state left to compare against.
    await signInWithGoogle()
    expect(consumeSignInPending()).toBe(true)
  })

  it('fires once and only once', async () => {
    await signInWithGoogle()
    expect(consumeSignInPending()).toBe(true)
    // A re-render, or a later visit in the same tab, must not re-announce a
    // sign-in that already happened.
    expect(consumeSignInPending()).toBe(false)
  })

  it('marks the link path too, which is the ordinary signed-in-anonymously case', async () => {
    await linkGoogle()
    expect(linkCalls).toHaveLength(1)
    expect(consumeSignInPending()).toBe(true)
  })

  it('marks the no-session fallback, where linking degrades to plain OAuth', async () => {
    hasSession = false
    await linkGoogle()
    expect(oauthCalls).toHaveLength(1)
    expect(consumeSignInPending()).toBe(true)
  })

  it('survives storage being unavailable, without taking sign-in down with it', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    // Plan §13: a browser with storage blocked still signs in. All that is
    // lost is the confirmation toast.
    await expect(signInWithGoogle()).resolves.toBeUndefined()
    setItem.mockRestore()

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(consumeSignInPending()).toBe(false)
    getItem.mockRestore()
  })
})
