import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/auth'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { SELECTABLE_GEOMETRY, type GradientType } from '../lib/gradient'
import { hexToOklch } from '../lib/oklch'
import { scorePalette } from '../lib/paletteScore'
import { GradientPreview } from './GradientPreview'
import {
  type Candidate,
  type TestType,
  TEST_TYPES,
  STRATEGIES_BY_TYPE,
  SESSION_TARGET,
  weightedPick,
  randomStrategyFor,
  pickPair,
  emptyTestTypeCounts,
  fetchVoteCounts,
  submitVote,
} from '../lib/gradientVoting'

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
 * (see scripts/recalibrate-gradient-score.mjs). Pairing/sampling logic
 * lives in src/lib/gradientVoting.ts, shared with the public-facing
 * VoteOverlay.tsx so both write the same vote-row shape. */
export function GradientVote() {
  const { gradients } = useCommunityGradients('recent')
  const [pair, setPair] = useState<[Candidate, Candidate] | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [forcedShape, setForcedShape] = useState<GradientType | null>(null)
  // Pinned test type — null means "auto-rotate, weighted toward whichever
  // type has fewest votes" (same null-means-random convention as
  // forcedShape/strategy). This used to be a plain sticky `testType` that
  // defaulted to 'random' and only changed on a manual click — in practice
  // that meant a whole session's worth of votes could go by without ever
  // touching 'community', starving the Elo leaderboard of the only vote
  // type that feeds it. Defaulting to auto-rotate fixes that.
  const [pinnedTestType, setPinnedTestType] = useState<TestType | null>(null)
  // The test type actually used for the CURRENT round — resolved once per
  // round (weighted pick if unpinned), same pattern as roundStrategy below.
  const [roundTestType, setRoundTestType] = useState<TestType>('random')
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
  const [testTypeCounts, setTestTypeCounts] = useState<Record<TestType, number>>(emptyTestTypeCounts())
  const [strategyCounts, setStrategyCounts] = useState<Record<string, number>>({})
  // Session budgeting: `count` (below) already tracks rounds voted on since
  // mount, so it doubles as the session round counter — once it reaches
  // sessionTarget, the pair view gives way to a "session complete" panel
  // instead of an endless stream, so "vote for 5 minutes" has a natural
  // end. "Keep going" just raises the target by another SESSION_TARGET.
  const [sessionTarget, setSessionTarget] = useState(SESSION_TARGET)

  useEffect(() => {
    let cancelled = false
    ensureSession().then(async () => {
      const { data: session } = await supabase.auth.getSession()
      const voterId = session.session?.user.id
      if (!voterId) return
      const counts = await fetchVoteCounts(voterId)
      if (cancelled || !counts) return
      setShapeCounts(counts.shapeCounts)
      setTestTypeCounts(counts.testTypeCounts)
      setStrategyCounts(counts.strategyCounts)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const nextPair = useCallback(() => {
    const resolvedType = pinnedTestType ?? weightedPick(TEST_TYPES.map((t) => t.id), testTypeCounts)
    setRoundTestType(resolvedType)
    const resolvedStrategy = strategy ?? randomStrategyFor(resolvedType, strategyCounts)
    setRoundStrategy(resolvedStrategy)
    setPair(pickPair(gradients, forcedShape, resolvedType, resolvedStrategy, shapeCounts))
    setNote('')
  }, [gradients, forcedShape, pinnedTestType, strategy, shapeCounts, strategyCounts, testTypeCounts])

  useEffect(() => {
    if (!pair) nextPair()
  }, [pair, nextPair])

  const pick = async (winnerIdx: 0 | 1) => {
    if (!pair || saving) return
    setSaving(true)
    const winner = pair[winnerIdx]
    const loser = pair[winnerIdx === 0 ? 1 : 0]
    const finalNote = CLAUDE_KEY ? await annotateWithClaude(winner, loser, note) : note
    await submitVote(pair, winnerIdx, roundTestType, roundStrategy, finalNote)
    setShapeCounts((prev) => ({ ...prev, [winner.shape]: (prev[winner.shape] ?? 0) + 1 }))
    setTestTypeCounts((prev) => ({ ...prev, [roundTestType]: (prev[roundTestType] ?? 0) + 1 }))
    if (roundStrategy) {
      setStrategyCounts((prev) => ({ ...prev, [roundStrategy]: (prev[roundStrategy] ?? 0) + 1 }))
    }
    const newCount = count + 1
    setCount(newCount)
    setSaving(false)
    if (newCount < sessionTarget) nextPair()
  }

  const chooseShape = (shape: GradientType | null) => {
    setForcedShape(shape)
    const resolved = strategy ?? randomStrategyFor(roundTestType, strategyCounts)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, shape, roundTestType, resolved, shapeCounts))
    setNote('')
  }

  // type === null pins nothing, i.e. "Auto rotate" — resolved fresh below,
  // same null-means-random convention as chooseShape(null)/chooseStrategy(null).
  const chooseTestType = (type: TestType | null) => {
    setPinnedTestType(type)
    const resolvedType = type ?? weightedPick(TEST_TYPES.map((t) => t.id), testTypeCounts)
    setRoundTestType(resolvedType)
    // Strategies are specific to a test type — a pinned 'hue-walk' means
    // nothing once you've switched to Spacing, so it resets here.
    setStrategy(null)
    const resolved = randomStrategyFor(resolvedType, strategyCounts)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, forcedShape, resolvedType, resolved, shapeCounts))
    setNote('')
  }

  const chooseStrategy = (s: string | null) => {
    setStrategy(s)
    const resolved = s ?? randomStrategyFor(roundTestType, strategyCounts)
    setRoundStrategy(resolved)
    setPair(pickPair(gradients, forcedShape, roundTestType, resolved, shapeCounts))
    setNote('')
  }

  const keepGoing = () => setSessionTarget((t) => t + SESSION_TARGET)

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

  if (count >= sessionTarget) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#111', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 9999 }}>
        <div style={{ fontSize: 20 }}>Session complete — {count} voted</div>
        <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 480, textAlign: 'center' }}>
          {TEST_TYPES.map((t) => `${t.label}: ${testTypeCounts[t.id] ?? 0}`).join(' · ')}
        </div>
        <button
          onClick={keepGoing}
          style={{ fontSize: 14, padding: '8px 16px', borderRadius: 8, border: '1px solid #4a9eff', background: '#4a9eff', color: '#fff', cursor: 'pointer' }}
        >
          Keep going (+{SESSION_TARGET})
        </button>
      </div>
    )
  }

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
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <GradientPreview shape={c.shape} stops={c.stops} smooth={smoothEnabled} />
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
        <button
          onClick={() => chooseTestType(null)}
          title="Rotate test types automatically, weighted toward whichever has fewest votes so far"
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 12,
            border: '1px solid #7a5',
            background: pinnedTestType === null ? '#7ac97a' : 'transparent',
            color: pinnedTestType === null ? '#000' : '#fff',
            cursor: 'pointer',
          }}
        >
          Auto rotate
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
              background: pinnedTestType === t.id ? '#4a9eff' : roundTestType === t.id ? '#2a5580' : 'transparent',
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
              <div style={{ width: '100%', height: `${(n / max) * 100}%`, minHeight: n > 0 ? 3 : 0, background: t.id === roundTestType ? '#4a9eff' : '#555', borderRadius: '2px 2px 0 0' }} />
            </div>
          )
        })}
      </div>
      {STRATEGIES_BY_TYPE[roundTestType] && (
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
            {STRATEGIES_BY_TYPE[roundTestType]!.map((s) => (
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
              test type, so a session can see e.g. "buffer-neutral: 3,
              dominant-band: 11" at a glance and steer toward whichever
              theory still needs votes. */}
          <div style={{ padding: '6px 12px', display: 'flex', gap: 4, alignItems: 'flex-end', height: 36, background: '#000', borderBottom: '1px solid #222' }}>
            {STRATEGIES_BY_TYPE[roundTestType]!.map((s) => {
              const options = STRATEGIES_BY_TYPE[roundTestType]!
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
