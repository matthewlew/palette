import { isSharePayloadGradient, toSharePayloadGradient } from './gradientCodec'
import type { SharePayloadGradient } from './gradientCodec'
import type { Gradient } from '../store/types'

/** One entry in the sole-curator Inspiration feed (public/curated.json).
 * The gradient reuses the share-codec wire shape so a curated entry can be
 * produced by "Copy as curated entry" and pasted into the file verbatim —
 * one serializer, one validator, no reshaping. The display title is the
 * gradient's own `name`. */
export interface CuratedEntry {
  id: string
  /** IG-length editorial caption in the curator's voice. */
  note: string
  /** ISO date the entry was published; feed renders newest-first. */
  date: string
  gradient: SharePayloadGradient
}

export function isCuratedEntry(value: unknown): value is CuratedEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.note === 'string' &&
    typeof v.date === 'string' &&
    isSharePayloadGradient(v.gradient)
  )
}

/** Per-entry validation: malformed entries are skipped (with a warning) so
 * one bad paste never takes down the whole feed. Newest first. */
export function parseCurated(data: unknown): CuratedEntry[] {
  if (!Array.isArray(data)) return []
  const entries: CuratedEntry[] = []
  for (const item of data) {
    if (isCuratedEntry(item)) {
      entries.push(item)
    } else {
      console.warn('curated.json: skipping invalid entry', item)
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

export interface CuratedResult {
  entries: CuratedEntry[]
  /** True when the fetch itself failed (network/HTTP/parse) — the UI shows
   * a quiet retry toast instead of the "nothing picked yet" empty state.
   * A missing file (404) counts as empty, not error: the feed simply has
   * no published entries yet. */
  error: boolean
}

/** Fetches the curated feed. Never throws — the Inspiration segment shows
 * an empty or error state and the rest of the app is unaffected.
 * `cache: 'no-cache'` keeps a fresh publish from being masked by browser
 * caching. */
export async function loadCurated(): Promise<CuratedResult> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}curated.json`, { cache: 'no-cache' })
    if (response.status === 404) return { entries: [], error: false }
    if (!response.ok) return { entries: [], error: true }
    return { entries: parseCurated(await response.json()), error: false }
  } catch {
    return { entries: [], error: true }
  }
}

/** Serializes a gradient as a ready-to-paste curated entry (id + date
 * pre-filled, note left for the curator). Round-trips through
 * isCuratedEntry by construction. */
export function toCuratedEntryJson(gradient: Gradient): string {
  const entry: CuratedEntry = {
    id: crypto.randomUUID(),
    note: '',
    date: new Date().toISOString().slice(0, 10),
    gradient: toSharePayloadGradient(gradient),
  }
  return JSON.stringify(entry, null, 2)
}
