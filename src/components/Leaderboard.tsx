import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { tileBackground } from '../lib/tileBackground'
import { TurrellSquare } from './TurrellSquare'
import { Icon } from '../icons'
import { MEDIA_ICON } from '../lib/mediaChrome'
import type { Gradient } from '../store/types'
import styles from './Leaderboard.module.css'

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
  if (baseline === undefined || current - baseline === 0) return <span className={styles.trendFlat}>–</span>
  const delta = current - baseline
  const up = delta > 0
  return (
    <span className={up ? styles.trendUp : styles.trendDown}>
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
    <div className={styles.row}>
      <span className={styles.rank}>{rank}</span>
      <div className={styles.swatch} style={{ background: bg ?? 'var(--border)' }}>
        {gradient.type === 'square' && (
          <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} angle={gradient.angle} crop={gradient.crop} />
        )}
      </div>
      <span className={styles.name}>{gradient.name ?? gradient.type}</span>
      <span className={styles.elo}>{gradient.eloRating ?? 1200}</span>
      <span className={styles.trend}>
        <TrendBadge current={gradient.eloRating ?? 1200} baseline={baselineElo} />
      </span>
    </div>
  )
}

/** Top-100 community gradients by Elo rating, with rank + a 7-day trend
 * indicator per row. Mounted behind ?leaderboard=true (App.tsx), mirroring
 * ?vote=true's gating. Elo is only moved by 'community' votes cast at
 * ?vote=true — see supabase/migrations/0013_palette_elo.sql and
 * GradientVote.tsx's 'community' test type.
 *
 * Styled with the app's own design tokens (--th-display, --radius-sm,
 * --border, the MEDIA_ICON button chrome) rather than the hand-rolled
 * dark-page inline styles it originally shipped with — this is a view
 * onto the same gradients the rest of the app treats with care, not a
 * separate debug tool, so it should look like it belongs. */
export function Leaderboard() {
  const { gradients, loading } = useCommunityGradients('elo')
  const top = gradients.slice(0, TOP_N)
  const trend = useTrends(top.map((g) => g.id))

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={`${styles.closeButton} ${MEDIA_ICON}`}
        aria-label="Close"
        onClick={() => { window.location.href = window.location.pathname }}
      >
        <Icon name="close" size="md" />
      </button>
      <div className={styles.header}>
        <div className={styles.title}>Gradient leaderboard</div>
        <div className={styles.subtitle}>
          Ranked by Elo from head-to-head votes. Trend is the change over the last {TREND_WINDOW_DAYS} days.
        </div>
      </div>
      {loading && top.length === 0 ? (
        <div className={styles.state}>Loading…</div>
      ) : top.length === 0 ? (
        <div className={styles.state}>No rated palettes yet — vote from the Community tab's Ranked sort to get started.</div>
      ) : (
        top.map((g, i) => <Row key={g.id} rank={i + 1} gradient={g} baselineElo={trend[g.id]} />)
      )}
    </div>
  )
}
