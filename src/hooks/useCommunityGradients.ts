import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Gradient } from '../store/types'
import type { GradientType } from '../lib/gradient'

/** Rows per request. Also the size of the first page, so the initial view is
 * unchanged from when 50 was the whole list — the rest is now reachable
 * instead of discarded. */
export const COMMUNITY_PAGE_SIZE = 50

type PaletteRow = {
  id: string
  display_name: string
  colors: string[]
  offsets: unknown
  shape: string
  angle: number | null
  created_at: string
}

function toGradient(row: PaletteRow): Gradient {
  const offsets: number[] | null = Array.isArray(row.offsets) ? row.offsets : null
  const stops = row.colors.map((hex: string, i: number) => ({
    hex,
    position: offsets?.[i] ?? (row.colors.length === 1 ? 0 : Math.round((i / (row.colors.length - 1)) * 100)),
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
  }
}

/** Two palettes with the same shape and the same colors in the same order are
 * the same palette, however many people published it. */
function dna(g: Gradient): string {
  return `${g.type}-${g.stops.map((s) => s.hex).join('-')}`
}

/**
 * The community feed, one page at a time.
 *
 * It used to ask for 200 rows, dedupe them, and then throw away everything
 * past the 50th — so the tail of the feed was not merely unpaginated, it was
 * unreachable, and the cap moved with the duplicates (a run of reposts could
 * cost you real palettes). Now every page is kept, `loadMore` fetches the
 * next, and `hasMore` reports whether the server still has rows.
 *
 * `hasMore` is keyed on the RAW row count, not the deduplicated one: a page
 * that happens to be all reposts adds nothing to the list while the feed
 * plainly continues, and treating that as the end would strand the rest.
 */
export function useCommunityGradients() {
  const [gradients, setGradients] = useState<Gradient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  // Rows requested so far — the paging cursor. Counts raw rows, so it stays
  // aligned with the server's ordering even when dedupe drops some.
  const fetchedRowsRef = useRef(0)
  const seenDnaRef = useRef(new Set<string>())
  // One request at a time: a double-tapped Load more (or StrictMode's double
  // effect) would otherwise fetch the same page twice.
  const inFlightRef = useRef(false)

  const fetchPage = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    const from = fetchedRowsRef.current
    if (from > 0) setLoadingMore(true)

    try {
      const { data, error } = await supabase
        .from('palettes')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + COMMUNITY_PAGE_SIZE - 1)

      if (error) throw error

      const rows: PaletteRow[] = data ?? []
      fetchedRowsRef.current = from + rows.length
      setHasMore(rows.length === COMMUNITY_PAGE_SIZE)

      const fresh: Gradient[] = []
      for (const row of rows) {
        const gradient = toGradient(row)
        const key = dna(gradient)
        if (seenDnaRef.current.has(key)) continue
        seenDnaRef.current.add(key)
        fresh.push(gradient)
      }
      if (fresh.length > 0) setGradients((prev) => [...prev, ...fresh])
    } catch (err) {
      console.error('Failed to fetch community gradients:', err)
      // Leave hasMore alone so a failed page stays retryable — the button is
      // the retry. Only a short page means the feed genuinely ended.
    } finally {
      inFlightRef.current = false
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchPage()
  }, [fetchPage])

  const deleteGradient = async (id: string) => {
    try {
      const { error } = await supabase.from('palettes').delete().eq('id', id)
      if (error) throw error
      setGradients((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      console.error('Failed to delete gradient:', err)
      alert('Failed to delete gradient.')
    }
  }

  return { gradients, loading, loadingMore, hasMore, loadMore: fetchPage, deleteGradient }
}
