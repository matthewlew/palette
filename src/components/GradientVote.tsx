import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/auth'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { generateGradientStops } from '../lib/palette'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { buildGradientCss, SELECTABLE_GEOMETRY, type GradientStop, type GradientType } from '../lib/gradient'
import { hexToOklch } from '../lib/oklch'
import { scorePalette } from '../lib/paletteScore'
import {
  orderWithStandoutCentered,
  orderWithStandoutAtEdges,
  orderByHueWalk,
  spacingBufferNeutral,
  spacingDominantBand,
  mirrorStops,
} from '../lib/gradientComposition'
import type { Gradient } from '../store/types'

/** 'random' is the original mode: two independently chosen candidates,
 * sharing one shape so geometry isn't a confound. Every other value holds
 * ONE base candidate fixed and mutates exactly one property of it for the
 * second candidate, so a win/loss isolates that single variable instead of
 * "which of these two unrelated gradients is better". */
type TestType = 'random' | 'stops' | 'order' | 'shape' | 'spacing' | 'symmetry'

const TEST_TYPES: { id: TestType; label: string; hint: string }[] = [
  { id: 'random', label: 'Random pair', hint: 'two independent candidates, same shape' },
  { id: 'stops', label: 'Stop count', hint: 'same colors, one fewer stop' },
  { id: 'order', label: 'Color order', hint: 'same colors, reordered' },
  { id: 'shape', label: 'Shape', hint: 'same colors and stops, different geometry' },
  { id: 'spacing', label: 'Spacing', hint: 'same colors, different stop positions' },
  { id: 'symmetry', label: 'Symmetry', hint: 'same colors, mirrored arrangement' },
]

/** Sub-variants within 'order'/'spacing'/'symmetry' — each tests one
 * specific, articulable theory about composition rather than pure
 * randomness. See src/lib/gradientComposition.ts. Absent key = no
 * strategy picker for that test type (stops/shape/random). */
const STRATEGIES_BY_TYPE: Partial<Record<TestType, { id: string; label: string; hint: string }[]>> = {
  order: [
    { id: 'shuffle', label: 'Shuffle', hint: 'random reassignment (baseline)' },
    { id: 'light-center', label: 'Light center', hint: 'lightest color at the middle position' },
    { id: 'light-edges', label: 'Light edges', hint: 'lightest color at the first position' },
    { id: 'saturation-center', label: 'Saturation center', hint: 'most saturated color at the middle position' },
    { id: 'saturation-edges', label: 'Saturation edges', hint: 'most saturated color at the first position' },
    { id: 'hue-walk', label: 'Hue walk', hint: 'colors ordered to minimize hue jumps between neighbors' },
  ],
  spacing: [
    { id: 'random', label: 'Random', hint: 'random re-position (baseline)' },
    { id: 'buffer-neutral', label: 'Buffer neutral', hint: 'widen the gaps around the least-saturated stop' },
    { id: 'dominant-band', label: 'Dominant band', hint: 'widen the gaps around the lightest stop' },
  ],
  symmetry: [
    { id: 'mirror', label: 'Mirror', hint: 'palindrome arrangement from the first half, reflected' },
  ],
}

function randomStrategyFor(testType: TestType): string | null {
  const options = STRATEGIES_BY_TYPE[testType]
  if (!options || options.length === 0) return null
  return options[Math.floor(Math.random() * options.length)].id
}

function applyOrderStrategy(stops: GradientStop[], strategy: string): GradientStop[] {
  switch (strategy) {
    case 'light-center': return orderWithStandoutCentered(stops, 'lightness')
    case 'light-edges': return orderWithStandoutAtEdges(stops, 'lightness')
    case 'saturation-center': return orderWithStandoutCentered(stops, 'saturation')
    case 'saturation-edges': return orderWithStandoutAtEdges(stops, 'saturation')
    case 'hue-walk': return orderByHueWalk(stops)
    default: return reorderColors(stops)
  }
}

function applySpacingStrategy(stops: GradientStop[], strategy: string): GradientStop[] {
  switch (strategy) {
    case 'buffer-neutral': return spacingBufferNeutral(stops)
    case 'dominant-band': return spacingDominantBand(stops)
    default: return varySpacing(stops)
  }
}

interface Candidate {
  source: 'community' | 'generated'
  paletteId?: string
  colors: string[]
  offsets: number[]
  shape: GradientType
  stops: GradientStop[]
  /** Set only for a controlled (non-'random') test — which side of the pair
   * this is, so the recalibration script can compute "does the mutation
   * win?" rather than just "which of these two won". */
  variant?: 'base' | 'mutated'
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

function baseCandidate(pool: Gradient[], shape: GradientType): Candidate {
  return pool.length > 0
    ? { ...fromCommunity(pool[Math.floor(Math.random() * pool.length)]), shape }
    : generated(shape)
}

/** Removes one random INTERIOR stop (never the first or last), keeping the
 * gradient's overall color range fixed — tests whether a simpler gradient
 * with the same range reads better. No-op below 3 stops. */
export function dropRandomStop(stops: GradientStop[]): GradientStop[] {
  if (stops.length <= 2) return stops
  const idx = 1 + Math.floor(Math.random() * (stops.length - 2))
  return stops.filter((_, i) => i !== idx)
}

/** Same colors and positions, hex values shuffled across them. Retries until
 * the shuffle actually differs (a same-length array can otherwise reshuffle
 * to itself, especially at 2-3 stops). */
export function reorderColors(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 2) return stops
  const hexes = stops.map((s) => s.hex)
  let shuffled = hexes
  for (let attempt = 0; attempt < 10; attempt++) {
    const copy = [...hexes]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    if (copy.some((h, i) => h !== hexes[i])) {
      shuffled = copy
      break
    }
  }
  return stops.map((s, i) => ({ ...s, hex: shuffled[i] }))
}

/** Same colors, same color-to-order assignment, different stop positions.
 * Endpoints stay pinned at 0/100 (still spans the full gradient); interior
 * positions are re-rolled and re-sorted. No-op below 3 stops. */
export function varySpacing(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 3) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const interior = Array.from({ length: sorted.length - 2 }, () => Math.random() * 100).sort((a, b) => a - b)
  const positions = [0, ...interior, 100]
  return sorted.map((s, i) => ({ ...s, position: Math.round(positions[i]) }))
}

/** 'random': two independently chosen candidates sharing one shape — shape
 * is a confound if left free to vary, since e.g. `square` renders as flat
 * wedges and would win/lose on geometry rather than color choice.
 *
 * Any other test type: ONE base candidate, mutated along exactly the
 * property under test for the second candidate — everything else held
 * fixed, so a win/loss isolates that one variable. */
function pickPair(
  pool: Gradient[],
  forcedShape: GradientType | null,
  testType: TestType,
  /** Resolved strategy for 'order'/'spacing'/'symmetry' rounds — the
   * caller decides this (possibly by random pick) so it's known, not
   * re-randomized here, and can be logged on the vote. Ignored for every
   * other test type. */
  strategy: string | null,
): [Candidate, Candidate] {
  const shape = forcedShape ?? SELECTABLE_GEOMETRY[Math.floor(Math.random() * SELECTABLE_GEOMETRY.length)]

  if (testType === 'random') {
    const a = baseCandidate(pool, shape)
    const b = generated(shape)
    return Math.random() < 0.5 ? [a, b] : [b, a]
  }

  const base: Candidate = { ...baseCandidate(pool, shape), variant: 'base' }

  let mutatedStops = base.stops
  let mutatedShape = base.shape
  if (testType === 'stops') mutatedStops = dropRandomStop(base.stops)
  else if (testType === 'order') mutatedStops = applyOrderStrategy(base.stops, strategy ?? 'shuffle')
  else if (testType === 'spacing') mutatedStops = applySpacingStrategy(base.stops, strategy ?? 'random')
  else if (testType === 'symmetry') mutatedStops = mirrorStops(base.stops)
  else if (testType === 'shape') {
    const others = SELECTABLE_GEOMETRY.filter((s) => s !== base.shape)
    mutatedShape = others[Math.floor(Math.random() * others.length)]
  }

  const mutated: Candidate = {
    source: base.source,
    paletteId: base.paletteId,
    colors: mutatedStops.map((s) => s.hex),
    offsets: mutatedStops.map((s) => s.position),
    shape: mutatedShape,
    stops: mutatedStops,
    variant: 'mutated',
  }

  return Math.random() < 0.5 ? [base, mutated] : [mutated, base]
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
 * gradient against a freshly generated one (or, for a controlled test, a
 * base candidate against one mutated property of itself), logs the pick to
 * gradient_votes for later recalibration of paletteScore.ts's weights
 * (see scripts/recalibrate-gradient-score.mjs). */
export function GradientVote() {
  const { gradients } = useCommunityGradients('recent')
  const [pair, setPair] = useState<[Candidate, Candidate] | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [forcedShape, setForcedShape] = useState<GradientType | null>(null)
  const [testType, setTestType] = useState<TestType>('random')
  // Pinned strategy for 'order'/'spacing'/'symmetry' — null means "pick
  // randomly among that type's strategies each round", same null-means-
  // random convention as forcedShape.
  const [strategy, setStrategy] = useState<string | null>(null)
  // The strategy actually used for the CURRENT round — resolved once when
  // the pair is generated (random pick if strategy is unpinned) so it's
  // known for logging/tallying rather than re-randomized on every read.
  const [roundStrategy, setRoundStrategy] = useState<string | null>(null)
  // Purely a render toggle, applied identically to both candidates so it's
  // never a confound — the stored vote/stops are unaffected either way.
  // Off by default to match the tool's original behavior.
  const [smoothEnabled, setSmoothEnabled] = useState(false)
  // Per-shape, per-test-type, and per-strategy vote counts, for the
  // coverage graphs/labels. Seeded from this session's own past votes on
  // mount, then incremented locally as new votes land — avoids a re-fetch
  // after every single pick.
  const [shapeCounts, setShapeCounts] = useState<Record<string, number>>({})
  const [testTypeCounts, setTestTypeCounts] = useState<Record<TestType, number>>({
    random: 0, stops: 0, order: 0, shape: 0, spacing: 0, symmetry: 0,
  })
  const [strategyCounts, setStrategyCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    ensureSession().then(async () => {
      const { data: session } = await supabase.auth.getSession()
      const voterId = session.session?.user.id
      if (!voterId) return
      const { data } = await supabase.from('gradient_votes').select('winner,test_type,strategy').eq('voter_id', voterId)
      if (cancelled || !data) return
      const shapeC: Record<string, number> = {}
      const testC: Record<TestType, number> = { random: 0, stops: 0, order: 0, shape: 0, spacing: 0, symmetry: 0 }
      const strategyC: Record<string, number> = {}
      for (const row of data) {
        const shape = (row.winner as { shape?: string } | null)?.shape
        if (shape) shapeC[shape] = (shapeC[shape] ?? 0) + 1
        const type = (row.test_type as TestType | null) ?? 'random'
        testC[type] = (testC[type] ?? 0) + 1
        const strat = row.strategy as string | null
        if (strat) strategyC[strat] = (strategyC[strat] ?? 0) + 1
      }
      setShapeCounts(shapeC)
      setTestTypeCounts(testC)
      setStrategyCounts(strategyC)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const nextPair = useCallback(() => {
    const resolved = strategy ?? randomStrategyFor(testType)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, forcedShape, testType, resolved))
    setNote('')
  }, [gradients, forcedShape, testType, strategy])

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
        winner: { source: winner.source, paletteId: winner.paletteId, colors: winner.colors, offsets: winner.offsets, shape: winner.shape, variant: winner.variant },
        loser: { source: loser.source, paletteId: loser.paletteId, colors: loser.colors, offsets: loser.offsets, shape: loser.shape, variant: loser.variant },
        category: null,
        note: finalNote || null,
        test_type: testType === 'random' ? null : testType,
        strategy: roundStrategy,
      })
      if (error) console.error('Failed to save gradient vote:', error)
    } else {
      console.error('Failed to save gradient vote: no signed-in session (voterId missing)')
    }
    setShapeCounts((prev) => ({ ...prev, [winner.shape]: (prev[winner.shape] ?? 0) + 1 }))
    setTestTypeCounts((prev) => ({ ...prev, [testType]: (prev[testType] ?? 0) + 1 }))
    if (roundStrategy) {
      setStrategyCounts((prev) => ({ ...prev, [roundStrategy]: (prev[roundStrategy] ?? 0) + 1 }))
    }
    setCount((c) => c + 1)
    setSaving(false)
    nextPair()
  }

  const chooseShape = (shape: GradientType | null) => {
    setForcedShape(shape)
    const resolved = strategy ?? randomStrategyFor(testType)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, shape, testType, resolved))
    setNote('')
  }

  const chooseTestType = (type: TestType) => {
    setTestType(type)
    // Strategies are specific to a test type — a pinned 'light-center'
    // means nothing once you've switched to Spacing, so it resets here.
    setStrategy(null)
    const resolved = randomStrategyFor(type)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, forcedShape, type, resolved))
    setNote('')
  }

  const chooseStrategy = (s: string | null) => {
    setStrategy(s)
    const resolved = s ?? randomStrategyFor(testType)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, forcedShape, testType, resolved))
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
              background: buildGradientCss(c.shape, c.stops, false, { smooth: smoothEnabled }),
              position: 'relative',
            }}
          >
            <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 12, opacity: 0.7, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>
              [{i === 0 ? 'A' : 'B'}] {c.variant ?? c.source} · {c.shape}{roundStrategy && c.variant === 'mutated' ? ` · ${roundStrategy}` : ''} · score {scoreOf(c).toFixed(1)}
            </span>
          </button>
        ))}
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#000', borderBottom: '1px solid #222' }}>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{count} voted</span>
        <button
          onClick={() => setSmoothEnabled((s) => !s)}
          title="Render both candidates with Smooth blending — some pairs (e.g. Stop count) can look artificially banded without it"
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 12,
            border: '1px solid #666',
            background: smoothEnabled ? '#4a9eff' : 'transparent',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Smooth: {smoothEnabled ? 'On' : 'Off'}
        </button>
        {TEST_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => chooseTestType(t.id)}
            title={t.hint}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 12,
              border: '1px solid #666',
              background: testType === t.id ? '#4a9eff' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {t.label} · {testTypeCounts[t.id] ?? 0}
          </button>
        ))}
      </div>
      {/* Coverage graph — relative bar per test type, same idea as the shape
          graph below: shows at a glance whether Stop count/Order/Shape/
          Spacing are getting even coverage, since each needs its own
          sample size to back a specific claim (e.g. "linear: dark at ends"). */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: 4, alignItems: 'flex-end', height: 36, background: '#000', borderBottom: '1px solid #222' }}>
        {TEST_TYPES.map((t) => {
          const max = Math.max(1, ...TEST_TYPES.map((tt) => testTypeCounts[tt.id] ?? 0))
          const n = testTypeCounts[t.id] ?? 0
          return (
            <div key={t.id} title={`${t.label}: ${n}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: `${(n / max) * 100}%`, minHeight: n > 0 ? 3 : 0, background: t.id === testType ? '#4a9eff' : '#555', borderRadius: '2px 2px 0 0' }} />
            </div>
          )
        })}
      </div>
      {STRATEGIES_BY_TYPE[testType] && (
        <>
          <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#000', borderBottom: '1px solid #222' }}>
            <button
              onClick={() => chooseStrategy(null)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 12,
                border: '1px solid #7a5',
                background: strategy === null ? '#7ac97a' : 'transparent',
                color: strategy === null ? '#000' : '#fff',
                cursor: 'pointer',
              }}
            >
              Random strategy
            </button>
            {STRATEGIES_BY_TYPE[testType]!.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseStrategy(s.id)}
                title={s.hint}
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 12,
                  border: '1px solid #7a5',
                  background: strategy === s.id ? '#7ac97a' : 'transparent',
                  color: strategy === s.id ? '#000' : '#fff',
                  cursor: 'pointer',
                }}
              >
                {s.label} · {strategyCounts[s.id] ?? 0}
              </button>
            ))}
          </div>
          {/* Coverage graph — relative bar per strategy WITHIN the current
              test type, so a session can see e.g. "light-center: 3,
              light-edges: 11" at a glance and steer toward whichever
              theory still needs votes. */}
          <div style={{ padding: '6px 12px', display: 'flex', gap: 4, alignItems: 'flex-end', height: 36, background: '#000', borderBottom: '1px solid #222' }}>
            {STRATEGIES_BY_TYPE[testType]!.map((s) => {
              const options = STRATEGIES_BY_TYPE[testType]!
              const max = Math.max(1, ...options.map((o) => strategyCounts[o.id] ?? 0))
              const n = strategyCounts[s.id] ?? 0
              return (
                <div key={s.id} title={`${s.label}: ${n}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${(n / max) * 100}%`, minHeight: n > 0 ? 3 : 0, background: s.id === roundStrategy ? '#7ac97a' : '#555', borderRadius: '2px 2px 0 0' }} />
                </div>
              )
            })}
          </div>
        </>
      )}
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#000', borderBottom: '1px solid #222' }}>
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
          Random shape
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
