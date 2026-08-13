import type { Gradient } from '../store/types'
import type { GradientType } from './gradient'

/**
 * What every read of `palettes` asks for. One constant rather than the same
 * string in the feed, search and the deep-link loader: those three had already
 * been `select('*')` in three places, and a byline added to one of them is a
 * byline missing from the other two.
 *
 * `author:profiles(username)` is a LEFT join — PostgREST returns null for a row
 * with no matching profile rather than dropping it — so legacy and unsigned
 * rows keep rendering, just without a name.
 */
export const PALETTE_SELECT = '*, author:profiles(username)'

/** A row of the shared `palettes` table, as the anon client reads it. */
export interface PaletteRow {
  id: string
  display_name: string
  colors: string[]
  offsets: unknown
  shape: string
  angle: number | null
  created_at: string
  /** Cached like count. Absent until migration 0002 has been applied. */
  likes?: number | null
  /** Who published this. Null on legacy rows, and on rows whose author has
   * since deleted their account (`on delete set null`, migration 0003). */
  author_id?: string | null
  /** The embedded `profiles` row, when the select asked for it. PostgREST
   * returns an object for a to-one embed and null when there is no match, so
   * this is absent on a select that did not embed and null on one that did. */
  author?: { username: string } | null
}

/** `#rgb` or `#rrggbb`. Anything else is not a colour this app can render, and
 * several things downstream throw on it rather than degrade. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * Can this row be drawn at all?
 *
 * A row is not a palette unless it has at least two parseable colours. Below
 * that, three separate things throw and take the whole page down with them,
 * because nothing renders inside an error boundary:
 *
 *   - one colour   → buildGradientCss's assertStops, "A gradient requires at
 *                    least 2 stops"
 *   - no colours   → namePalette reduces an empty array with no initial value
 *   - a bad hex    → LDS ink parsing, "lds-ink: bad hex"
 *
 * This is not hypothetical tidiness. Paging the community feed made rows past
 * the 50th reachable for the first time — before, they were fetched and thrown
 * away — so a malformed row sitting deep in the table went from invisible to
 * fatal on whichever page it happened to land.
 */
export function isRenderableRow(row: PaletteRow): boolean {
  return (
    Array.isArray(row.colors) &&
    row.colors.length >= 2 &&
    row.colors.every((hex) => typeof hex === 'string' && HEX.test(hex.trim()))
  )
}

/**
 * One mapping from a `palettes` row to a Gradient, shared by the community feed
 * and by search. Returns null for a row that cannot be drawn — callers drop
 * those rather than render them, which is the difference between one missing
 * tile and a white screen.
 *
 * These were two copies that had already drifted once; a palette carries a like
 * count now, and a second copy would have meant search results showing every
 * palette at zero.
 */
export function toGradient(row: PaletteRow): Gradient | null {
  if (!isRenderableRow(row)) return null
  return unsafeToGradient(row)
}

function unsafeToGradient(row: PaletteRow): Gradient {
  // Persisted stop offsets when present, so uneven spacing reproduces exactly;
  // older rows fall back to even spacing.
  const offsets: number[] | null = Array.isArray(row.offsets) ? row.offsets : null
  // isRenderableRow guarantees two or more parseable colours, so the divisor
  // below is never zero and the trim always leaves a valid hex.
  const stops = row.colors.map((hex: string, i: number) => ({
    hex: hex.trim(),
    position: offsets?.[i] ?? Math.round((i / (row.colors.length - 1)) * 100),
    id: `stop-${i}`,
  }))

  return {
    id: row.id,
    name: row.display_name,
    type: row.shape as GradientType,
    stops,
    angle: row.angle ?? undefined, // null = centred; see publishPalette
    fanAnchor: 'bottom',
    reversed: false,
    hardStops: false,
    repeatEnabled: false,
    createdAt: new Date(row.created_at).getTime(),
    likeCount: row.likes ?? 0,
    // Both halves have to be present: author_id without a profile means the
    // handle was never claimed, and a byline needs something to say.
    ...(row.author_id && row.author?.username
      ? { author: { id: row.author_id, username: row.author.username } }
      : {}),
  }
}

/** Two palettes with the same shape and the same colors in the same order are
 * the same palette, however many people published it. */
export function paletteDna(g: Gradient): string {
  return `${g.type}-${g.stops.map((s) => s.hex).join('-')}`
}
