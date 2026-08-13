import { supabase } from './supabase'

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * The uid this like belongs to. Null when there is no session at all —
 * anonymous sign-in disabled, rate limited, or storage blocked (accounts plan
 * §13) — in which case liking is simply unavailable, as the RLS policies in
 * migration 0006 require a JWT.
 */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

/**
 * Record a like for a community palette, attributed to the current session's
 * uid. Resolves true when the like is on the server.
 *
 * Callers apply the like optimistically and roll back on false — a like is a
 * shared signal, so a heart that stayed filled after the write failed would be
 * telling the user something untrue about what everyone else can see.
 *
 * This used to be attributed to a client id the browser minted and echoed in a
 * request header, which anyone could forge. Migration 0006 repointed the
 * policies at auth.uid(), so the attribution is now signed.
 */
export async function likePalette(paletteId: string): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false

  const { error } = await supabase
    .from('palette_likes')
    .insert({ palette_id: paletteId, user_id: userId })

  // Already liked (double tap, or a retry after a response we never saw). The
  // end state the caller asked for holds, so this is a success, not a failure.
  if (error && error.code === UNIQUE_VIOLATION) return true
  if (error) {
    console.error('Failed to like palette:', error)
    return false
  }
  return true
}

/** Remove this account's like. Resolves true when the row is gone. */
export async function unlikePalette(paletteId: string): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false

  const { error } = await supabase
    .from('palette_likes')
    .delete()
    .eq('palette_id', paletteId)
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to unlike palette:', error)
    return false
  }
  return true
}
