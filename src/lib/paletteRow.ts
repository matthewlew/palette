import type { Gradient } from '../store/types'
import type { GradientType } from './gradient'

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
}

/**
 * One mapping from a `palettes` row to a Gradient, shared by the community feed
 * and by search.
 *
 * These were two copies that had already drifted once; a palette carries a like
 * count now, and a second copy would have meant search results showing every
 * palette at zero.
 */
export function toGradient(row: PaletteRow): Gradient {
  // Persisted stop offsets when present, so uneven spacing reproduces exactly;
  // older rows fall back to even spacing.
  const offsets: number[] | null = Array.isArray(row.offsets) ? row.offsets : null
  const stops = row.colors.map((hex: string, i: number) => ({
    hex,
    position:
      offsets?.[i] ??
      (row.colors.length === 1 ? 0 : Math.round((i / (row.colors.length - 1)) * 100)),
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
  }
}

/** Two palettes with the same shape and the same colors in the same order are
 * the same palette, however many people published it. */
export function paletteDna(g: Gradient): string {
  return `${g.type}-${g.stops.map((s) => s.hex).join('-')}`
}
