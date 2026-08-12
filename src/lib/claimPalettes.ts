import { supabase } from './supabase'
import { PALETTE_SELECT, paletteDna, toGradient, type PaletteRow } from './paletteRow'
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

  for (const row of (data ?? []) as PaletteRow[]) {
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

  const { data, error } = await supabase.rpc('claim_palettes', { p_ids: paletteIds })
  if (error) throw error
  return (data as number) ?? 0
}
