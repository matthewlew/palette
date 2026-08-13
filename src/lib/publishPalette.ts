import { supabase } from './supabase'
import { namePalette } from './naming'
import { isProfane } from './profanity'
import type { Gradient } from '../store/types'

/** Publish a Gradient to the shared DB so it becomes searchable in the gallery.
 * Convenience wrapper over publishPalette that pulls hexes/offsets/angle/name
 * off the gradient. Used by every save/share/export path. */
/** Origin is nullable ON PURPOSE and must not be coerced to 0.
 *
 * getRadialConfig treats `null`/`undefined` as CENTRE and `0` as TOP — two
 * different origins. Every `angle ?? 0` on a publish or load path therefore
 * silently re-anchors a centred Turrell (or radial) to the top edge, which is
 * why shared posts came back with the wrong origin. Keep it nullable end to end.
 */

export function publishGradient(gradient: Gradient) {
  return publishPalette(
    gradient.stops.map((s) => s.hex),
    gradient.type,
    gradient.angle,
    gradient.name,
    gradient.stops.map((s) => s.position),
  )
}

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function publishPalette(
  hexes: string[],
  shape: string,
  angle?: number,
  providedName?: string,
  /** Stop offset positions (0-100), aligned to `hexes`. Persisted so uneven
   * stop spacing reproduces exactly on load; omit for evenly-spaced stops. */
  offsets?: number[],
) {
  // 1. Use the provided name or generate one using the engine
  let baseName = providedName?.trim() || namePalette(hexes)
  
  // If the provided name contains profanity, fallback to the generated one
  if (isProfane(baseName)) {
    baseName = namePalette(hexes)
  }

  let displayName = baseName
  let slug = generateSlug(displayName)

  // Who is publishing. Null when there is no session at all (anonymous
  // sign-in disabled or rate limited — accounts plan §13), which keeps
  // publishing working exactly as it did before accounts existed.
  let authorId: string | null = null
  try {
    const { data } = await supabase.auth.getSession()
    authorId = data.session?.user.id ?? null
  } catch {
    /* no session — publish unattributed */
  }

  // Dedup: if a gradient with this slug and identical colors + shape already
  // exists, reuse it instead of spawning a near-duplicate "Name 2" row (common
  // when the same gradient is exported/shared repeatedly). Best-effort — any
  // error here falls through to a normal insert so publishing never breaks.
  try {
    const { data: existing } = await supabase
      .from('palettes')
      .select('id,slug,colors,shape,author_id')
      .eq('slug', slug)
      .maybeSingle()
    if (
      existing &&
      existing.shape === shape &&
      JSON.stringify(existing.colors) === JSON.stringify(hexes) &&
      // Reuse only when it is the same person's row (a re-share should not
      // spawn a second copy) or when nobody owns it. A DIFFERENT author
      // publishing the same colours gets their own row and their own byline
      // — reusing here would file their work under someone else's name.
      // Accounts plan §6.
      (existing.author_id == null || existing.author_id === authorId)
    ) {
      return { success: true, id: existing.id as string, slug: existing.slug, displayName }
    }
  } catch {
    /* ignore — proceed to insert */
  }

  let isSaved = false
  let attemptNumber = 1

  while (!isSaved) {
    // 2. Try to insert it into Supabase
    // `select().single()` so the caller gets the row id back: palette_saves
    // references palettes(id), so a save cannot be recorded server-side
    // without it.
    const { data: inserted, error } = await supabase
      .from('palettes')
      .insert({
        slug: slug,
        display_name: displayName,
        colors: hexes,
        shape: shape,
        angle: angle ?? null,
        offsets: offsets ?? null,
        author_id: authorId,
      })
      .select('id')
      .single()

    if (!error) {
      // Success! It was totally unique.
      isSaved = true
      return { success: true, id: inserted?.id as string | undefined, slug, displayName }
    } 
    
    // 3. If there is a conflict (slug is already taken)
    // Postgres Unique Violation code is '23505'
    if (error.code === '23505') { 
      attemptNumber++
      // Update the name and slug to include the new number
      displayName = `${baseName} ${attemptNumber}`
      slug = generateSlug(displayName)
    } else {
      // Some other database error occurred
      throw new Error(`Supabase Error: ${error.message}`)
    }
  }
}
