import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Gradient } from '../store/types'
import type { GradientType } from '../lib/gradient'

export function useCommunityGradients() {
  const [gradients, setGradients] = useState<Gradient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCommunity() {
      try {
        const { data, error } = await supabase
          .from('palettes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) throw error

        if (data) {
                    const fetched: Gradient[] = data.map(row => {
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
              angle: row.angle ?? 0,
              fanAnchor: 'bottom',
              reversed: false,
              hardStops: false,
              repeatEnabled: false,
              createdAt: new Date(row.created_at).getTime()
            }
          })

          const deduplicated: Gradient[] = []
          const seenDNA = new Set<string>()
          for (const g of fetched) {
            const dna = `${g.type}-${g.stops.map(s => s.hex).join('-')}`
            if (!seenDNA.has(dna)) {
              seenDNA.add(dna)
              deduplicated.push(g)
            }
          }
          
          setGradients(deduplicated.slice(0, 50))
        }
      } catch (err) {
        console.error("Failed to fetch community gradients:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchCommunity()
  }, [])

  const deleteGradient = async (id: string) => {
    try {
      const { error } = await supabase.from('palettes').delete().eq('id', id)
      if (error) throw error
      setGradients(prev => prev.filter(g => g.id !== id))
    } catch (err) {
      console.error("Failed to delete gradient:", err)
      alert("Failed to delete gradient.")
    }
  }

  return { gradients, loading, deleteGradient }
}
