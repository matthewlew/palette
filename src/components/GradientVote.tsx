import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/auth'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { generateGradientStops } from '../lib/palette'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { buildGradientCss, SELECTABLE_GEOMETRY, type GradientStop, type GradientType } from '../lib/gradient'
import { hexToOklch } from '../lib/oklch'
import { scorePalette } from '../lib/paletteScore'
import { CATEGORIES } from '../lib/gradientCategories'
import type { Gradient } from '../store/types'

interface Candidate {
  source: 'community' | 'generated'
  paletteId?: string
  colors: string[]
  offsets: number[]
  shape: GradientType
  stops: GradientStop[]
}

function fromCommunity(g: Gradient): Candidate {
  return {
    source: 'community',
    paletteId: g.id,
    colors: g.stops.map((s) => s.hex),
    offsets: g.stops.map((s) => s.position),
    shape: g.type,
    stops: g.stops,
  }
}

function generated(shape: GradientType): Candidate {
  const stops = generateGradientStops(DEFAULT_COLOR_SET)
  return {
    source: 'generated',
    colors: stops.map((s) => s.hex),
    offsets: stops.map((s) => s.position),
    shape,
    stops,
  }
}

/** Both candidates share one shape per round — shape is a confound if left
 * free to vary, since e.g. `square` renders as flat wedges and would
 * win/lose on geometry rather than color choice. A community gradient's own
 * shape is overridden to match, for the same reason. Pass `forcedShape` to
 * pin the round to one shape instead of picking randomly. */
function pickPair(pool: Gradient[], forcedShape: GradientType | null): [Candidate, Candidate] {
  const shape = forcedShape ?? SELECTABLE_GEOMETRY[Math.floor(Math.random() * SELECTABLE_GEOMETRY.length)]
  const a = pool.length > 0 ? { ...fromCommunity(pool[Math.floor(Math.random() * pool.length)]), shape } : generated(shape)
  const b = generated(shape)
  return Math.random() < 0.5 ? [a, b] : [b, a]
}

function scoreOf(c: Candidate): number {
  return scorePalette(c.colors.map(hexToOklch))
}

/** Claude API key for the local-only annotation panel. Never set in the
 * shipped prod build — this component is only ever reachable via ?vote=true,
 * and the key is visible in the browser bundle to whoever loads that URL. */
const CLAUDE_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

async function annotateWithClaude(winner: Candidate, loser: Candidate, userNote: string): Promise<string> {
  if (!CLAUDE_KEY) return userNote
  const prompt = `A user picked one gradient over another in an aesthetic A/B test.
Winner colors (hex, in order): ${winner.colors.join(', ')}
Loser colors (hex, in order): ${loser.colors.join(', ')}
User's note on why (may be empty): ${userNote || '(none given)'}

In one short sentence, summarize what made the winner more appealing, in terms a future gradient-scoring heuristic could act on (e.g. lightness contrast, hue variety, saturation, near-duplicate hues). Output only the sentence.`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return userNote
    const data = await res.json()
    const text = data?.content?.[0]?.text as string | undefined
    return text?.trim() || userNote
  } catch {
    return userNote
  }
}

/** Admin-only gradient A/B voting tool, mounted behind ?vote=true (App.tsx),
 * mirroring Gallery.tsx's ?admin=true gating. Pairs a random community
 * gradient against a freshly generated one, logs the pick to
 * gradient_votes for later recalibration of paletteScore.ts's weights
 * (see scripts/recalibrate-gradient-score.mjs). */
export function GradientVote() {
  const { gradients } = useCommunityGradients('recent')
  const [pair, setPair] = useState<[Candidate, Candidate] | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [forcedShape, setForcedShape] = useState<GradientType | null>(null)
  // Per-shape vote counts, for the coverage graph. Seeded from this
  // session's own past votes on mount, then incremented locally as new
  // votes land — avoids a re-fetch after every single pick.
  const [shapeCounts, setShapeCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    ensureSession().then(async () => {
      const { data: session } = await supabase.auth.getSession()
      const voterId = session.session?.user.id
      if (!voterId) return
      const { data } = await supabase.from('gradient_votes').select('winner').eq('voter_id', voterId)
      if (cancelled || !data) return
      const counts: Record<string, number> = {}
      for (const row of data) {
        const shape = (row.winner as { shape?: string } | null)?.shape
        if (shape) counts[shape] = (counts[shape] ?? 0) + 1
      }
      setShapeCounts(counts)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const nextPair = useCallback(() => {
    setPair(pickPair(gradients, forcedShape))
    setCategory(null)
    setNote('')
  }, [gradients, forcedShape])

  useEffect(() => {
    if (!pair) nextPair()
  }, [pair, nextPair])

  const pick = async (winnerIdx: 0 | 1) => {
    if (!pair || saving) return
    setSaving(true)
    const winner = pair[winnerIdx]
    const loser = pair[winnerIdx === 0 ? 1 : 0]
    await ensureSession()
    const { data: session } = await supabase.auth.getSession()
    const voterId = session.session?.user.id
    const finalNote = CLAUDE_KEY ? await annotateWithClaude(winner, loser, note) : note
    if (voterId) {
      const { error } = await supabase.from('gradient_votes').insert({
        voter_id: voterId,
        winner: { source: winner.source, paletteId: winner.paletteId, colors: winner.colors, offsets: winner.offsets, shape: winner.shape },
        loser: { source: loser.source, paletteId: loser.paletteId, colors: loser.colors, offsets: loser.offsets, shape: loser.shape },
        category,
        note: finalNote || null,
      })
      if (error) console.error('Failed to save gradient vote:', error)
    } else {
      console.error('Failed to save gradient vote: no signed-in session (voterId missing)')
    }
    setShapeCounts((prev) => ({ ...prev, [winner.shape]: (prev[winner.shape] ?? 0) + 1 }))
    setCount((c) => c + 1)
    setSaving(false)
    nextPair()
  }

  const chooseShape = (shape: GradientType | null) => {
    setForcedShape(shape)
    setPair(pickPair(gradients, shape))
    setCategory(null)
    setNote('')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'a' || e.key === 'A') pick(0)
      else if (e.key === 'b' || e.key === 'B') pick(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, saving])

  if (!pair) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', zIndex: 9999 }}>
      <div style={{ display: 'flex', flex: 1 }}>
        {pair.map((c, i) => (
          <button
            key={i}
            onClick={() => pick(i as 0 | 1)}
            disabled={saving}
            style={{
              flex: 1,
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              background: buildGradientCss(c.shape, c.stops),
              position: 'relative',
            }}
          >
            <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 12, opacity: 0.7, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>
              [{i === 0 ? 'A' : 'B'}] {c.source} · {c.shape} · score {scoreOf(c).toFixed(1)}
            </span>
          </button>
        ))}
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#000', borderBottom: '1px solid #222' }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{count} voted</span>
        <button
          onClick={() => chooseShape(null)}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 12,
            border: '1px solid #444',
            background: forcedShape === null ? '#fff' : 'transparent',
            color: forcedShape === null ? '#000' : '#fff',
            cursor: 'pointer',
          }}
        >
          Random
        </button>
        {SELECTABLE_GEOMETRY.map((shape) => (
          <button
            key={shape}
            onClick={() => chooseShape(shape)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 12,
              border: '1px solid #444',
              background: forcedShape === shape ? '#fff' : 'transparent',
              color: forcedShape === shape ? '#000' : '#fff',
              cursor: 'pointer',
            }}
          >
            {shape} · {shapeCounts[shape] ?? 0}
          </button>
        ))}
      </div>
      {/* Coverage graph — relative bar per shape so an uneven split is visible at a glance. */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: 4, alignItems: 'flex-end', height: 36, background: '#000', borderBottom: '1px solid #222' }}>
        {SELECTABLE_GEOMETRY.map((shape) => {
          const max = Math.max(1, ...SELECTABLE_GEOMETRY.map((s) => shapeCounts[s] ?? 0))
          const n = shapeCounts[shape] ?? 0
          return (
            <div key={shape} title={`${shape}: ${n}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${(n / max) * 100}%`, minHeight: n > 0 ? 3 : 0, background: shape === forcedShape ? '#fff' : '#555', borderRadius: '2px 2px 0 0' }} />
            </div>
          )
        })}
      </div>
      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#000' }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>optional tag:</span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(category === cat.id ? null : cat.id)}
            title={cat.hint}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 12,
              border: '1px solid #444',
              background: category === cat.id ? '#fff' : 'transparent',
              color: category === cat.id ? '#000' : '#fff',
              cursor: 'pointer',
            }}
          >
            {cat.label}
          </button>
        ))}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={CLAUDE_KEY ? 'Note (optional, Claude will refine on pick)…' : 'Note (optional)…'}
          style={{ flex: 1, minWidth: 160, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
        />
      </div>
    </div>
  )
}
