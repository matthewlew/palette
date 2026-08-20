import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toGradient, paletteDna, PALETTE_SELECT, type PaletteRow } from '../lib/paletteRow'
import type { Gradient } from '../store/types'

/** High enough to cover the whole community table for the foreseeable
 * future without needing real pagination — this is a one-shot snapshot
 * fetched once per voting session, not a live infinite-scroll feed. */
const VOTING_POOL_LIMIT = 2000

/**
 * The candidate pool for gradient voting — deliberately NOT
 * useCommunityGradients('recent'), which caps at one paginated page
 * (COMMUNITY_PAGE_SIZE = 100 rows) and never calls loadMore on its own.
 * A voting session that draws from just that first page structurally
 * excludes every gradient published earlier than it from EVER being
 * shown — with a few hundred community gradients split across ~6 shapes,
 * that first page alone is thin enough per shape that the same handful
 * repeat constantly. Voting doesn't need live/paginated semantics, only
 * broad coverage, so this fetches everything (up to VOTING_POOL_LIMIT)
 * once per mount instead.
 */
export function useVotingPool() {
  const [gradients, setGradients] = useState<Gradient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('palettes')
      .select(PALETTE_SELECT)
      .order('id')
      .limit(VOTING_POOL_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          console.error('Failed to fetch voting pool:', error)
          setLoading(false)
          return
        }
        const seen = new Set<string>()
        const fresh: Gradient[] = []
        for (const row of data as PaletteRow[]) {
          const gradient = toGradient(row)
          if (!gradient) continue
          const key = paletteDna(gradient)
          if (seen.has(key)) continue
          seen.add(key)
          fresh.push(gradient)
        }
        setGradients(fresh)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { gradients, loading }
}
