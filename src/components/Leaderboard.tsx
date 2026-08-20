import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { tileBackground } from '../lib/tileBackground'
import { TurrellSquare } from './TurrellSquare'
import type { Gradient } from '../store/types'

const TOP_N = 100
/** How far back to look for a trend baseline — long enough that a palette
 * with only a couple recent votes still has something to compare against,
 * short enough that "trending" means something recent. */
const TREND_WINDOW_DAYS = 7

interface TrendRow {
  palette_id: string
  elo_rating: number
  created_at: string
}

/** Rank + trend indicator per palette, computed client-side from the oldest
 * palette_elo_history row within TREND_WINDOW_DAYS for that palette — the
 * delta between that and the palette's current elo_rating. Absent history
 * (palette hasn't moved recently, or never has) renders as flat. */
function useTrends(paletteIds: string[]) {
  const [trend, setTrend] = useState<Record<string, number>>({})

  useEffect(() => {
    if (paletteIds.length === 0) return
    let cancelled = false
    const since = new Date(Date.now() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('palette_elo_history')
      .select('palette_id,elo_rating,created_at')
      .in('palette_id', paletteIds)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) {
          if (error) console.error('Failed to load Elo trend history:', error)
          return
        }
        // First row per palette in ascending order = the oldest in-window
        // rating, i.e. the baseline to diff the current rating against.
        const baseline: Record<string, number> = {}
        for (const row of data as TrendRow[]) {
          if (!(row.palette_id in baseline)) baseline[row.palette_id] = row.elo_rating
        }
        setTrend(baseline)
      })
    return () => {
      cancelled = true
    }
  }, [paletteIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return trend
}

function TrendBadge({ current, baseline }: { current: number; baseline: number | undefined }) {
  if (baseline === undefined) return <span style={{ opacity: 0.4 }}>–</span>
  const delta = current - baseline
  if (delta === 0) return <span style={{ opacity: 0.4 }}>–</span>
  const up = delta > 0
  return (
    <span style={{ color: up ? '#7ac97a' : '#e07a7a' }}>
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  )
}

function Row({ rank, gradient, baselineElo }: { rank: number; gradient: Gradient; baselineElo: number | undefined }) {
  // tileBackground returns undefined for 'square' — that one is layered DOM
  // (nested squares), not a single CSS gradient, so it renders via
  // TurrellSquare instead (see tileBackground's own doc comment). Every
  // other shape is a plain background.
  const bg = tileBackground(gradient)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #222' }}>
      <span style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>{rank}</span>
      <div style={{ width: 64, height: 40, borderRadius: 6, background: bg ?? '#111', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {gradient.type === 'square' && (
          <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} angle={gradient.angle} crop={gradient.crop} />
        )}
      </div>
      <span style={{ flex: 1, fontSize: 13, opacity: 0.8 }}>{gradient.name ?? gradient.type}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{gradient.eloRating ?? 1200}</span>
      <span style={{ width: 60, textAlign: 'right', fontSize: 13 }}>
        <TrendBadge current={gradient.eloRating ?? 1200} baseline={baselineElo} />
      </span>
    </div>
  )
}

/** Top-100 community gradients by Elo rating, with rank + a 7-day trend
 * indicator per row. Mounted behind ?leaderboard=true (App.tsx), mirroring
 * ?vote=true's gating. Elo is only moved by 'community' votes cast at
 * ?vote=true — see supabase/migrations/0013_palette_elo.sql and
 * GradientVote.tsx's 'community' test type. */
export function Leaderboard() {
  const { gradients, loading } = useCommunityGradients('elo')
  const top = gradients.slice(0, TOP_N)
  const trend = useTrends(top.map((g) => g.id))

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111', color: '#fff', overflowY: 'auto', zIndex: 9999 }}>
      <div style={{ padding: '16px 12px', borderBottom: '1px solid #222' }}>
        <div style={{ fontSize: 18 }}>Gradient leaderboard</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Ranked by Elo from head-to-head votes at ?vote=true. Trend is the change over the last {TREND_WINDOW_DAYS} days.
        </div>
      </div>
      {loading && top.length === 0 ? (
        <div style={{ padding: 24, opacity: 0.6 }}>Loading…</div>
      ) : top.length === 0 ? (
        <div style={{ padding: 24, opacity: 0.6 }}>No rated palettes yet — cast some "Palette vs. palette" votes at ?vote=true.</div>
      ) : (
        top.map((g, i) => <Row key={g.id} rank={i + 1} gradient={g} baselineElo={trend[g.id]} />)
      )}
    </div>
  )
}
