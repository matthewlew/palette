import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Gradient } from '../store/types'
import type { GradientType } from '../lib/gradient'
import { COLOR_NOUNS, type HueFamily } from '../lib/namingWords'
import styles from './SearchBar.module.css'

/** Search hits, split by where they came from. Yours are matched locally and
 * land immediately; community comes back from Supabase after the debounce. */
export interface SearchResults {
  mine: Gradient[]
  community: Gradient[]
}

interface SearchBarProps {
  onResults: (results: SearchResults | null) => void;
  /** Your saved palettes, matched locally by name. Search used to hit only the
   * community table, so a search from the "Yours" tab returned other people's
   * palettes and yours were nowhere — the tab said one thing and the results
   * showed another. */
  saved?: Gradient[];
  /** Told when the field gains or loses a query, so the gallery can go
   * full-screen on mobile. */
  onActiveChange?: (active: boolean) => void;
  /** Renders a Cancel affordance beside the field (mobile full-screen). */
  onCancel?: () => void;
}

/** Local name match. Deliberately dumber than the community query — it is a
 * substring test on the name you gave it, which is what you are reaching for
 * when you search your own small library. */
function matchSaved(saved: Gradient[], query: string): Gradient[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const words = q.split(/\s+/)
  return saved.filter((g) => {
    const name = (g.name ?? '').toLowerCase()
    return words.every((w) => name.includes(w))
  })
}

export function SearchBar({ onResults, saved = [], onActiveChange, onCancel }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      onResults(null)
      onActiveChange?.(false)
      return
    }
    onActiveChange?.(true)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    // Yours land on the FIRST keystroke, not after the network. The whole point
    // of showing them first is that the screen is never blank while the
    // community query is in flight.
    const mine = matchSaved(saved, query)
    onResults({ mine, community: [] })

    setLoading(true)
    debounceTimer.current = window.setTimeout(async () => {
      try {
        let queryBuilder = supabase
          .from('palettes')
          .select('*')
          
        const words = query.trim().split(/\s+/)
        for (const word of words) {
          const lowerWord = word.toLowerCase()
          
          let familyKey: HueFamily | null = null
          if (lowerWord === 'red') familyKey = 'red'
          else if (lowerWord === 'orange') familyKey = 'orange'
          else if (lowerWord === 'amber') familyKey = 'amber'
          else if (lowerWord === 'yellow') familyKey = 'yellow'
          else if (lowerWord === 'lime') familyKey = 'lime'
          else if (lowerWord === 'green') familyKey = 'green'
          else if (lowerWord === 'teal') familyKey = 'teal'
          else if (lowerWord === 'cyan' || lowerWord === 'blue') familyKey = lowerWord === 'cyan' ? 'cyanBlue' : 'blue'
          else if (lowerWord === 'violet') familyKey = 'violet'
          else if (lowerWord === 'purple') familyKey = 'purple'
          else if (lowerWord === 'pink') familyKey = 'pink'
          else if (['neutral', 'grey', 'gray', 'black', 'white'].includes(lowerWord)) familyKey = 'neutral'

          if (familyKey) {
            const nouns = [
              ...COLOR_NOUNS[familyKey].dark,
              ...COLOR_NOUNS[familyKey].mid,
              ...COLOR_NOUNS[familyKey].light
            ]
            const orString = `display_name.ilike.%${word}%,` + nouns.map(n => `display_name.ilike.%${n}%`).join(',')
            queryBuilder = queryBuilder.or(orString)
          } else {
            queryBuilder = queryBuilder.ilike('display_name', `%${word}%`)
          }
        }
        
        const { data, error } = await queryBuilder.limit(20)

        if (error) throw error

        if (data) {
          const gradients: Gradient[] = data.map(row => {
            // Use persisted stop offsets when present so uneven spacing renders
            // accurately; fall back to even spacing for older rows.
            const offsets: number[] | null = Array.isArray(row.offsets) ? row.offsets : null
            const stops = row.colors.map((hex: string, i: number) => ({
              hex,
              position: offsets?.[i] ?? (row.colors.length === 1 ? 0 : Math.round((i / (row.colors.length - 1)) * 100)),
              id: `stop-${i}`
            }));

            return {
              id: row.id,
              name: row.display_name,
              type: row.shape as GradientType,
              stops,
              // Restore rotation / radial-origin so the preview matches what was
              // saved (previously dropped, so rotated gradients rendered wrong).
              angle: row.angle ?? undefined,   // null = centred; see publishPalette
              fanAnchor: 'bottom',
              reversed: false,
              hardStops: false,
              repeatEnabled: false,
              createdAt: new Date(row.created_at).getTime()
            }
          })
          onResults({ mine, community: gradients })
        }
      } catch (err) {
        console.error("Search failed:", err)
        // Yours still stand even when the network does not.
        onResults({ mine, community: [] })
      } finally {
        setLoading(false)
      }
    }, 400) // 400ms debounce

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, onResults, saved, onActiveChange])

  return (
    <div data-testid="search-container" className={styles.searchContainer}>
      {/* The icon and the clear button are absolutely positioned against THIS
          wrapper, not the outer container — once Cancel joined the container,
          `right: 8px` put the clear cross on top of the Cancel label. */}
      <div className={styles.field}>
      <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search palettes..."
        data-testid="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && !loading && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={() => {
            setQuery('')
            onResults(null)
          }}
          aria-label="Clear search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      {loading && <span className={styles.loading}>Searching...</span>}
      </div>
      {onCancel && (
        <button
          type="button"
          data-testid="search-cancel"
          className={styles.cancelButton}
          onClick={() => {
            setQuery('')
            onResults(null)
            onActiveChange?.(false)
            onCancel()
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}
