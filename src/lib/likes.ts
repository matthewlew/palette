import { supabase } from './supabase'
import { getClientId } from './clientId'

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * Record a like for a community palette, attributed to this browser's anonymous
 * client id (see lib/clientId.ts). Resolves true when the like is on the server.
 *
 * Callers apply the like optimistically and roll back on false — a like is a
 * shared signal, so a heart that stayed filled after the write failed would be
 * telling the user something untrue about what everyone else can see.
 */
export async function likePalette(paletteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('palette_likes')
    .insert({ palette_id: paletteId, client_id: getClientId() })

  // Already liked (double tap, or a retry after a response we never saw). The
  // end state the caller asked for holds, so this is a success, not a failure.
  if (error && error.code === UNIQUE_VIOLATION) return true
  if (error) {
    console.error('Failed to like palette:', error)
    return false
  }
  return true
}

/** Remove this browser's like. Resolves true when the row is gone. */
export async function unlikePalette(paletteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('palette_likes')
    .delete()
    .eq('palette_id', paletteId)
    .eq('client_id', getClientId())

  if (error) {
    console.error('Failed to unlike palette:', error)
    return false
  }
  return true
}
