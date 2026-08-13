import { supabase } from './supabase'
import { publishGradient } from './publishPalette'
import { PALETTE_SELECT, toGradient, paletteDna, attachAuthors, type PaletteRow } from './paletteRow'
import type { Gradient } from '../store/types'

/**
 * Saves, server-side — accounts plan §5/§8 step 5.
 *
 * The shelf used to live only in Zustand's `persist`, which made it a property
 * of the browser rather than of the person. Here the server holds the truth
 * and localStorage becomes a cache: the same account opens the same collection
 * anywhere, and signing out can clear the local copy without destroying
 * anything.
 *
 * Saving implies publishing. `palette_saves.palette_id` references
 * `palettes(id)`, so a gradient has to exist in the shared table before it can
 * be saved to an account — which is consistent with the product decision in §2
 * that every gradient is public. A gradient saved while signed out is still
 * only local, and gets pushed up on the next sign-in.
 */

/** One `palette_saves` row joined to the palette it points at. */
interface SaveRow {
  palette_id: string
  created_at: string
  palettes: PaletteRow | null
}

/**
 * Everything this account has saved, newest first, as renderable gradients.
 *
 * A save whose palette row has since been deleted comes back with a null
 * embed; those are dropped rather than rendered as a hole.
 */
export async function fetchServerSaves(): Promise<Gradient[]> {
  const { data, error } = await supabase
    .from('palette_saves')
    .select(`palette_id, created_at, palettes(${PALETTE_SELECT})`)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as unknown as SaveRow[]
  // One byline query for the whole shelf, rather than one per save.
  const attached = new Map(
    (await attachAuthors(rows.map((r) => r.palettes).filter((p): p is PaletteRow => !!p))).map(
      (p) => [p.id, p],
    ),
  )
  return rows.flatMap((row) => {
    if (!row.palettes) return []
    const gradient = toGradient(attached.get(row.palettes.id) ?? row.palettes)
    if (!gradient) return []
    // The save's own timestamp, not the palette's: the shelf is ordered by
    // when you saved a thing, which is not when it was published.
    return [{ ...gradient, paletteId: row.palette_id, createdAt: new Date(row.created_at).getTime() }]
  })
}

/**
 * Records a save. Publishes the gradient first when it has no row yet, and
 * returns the palette id so the caller can remember the link.
 *
 * Idempotent: the (user_id, palette_id) primary key makes a repeat save a
 * conflict rather than a duplicate, and a conflict here means "already saved",
 * which is success.
 */
export async function pushSave(userId: string, gradient: Gradient): Promise<string | null> {
  let paletteId = gradient.paletteId
  if (!paletteId) {
    const published = await publishGradient(gradient)
    paletteId = published?.id
  }
  if (!paletteId) return null

  const { error } = await supabase
    .from('palette_saves')
    .upsert({ user_id: userId, palette_id: paletteId }, { onConflict: 'user_id,palette_id' })

  if (error) throw error
  return paletteId
}

/** Removes a save. Leaves the palette itself alone — unsaving is not deleting. */
export async function removeSave(userId: string, paletteId: string): Promise<void> {
  const { error } = await supabase
    .from('palette_saves')
    .delete()
    .eq('user_id', userId)
    .eq('palette_id', paletteId)

  if (error) throw error
}

/**
 * Reconciles the local shelf with the account's, and returns what the shelf
 * should now be.
 *
 * A **union**, deliberately: anything local that the server has not got is
 * pushed up, and anything on the server that is missing locally is pulled
 * down. Not a one-way overwrite in either direction — the server winning
 * would silently discard gradients saved while signed out, and the client
 * winning would wipe the shelf as soon as you opened a second browser.
 *
 * Matching is by DNA (shape + ordered hexes) rather than by id, because a
 * gradient saved locally has a client-minted uuid that has never been near the
 * database. Two saves of the same colours are the same shelf entry.
 */
export async function syncSaves(userId: string, local: Gradient[]): Promise<Gradient[]> {
  const server = await fetchServerSaves()
  const serverByDna = new Map(server.map((g) => [paletteDna(g), g]))

  const pushed: Gradient[] = []
  for (const gradient of local) {
    const dna = paletteDna(gradient)
    const match = serverByDna.get(dna)
    if (match) {
      // Already on the shelf server-side; keep the local entry but remember
      // which row it is, so unsaving later knows what to delete.
      pushed.push({ ...gradient, paletteId: match.paletteId })
      continue
    }
    try {
      const paletteId = await pushSave(userId, gradient)
      pushed.push(paletteId ? { ...gradient, paletteId } : gradient)
    } catch {
      // Offline or rejected: keep it locally and try again next sync rather
      // than dropping something the user saved.
      pushed.push(gradient)
    }
  }

  const localDna = new Set(local.map(paletteDna))
  const pulled = server.filter((g) => !localDna.has(paletteDna(g)))

  return [...pushed, ...pulled]
}
