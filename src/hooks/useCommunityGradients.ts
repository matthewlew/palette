import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Gradient } from '../store/types'
import { toGradient, paletteDna as dna, PALETTE_SELECT, type PaletteRow } from '../lib/paletteRow'

/** Rows per request, and the size of the first page.
 *
 * 100, not 50. 50 was chosen when it was the whole list, and it reads fine on a
 * phone — but a desktop dense grid is six or seven across, so 50 is eight rows
 * and you hit Load more almost immediately. One page size for both rather than
 * a breakpoint-dependent one: the cursor counts rows fetched, so a page size
 * that changed when the window was resized would page over a moving offset. */
export const COMMUNITY_PAGE_SIZE = 100

/** How the community feed is ordered. Both are server-side — see below. */
export type CommunityOrder = 'recent' | 'popular'

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
 *
 * ORDERING IS SERVER-SIDE, and has to be. Sorting the pages already loaded
 * would rank a window rather than the feed — the most-liked palette in the
 * table is quite likely to be on page five, and no amount of client-side
 * sorting of pages one and two will surface it. Changing the order therefore
 * restarts paging from the top.
 */
export function useCommunityGradients(order: CommunityOrder = 'recent') {
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
  // Bumped every time the feed restarts. A request carries the generation it
  // was issued under and its response is dropped if that has moved on.
  //
  // Without this, flipping Recent -> Popular -> Recent races: each switch
  // clears the in-flight guard so the next query can start, and whichever
  // response lands last wins. The one that lands last is not necessarily the
  // one you asked for last, so a popular-ordered page could be appended to a
  // list that is supposed to be in date order.
  const generationRef = useRef(0)

  const fetchPage = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    const generation = generationRef.current
    const from = fetchedRowsRef.current
    if (from > 0) setLoadingMore(true)

    try {
      let query = supabase.from('palettes').select(PALETTE_SELECT)
      // Popular leads with the count and falls back to newest, so that among
      // the many palettes sharing a like count the fresh ones come first.
      if (order === 'popular') {
        query = query.order('likes', { ascending: false, nullsFirst: false })
      }
      // `id` last, always. offset/limit paging over a non-unique sort key has
      // no defined order between equal rows, so the database is free to return
      // a row on page one AND page two, or on neither. Most palettes share a
      // like count (nearly all of them zero), which would have made that the
      // normal case rather than an edge one. A unique final key makes the sort
      // total and paging deterministic.
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + COMMUNITY_PAGE_SIZE - 1)

      if (error) throw error
      // Superseded while in flight — the order changed under it. Its rows
      // belong to a feed that is no longer on screen.
      if (generation !== generationRef.current) return

      const rows: PaletteRow[] = data ?? []
      fetchedRowsRef.current = from + rows.length
      setHasMore(rows.length === COMMUNITY_PAGE_SIZE)

      const fresh: Gradient[] = []
      for (const row of rows) {
        // Null = a row that cannot be drawn (see isRenderableRow). Dropping it
        // costs one tile; rendering it throws and takes the gallery with it.
        const gradient = toGradient(row)
        if (!gradient) continue
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
      // A superseded request must not clear the flags belonging to the request
      // that replaced it — doing so would let a third query start mid-flight
      // and turn the loading state off while the live one is still running.
      if (generation === generationRef.current) {
        inFlightRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [order])

  useEffect(() => {
    // A new order is a new feed: the cursor, the dedupe memory and the list all
    // belong to the old one. Keeping any of them would page into the new
    // ordering at the old offset and silently drop everything the previous
    // order had already shown.
    generationRef.current += 1
    fetchedRowsRef.current = 0
    seenDnaRef.current = new Set<string>()
    inFlightRef.current = false
    setGradients([])
    setHasMore(false)
    setLoading(true)
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
