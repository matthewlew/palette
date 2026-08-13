import { supabase } from './supabase'
import { PALETTE_SELECT, paletteDna, toGradient, attachAuthors, type PaletteRow } from './paletteRow'
import type { Gradient } from '../store/types'

/**
 * Claiming unsigned gradients — accounts plan §5.
 *
 * The rows that predate accounts have no author and render with no byline,
 * which is honest: nobody signed them. If a signer's browser still holds a
 * local copy of one, it is probably theirs, and this offers it back.
 *
 * "Probably" is doing real work in that sentence. A colour match is a guess,
 * not proof — two people could each have generated the same gradient — which
 * is why the UI asks rather than acting silently, and why claiming is the one
 * true consent prompt in the product. What makes it *safe* is that the RPC
 * only ever writes where `author_id is null`, so nothing can change hands.
 */

/** An unsigned row whose colours match something on this browser's shelf. */
export interface ClaimCandidate {
  paletteId: string
  gradient: Gradient
}

/**
 * Unsigned rows matching the local shelf.
 *
 * Filters `author_id is null` server-side rather than fetching the feed and
 * checking here: an already-owned row is not a candidate under any
 * circumstance, and asking the database keeps that true regardless of what the
 * client believes.
 */
export async function findClaimable(local: Gradient[]): Promise<ClaimCandidate[]> {
  if (local.length === 0) return []

  const { data, error } = await supabase
    .from('palettes')
    .select(PALETTE_SELECT)
    .is('author_id', null)

  if (error) throw error

  const wanted = new Set(local.map(paletteDna))
  const seen = new Set<string>()
  const candidates: ClaimCandidate[] = []

  // Unsigned by definition, so there are no bylines to attach — but the
  // shape stays consistent with every other read path.
  const rows = await attachAuthors((data ?? []) as PaletteRow[])
  for (const row of rows) {
    const gradient = toGradient(row)
    if (!gradient) continue
    const dna = paletteDna(gradient)
    if (!wanted.has(dna) || seen.has(dna)) continue
    // One offer per distinct gradient. Duplicated unsigned rows of the same
    // colours would otherwise present as several separate things to claim,
    // which reads as a mistake rather than as thoroughness.
    seen.add(dna)
    candidates.push({ paletteId: row.id, gradient })
  }

  return candidates
}

/** Puts the current account's name on the given rows. Returns how many moved. */
export async function claimPalettes(paletteIds: string[]): Promise<number> {
  if (paletteIds.length === 0) return 0

  // Stringified at the boundary. The RPC takes `text[]` and compares
  // `id::text` precisely because palettes.id is uuid in some deployments and
  // bigint in others (0005's own note) — but on a bigint deployment PostgREST
  // hands back JSON numbers, `PaletteRow.id: string` quietly does not hold,
  // and the body goes out as `[1,2]` against a text[] parameter.
  const { data, error } = await supabase.rpc('claim_palettes', { p_ids: paletteIds.map(String) })
  if (error) throw error
  return (data as number) ?? 0
}

/**
 * What to put on screen when a claim fails.
 *
 * Every branch below is a DIFFERENT problem needing a different response, and
 * the modal used to answer all of them with "Try again" — advice that is wrong
 * for all but one, and which threw away the only evidence of which had
 * happened. Same treatment SignInModal already gives its own failures.
 *
 * The RPC's two guards should be unreachable from the modal: it is only
 * offered to a signed-in account that already has a profile. Reaching them
 * anyway means the browser's session and the server's disagree, so the advice
 * is to re-establish the session rather than to retry the same call.
 *
 * The fallback carries the raw message rather than replacing it. An
 * unrecognised failure is exactly the one worth being able to read.
 */
export function claimErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : ''
  const lower = message.toLowerCase()

  // PGRST202: PostgREST could not find the function. The client is talking to
  // a database that never ran 0005 — a deploy problem, not a user problem.
  if (code === 'PGRST202' || lower.includes('could not find the function')) {
    return 'Claiming is not available on this server yet. (The claim function is missing.)'
  }
  // PGRST203: two overloads of the same name, so PostgREST cannot pick one.
  if (code === 'PGRST203' || lower.includes('could not choose the best candidate')) {
    return 'Claiming is misconfigured on this server. (More than one claim function.)'
  }
  if (code === '28000' || lower.includes('not authenticated')) {
    return "You're signed out on this server. Reload and sign in again."
  }
  if (code === '23503' || lower.includes('no profile')) {
    return 'Pick a username first, then claim.'
  }
  if (code === '42501' || lower.includes('permission denied')) {
    return "This account isn't allowed to claim. Reload and sign in again."
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  return message ? `Couldn't claim those: ${message}` : "Couldn't claim those. Try again."
}
