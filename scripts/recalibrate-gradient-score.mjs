#!/usr/bin/env node
// Reports how well src/lib/paletteScore.ts's current DEFAULT_SCORE_WEIGHTS
// agree with recorded gradient_votes (from the ?vote=true admin tool), and
// searches for weights that agree more. Prints a suggestion only — you
// review it and paste it into paletteScore.ts by hand, the same way the
// original weights were a reviewed decision, not an automated rewrite.
//
// Run:  node scripts/recalibrate-gradient-score.mjs   (uses VITE_SUPABASE_* env, or .env.local)

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function config() {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    try {
      const env = await readFile(join(root, '.env.local'), 'utf8')
      for (const line of env.split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (m?.[1] === 'VITE_SUPABASE_URL') url ||= m[2].trim()
        if (m?.[1] === 'VITE_SUPABASE_ANON_KEY') key ||= m[2].trim()
      }
    } catch { /* no .env.local */ }
  }
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  return { url, key }
}

// --- OKLCH + factor math, mirrored from src/lib/oklch.ts and
// src/lib/paletteScore.ts so this script has no build step / no import of
// TS source. Keep in sync by hand if those files change shape.

function hexToSrgb(hex) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  return { r, g, b }
}

function srgbToOklch({ r, g, b }) {
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)]
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const l3 = Math.cbrt(l_), m3 = Math.cbrt(m_), s3 = Math.cbrt(s_)
  const l = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3
  const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3
  const c = Math.sqrt(a * a + bb * bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l, c, h }
}

const hexToOklch = (hex) => srgbToOklch(hexToSrgb(hex))
const clamp01 = (v) => Math.min(1, Math.max(0, v))

function saturationSpread(colors) {
  const chromas = colors.map((c) => c.c)
  const mean = chromas.reduce((a, b) => a + b, 0) / chromas.length
  const variance = chromas.reduce((a, c) => a + (c - mean) ** 2, 0) / chromas.length
  return clamp01((variance < 1e-12 ? 0 : Math.sqrt(variance)) / 0.22)
}

function lightnessRange(colors) {
  const lums = colors.map((c) => c.l)
  return clamp01((Math.max(...lums) - Math.min(...lums)) / 0.8)
}

function circularHueDistance(a, b) {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

function oklchDistance(a, b) {
  return (
    (circularHueDistance(a.h, b.h) / 180) * 0.35 +
    Math.abs(a.l - b.l) * 0.45 +
    (Math.abs(a.c - b.c) / 0.4) * 0.2
  )
}

function minPairwiseDistance(colors) {
  if (colors.length < 2) return 1
  let min = Infinity
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = oklchDistance(colors[i], colors[j])
      if (d < min) min = d
    }
  }
  return clamp01(min / 0.1)
}

function circularSpan(hues) {
  if (hues.length <= 1) return 0
  const sorted = [...hues].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length] + (i + 1 === sorted.length ? 360 : 0)
    maxGap = Math.max(maxGap, next - sorted[i])
  }
  return 360 - maxGap
}

function hueHarmony(hues) {
  if (hues.length < 2) return 0
  let best = 0
  const span = circularSpan(hues)
  best = Math.max(best, span < 60 ? 1 - (span / 60) * 0.2 : Math.max(0, 1 - (span - 60) / 150))
  for (const h of hues) {
    const comp = (h + 180) % 360
    const devs = hues.map((hh) => Math.min(circularHueDistance(hh, h), circularHueDistance(hh, comp)) / 90)
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length)
  }
  for (const h of hues) {
    const h2 = (h + 120) % 360
    const h3 = (h + 240) % 360
    const devs = hues.map((hh) => Math.min(circularHueDistance(hh, h), circularHueDistance(hh, h2), circularHueDistance(hh, h3)) / 60)
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length)
  }
  return clamp01(best)
}

function achromaticPenalty(colors) {
  const n = colors.filter((c) => c.c < 0.02).length
  if (n <= 1) return 1
  return Math.max(0.3, 1 - (n - 1) * 0.35)
}

const FACTOR_KEYS = ['lightnessRange', 'minPairwiseDistance', 'achromaticPenalty', 'saturationSpread', 'hueHarmony']

function factors(colors) {
  return {
    saturationSpread: saturationSpread(colors),
    lightnessRange: lightnessRange(colors),
    minPairwiseDistance: minPairwiseDistance(colors),
    hueHarmony: hueHarmony(colors.map((c) => c.h)),
    achromaticPenalty: achromaticPenalty(colors),
  }
}

function scoreFromFactors(f, weights) {
  return FACTOR_KEYS.reduce((sum, k) => sum + f[k] * weights[k], 0) * 100
}

const DEFAULT_SCORE_WEIGHTS = {
  lightnessRange: 0.35,
  minPairwiseDistance: 0.3,
  achromaticPenalty: 0.15,
  saturationSpread: 0.12,
  hueHarmony: 0.08,
}

function normalize(weights) {
  const total = FACTOR_KEYS.reduce((s, k) => s + weights[k], 0)
  const out = {}
  for (const k of FACTOR_KEYS) out[k] = weights[k] / total
  return out
}

function agreement(votes, weights) {
  let agree = 0
  for (const v of votes) {
    if (scoreFromFactors(v.winnerFactors, weights) > scoreFromFactors(v.loserFactors, weights)) agree++
  }
  return votes.length ? agree / votes.length : 0
}

// Random search over the 5-weight simplex — simple, no ML dependency,
// matches the "search a handful of numbers against a boolean preference
// signal" scale of this problem.
function search(votes, iterations = 20000) {
  let best = DEFAULT_SCORE_WEIGHTS
  let bestScore = agreement(votes, best)
  for (let i = 0; i < iterations; i++) {
    const candidate = normalize(Object.fromEntries(FACTOR_KEYS.map((k) => [k, Math.random()])))
    const score = agreement(votes, candidate)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return { weights: best, agreement: bestScore }
}

const { url, key } = await config()
const res = await fetch(`${url}/rest/v1/gradient_votes?select=winner,loser,category,test_type`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})
if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
const rows = await res.json()

if (rows.length === 0) {
  console.log('No votes recorded yet — cast some at ?vote=true first.')
  process.exit(0)
}

const votes = rows
  .filter((r) => Array.isArray(r.winner?.colors) && Array.isArray(r.loser?.colors) && r.winner.colors.length >= 2 && r.loser.colors.length >= 2)
  .map((r) => ({
    winnerFactors: factors(r.winner.colors.map(hexToOklch)),
    loserFactors: factors(r.loser.colors.map(hexToOklch)),
    category: r.category,
    // Bucketed by the winner's shape — a proxy for "does this shape's
    // aesthetic differ", since pairs can mix shapes (e.g. radial vs linear).
    shape: r.winner?.shape ?? 'unknown',
    testType: r.test_type,
    winnerVariant: r.winner?.variant,
    loserVariant: r.loser?.variant,
  }))

console.log(`${votes.length} usable vote(s) of ${rows.length} total.`)

function report(label, subset) {
  if (subset.length < 5) {
    console.log(`\n${label}: only ${subset.length} vote(s) — too few to report.`)
    return
  }
  const baseline = agreement(subset, DEFAULT_SCORE_WEIGHTS)
  console.log(`\n${label} (${subset.length} votes): current weights agree with ${(baseline * 100).toFixed(1)}%.`)
  if (subset.length < 20) {
    console.log('  Fewer than 20 votes — search below is exploratory only, cast more before trusting it.')
  }
  const { weights, agreement: agreed } = search(subset)
  console.log(`  Best found weights agree with ${(agreed * 100).toFixed(1)}%:`)
  console.log('  ' + JSON.stringify(weights))
}

report('Overall', votes)

// Per-shape breakdown — checks whether e.g. radial wants different weights
// than linear/angular before committing to per-shape scoring in paletteScore.ts.
const shapes = [...new Set(votes.map((v) => v.shape))]
for (const shape of shapes) {
  report(`Shape: ${shape}`, votes.filter((v) => v.shape === shape))
}

console.log('\nPaste the overall (or a shape-specific) weight set into src/lib/paletteScore.ts if it looks like a real improvement, not noise.')
console.log('If per-shape weights consistently diverge from overall, that\'s the signal to add shape-specific ScoreWeights presets rather than a single default.')

// Controlled-variant tests (?vote=true's Stop count / Color order / Shape /
// Spacing modes): a direct "does mutating this ONE property help" readout,
// independent of and complementary to the weight search above — a variable
// can show a strong win rate here even if it's a poor fit for paletteScore's
// existing 5 factors (e.g. stop count and color order aren't factors at all
// today).
const controlled = votes.filter((v) => v.testType && (v.winnerVariant === 'mutated' || v.winnerVariant === 'base'))
if (controlled.length > 0) {
  console.log('\n--- Controlled-variant win rates ---')
  const types = [...new Set(controlled.map((v) => v.testType))]
  for (const type of types) {
    const subset = controlled.filter((v) => v.testType === type)
    const mutatedWins = subset.filter((v) => v.winnerVariant === 'mutated').length
    const rate = mutatedWins / subset.length
    const verdict = subset.length < 10 ? '(too few votes to trust)' : rate > 0.5 ? '— the mutation tends to WIN' : '— the base tends to WIN'
    console.log(`${type} (${subset.length} votes): mutated wins ${(rate * 100).toFixed(1)}% of the time ${verdict}`)
  }
} else {
  console.log('\nNo controlled-variant votes yet — use the Stop count / Color order / Shape / Spacing buttons at ?vote=true to collect them.')
}
