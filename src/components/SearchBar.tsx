import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Gradient } from '../store/types'
import type { GradientType } from '../lib/gradient'
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
          queryBuilder = queryBuilder.ilike('display_name', `%${word}%`)
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
              angle: row.angle ?? 0,
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
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search for a palette (e.g. Neon Wave)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <span className={styles.loading}>Searching...</span>}
    </div>
  )
}
