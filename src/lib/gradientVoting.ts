import { supabase } from './supabase'
import { ensureSession } from './auth'
import { generateGradientStops } from './palette'
import { DEFAULT_COLOR_SET } from './colorSets'
import { SELECTABLE_GEOMETRY, type GradientStop, type GradientType } from './gradient'
import {
  orderByHueWalk,
  spacingBufferNeutral,
  spacingDominantBand,
  mirrorStops,
} from './gradientComposition'
import type { Gradient } from '../store/types'

/**
 * Shared pairing/sampling/submit logic for gradient A/B voting, used by
 * both the admin research tool (src/components/GradientVote.tsx, full
 * controls) and the public voting UI (src/components/VoteOverlay.tsx,
 * hidden controls — every round auto-rotates). Keeping this in one module
 * means both write the exact same vote-row shape, so gradient_votes stays
 * one consistent dataset for scripts/recalibrate-gradient-score.mjs and
 * the Elo trigger (supabase/migrations/0013_palette_elo.sql) regardless of
 * which UI cast the vote.
 */

/** 'random' is the original mode: two independently chosen candidates,
 * sharing one shape so geometry isn't a confound. 'community' pits two
 * DIFFERENT saved community palettes against each other, same shape — the
 * only test type that produces a genuine head-to-head between two real,
 * independently-rankable gradients (needed to feed the Elo leaderboard;
 * see supabase/migrations/0013_palette_elo.sql). Every other value holds
 * ONE base candidate fixed and mutates exactly one property of it for the
 * second candidate, so a win/loss isolates that single variable instead of
 * "which of these two unrelated gradients is better". */
export type TestType = 'random' | 'community' | 'stops' | 'order' | 'shape' | 'spacing' | 'symmetry'

export const TEST_TYPES: { id: TestType; label: string; hint: string }[] = [
  { id: 'random', label: 'Random pair', hint: 'two independent candidates, same shape' },
  { id: 'community', label: 'Palette vs. palette', hint: 'two saved community gradients, same shape' },
  { id: 'stops', label: 'Stop count', hint: 'same colors, one fewer stop' },
  { id: 'order', label: 'Color order', hint: 'same colors, reordered' },
  { id: 'shape', label: 'Shape', hint: 'same colors and stops, different geometry' },
  { id: 'spacing', label: 'Spacing', hint: 'same colors, different stop positions' },
  { id: 'symmetry', label: 'Symmetry', hint: 'same colors, mirrored arrangement' },
]

export const EMPTY_COUNTS: Record<string, number> = {}

/** Rounds per voting session before the "session complete" panel appears —
 * a rough 5-minute-ask budget (a couple seconds per round). "Keep going"
 * raises the running target by another SESSION_TARGET rather than
 * removing the cap entirely. */
export const SESSION_TARGET = 20

/** Picks one item weighted toward scarcity: an item voted on `n` times has
 * relative weight `1 / (n + 1)`, so cells with fewer votes are more likely
 * to come up — without ever fully excluding a well-covered cell. Used to
 * fill session-budgeted rounds evenly across shape/strategy instead of
 * uniform randomness, which tends to over-sample whatever's already ahead. */
export function weightedPick<T extends string>(items: readonly T[], counts: Record<string, number>): T {
  const weights = items.map((item) => 1 / ((counts[item] ?? 0) + 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

/** Sub-variants within 'order'/'spacing'/'symmetry' — each tests one
 * specific, articulable theory about composition rather than pure
 * randomness. See src/lib/gradientComposition.ts. Absent key = no
 * strategy picker for that test type (stops/shape/random).
 *
 * Deliberately shape-agnostic only: light-center/light-edges/saturation-
 * center/saturation-edges were dropped after review — "edges" isn't a
 * coherent concept for `angular` (wraps in a circle, no true edge) or
 * `square` (solid wedges, no continuous blend to place a standout
 * within), so voting on them under those shapes was noise, not signal.
 * hue-walk/buffer-neutral/dominant-band/mirror all apply to every shape
 * the same way. */
export const STRATEGIES_BY_TYPE: Partial<Record<TestType, { id: string; label: string; hint: string }[]>> = {
  order: [
    { id: 'shuffle', label: 'Shuffle', hint: 'random reassignment (baseline)' },
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

export function randomStrategyFor(testType: TestType, strategyCounts: Record<string, number> = EMPTY_COUNTS): string | null {
  const options = STRATEGIES_BY_TYPE[testType]
  if (!options || options.length === 0) return null
  return weightedPick(options.map((o) => o.id), strategyCounts)
}

function applyOrderStrategy(stops: GradientStop[], strategy: string): GradientStop[] {
  switch (strategy) {
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

export interface Candidate {
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

export function fromCommunity(g: Gradient): Candidate {
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
export function pickPair(
  pool: Gradient[],
  forcedShape: GradientType | null,
  testType: TestType,
  /** Resolved strategy for 'order'/'spacing'/'symmetry' rounds — the
   * caller decides this (possibly by random pick) so it's known, not
   * re-randomized here, and can be logged on the vote. Ignored for every
   * other test type. */
  strategy: string | null,
  /** Per-shape vote counts, used to weight an unforced shape pick toward
   * scarcity (see weightedPick) instead of uniform randomness. Omit for
   * plain uniform behavior (e.g. in tests). */
  shapeCounts: Record<string, number> = EMPTY_COUNTS,
): [Candidate, Candidate] {
  const shape = forcedShape ?? weightedPick(SELECTABLE_GEOMETRY, shapeCounts)

  if (testType === 'random') {
    const a = baseCandidate(pool, shape)
    const b = generated(shape)
    return Math.random() < 0.5 ? [a, b] : [b, a]
  }

  if (testType === 'community') {
    const sameShape = pool.filter((g) => g.type === shape)
    if (sameShape.length >= 2) {
      const i = Math.floor(Math.random() * sameShape.length)
      let j = Math.floor(Math.random() * (sameShape.length - 1))
      if (j >= i) j += 1
      const a = { ...fromCommunity(sameShape[i]), shape }
      const b = { ...fromCommunity(sameShape[j]), shape }
      return Math.random() < 0.5 ? [a, b] : [b, a]
    }
    // Not enough saved palettes of this shape yet to form a real pair —
    // fall back to 'random' behavior rather than crashing or looping.
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

export function emptyTestTypeCounts(): Record<TestType, number> {
  return { random: 0, community: 0, stops: 0, order: 0, shape: 0, spacing: 0, symmetry: 0 }
}

export interface VoteCounts {
  shapeCounts: Record<string, number>
  testTypeCounts: Record<TestType, number>
  strategyCounts: Record<string, number>
}

/** Seeds the scarcity-weighting counts from a voter's OWN past votes — the
 * same query both GradientVote.tsx's and VoteOverlay.tsx's mount effects
 * run, factored out so they can never drift apart. Returns null on no
 * session/no data (caller keeps its zeroed defaults). */
export async function fetchVoteCounts(voterId: string): Promise<VoteCounts | null> {
  const { data } = await supabase.from('gradient_votes').select('winner,test_type,strategy').eq('voter_id', voterId)
  if (!data) return null
  const shapeCounts: Record<string, number> = {}
  const testTypeCounts = emptyTestTypeCounts()
  const strategyCounts: Record<string, number> = {}
  for (const row of data) {
    const shape = (row.winner as { shape?: string } | null)?.shape
    if (shape) shapeCounts[shape] = (shapeCounts[shape] ?? 0) + 1
    const type = (row.test_type as TestType | null) ?? 'random'
    testTypeCounts[type] = (testTypeCounts[type] ?? 0) + 1
    const strat = row.strategy as string | null
    if (strat) strategyCounts[strat] = (strategyCounts[strat] ?? 0) + 1
  }
  return { shapeCounts, testTypeCounts, strategyCounts }
}

/** Writes one vote row to gradient_votes — the single source of truth for
 * what a vote looks like, shared by the admin tool and the public overlay
 * so both feed scripts/recalibrate-gradient-score.mjs and the Elo trigger
 * identically. Returns false (and logs) on any failure — callers already
 * handle a false return by not crediting the local tally. */
export async function submitVote(
  pair: [Candidate, Candidate],
  winnerIdx: 0 | 1,
  testType: TestType,
  strategy: string | null,
  note: string | null = null,
): Promise<boolean> {
  const winner = pair[winnerIdx]
  const loser = pair[winnerIdx === 0 ? 1 : 0]
  await ensureSession()
  const { data: session } = await supabase.auth.getSession()
  const voterId = session.session?.user.id
  if (!voterId) {
    console.error('Failed to save gradient vote: no signed-in session (voterId missing)')
    return false
  }
  const { error } = await supabase.from('gradient_votes').insert({
    voter_id: voterId,
    winner: { source: winner.source, paletteId: winner.paletteId, colors: winner.colors, offsets: winner.offsets, shape: winner.shape, variant: winner.variant },
    loser: { source: loser.source, paletteId: loser.paletteId, colors: loser.colors, offsets: loser.offsets, shape: loser.shape, variant: loser.variant },
    category: null,
    note: note || null,
    test_type: testType === 'random' ? null : testType,
    strategy,
  })
  if (error) {
    console.error('Failed to save gradient vote:', error)
    return false
  }
  return true
}
