const STORAGE_KEY = 'palette-client-id'

let cached: string | null = null

/**
 * A stable, anonymous id for this browser.
 *
 * It exists so a like can be attributed to *someone* without an account: one
 * client id gets one like per palette, and unliking can find the row it wrote.
 * It is not an identity and is not a secret — it is generated here, stored in
 * localStorage, and sent in the clear. Clearing site data mints a new one and
 * orphans the old likes, which is the correct trade for not having accounts.
 *
 * Deliberately free of imports: lib/supabase.ts reads this at module load to
 * set a request header, so anything imported here would load before the client.
 */
export function getClientId(): string {
  if (cached) return cached

  // Private mode, a hostile storage partition, or a non-browser (test/SSR)
  // context: fall back to a per-session id rather than throwing. Likes then
  // work for the session and don't persist, which beats the feature crashing.
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (stored) {
      cached = stored
      return stored
    }
  } catch {
    /* unreadable storage — mint a fresh one below */
  }

  const minted = randomId()
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, minted)
  } catch {
    /* unwritable storage — the id lives for this session only */
  }
  cached = minted
  return minted
}

function randomId(): string {
  // crypto.randomUUID needs a secure context; a LAN-IP dev server isn't one, so
  // it can genuinely be missing at runtime whatever the types say. Uniqueness is
  // all that's asked of this value, not unguessability.
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/** Test seam. Resets the memoised value so a fresh localStorage is re-read. */
export function resetClientIdCache(): void {
  cached = null
}
