import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Gradient } from '../store/types'
import type { GradientType } from '../lib/gradient'
import { COLOR_NOUNS, type HueFamily } from '../lib/namingWords'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  onResults: (results: Gradient[] | null) => void;
}

export function SearchBar({ onResults }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      onResults(null)
      return
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    
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
          onResults(gradients)
        }
      } catch (err) {
        console.error("Search failed:", err)
        onResults([])
      } finally {
        setLoading(false)
      }
    }, 400) // 400ms debounce

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, onResults])

  return (
    <div className={styles.searchContainer}>
      <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search palettes..."
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
  )
}
