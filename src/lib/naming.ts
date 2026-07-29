import { hexToOklch } from './oklch'
import type { HueFamily, LightnessBand, Mood, PlaceThing } from './namingWords'
import { COLOR_NOUNS, PLACE_THINGS, REFERENCES, MODIFIERS } from './namingWords'

function hueFamily(h: number, c: number): HueFamily {
  if (c < 0.03) return 'neutral'
  const hue = ((h % 360) + 360) % 360
  if (hue >= 350 || hue < 20) return 'red'
  if (hue < 55) return 'orange'
  if (hue < 75) return 'amber'
  if (hue < 105) return 'yellow'
  if (hue < 130) return 'lime'
  if (hue < 165) return 'green'
  if (hue < 200) return 'teal'
  if (hue < 240) return 'cyanBlue'
  if (hue < 275) return 'blue'
  if (hue < 305) return 'violet'
  if (hue < 330) return 'purple'
  return 'pink'
}

function lightnessBand(l: number): LightnessBand {
  if (l < 0.35) return 'dark'
  if (l <= 0.7) return 'mid'
  return 'light'
}

function moodFromChroma(c: number): Mood {
  if (c < 0.06) return 'muted'
  if (c <= 0.12) return 'soft'
  return 'vivid'
}

// FNV-1a, feeding a mulberry32 PRNG — both tiny, deterministic, no dependency.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export interface NamePaletteOptions {
  /** Names already in use (e.g. everything in the Gallery). A collision
   * re-rolls with a salted seed rather than handing the user a second
   * "Quiet Ember Ithaca" — see namePalette. */
  taken?: Iterable<string>
}

/** Re-roll budget on collision. Deliberately finite: with a board large
 * enough that 24 salted draws all collide, the pools are genuinely exhausted
 * and looping harder just burns time to return the same answer. */
const MAX_ATTEMPTS = 24

export function namePalette(hexes: string[], options: NamePaletteOptions = {}): string {
  if (hexes.length === 0) {
    throw new Error('namePalette requires at least one hex color')
  }

  const taken = options.taken ? new Set([...options.taken].map((n) => n.toLowerCase())) : null

  // Attempt 0 uses the bare hex seed, so an un-collided name stays exactly
  // what it has always been for a given palette: naming is deterministic, and
  // share links / stored rows depend on that.
  let name = ''
  for (let attempt = 0; attempt < (taken ? MAX_ATTEMPTS : 1); attempt++) {
    name = buildName(hexes, attempt === 0 ? '' : `~${attempt}`)
    if (!taken || !taken.has(name.toLowerCase())) return name
  }
  return name
}

function buildName(hexes: string[], salt: string): string {
  const oklchColors = hexes.map(hexToOklch)
  const families = oklchColors.map((c) => hueFamily(c.h, c.c))
  const bands = oklchColors.map((c) => lightnessBand(c.l))

  const familyCounts = new Map<HueFamily, number>()
  for (const f of families) familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1)
  const dominantFamily = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

  let accentIndex = 0
  let maxChroma = -1
  oklchColors.forEach((c, i) => {
    if (c.c > maxChroma) {
      maxChroma = c.c
      accentIndex = i
    }
  })
  const accentFamily = families[accentIndex]

  const avgLightness = oklchColors.reduce((sum, c) => sum + c.l, 0) / oklchColors.length
  const overallBand = lightnessBand(avgLightness)
  const overallMood = moodFromChroma(maxChroma)

  const rng = mulberry32(fnv1a(hexes.join(',') + salt))
  const used = new Set<string>()

  function pickUnique<T extends string>(candidates: T[]): T {
    const remaining = candidates.filter((w) => !used.has(w))
    const pool = remaining.length > 0 ? remaining : candidates
    const word = pick(rng, pool)
    used.add(word)
    return word
  }

  const wordCount = (s: string) => s.split(' ').filter(Boolean).length

  // Three-word templates combine two picked units plus the dominant noun, so
  // the dominant noun must be single-word there to keep the total at 3.
  const singleWordDominantNouns = COLOR_NOUNS[dominantFamily][overallBand].filter(
    (w) => wordCount(w) === 1
  )
  const dominantNounPool =
    singleWordDominantNouns.length > 0
      ? singleWordDominantNouns
      : COLOR_NOUNS[dominantFamily][overallBand]
  const dominantNoun = pickUnique(dominantNounPool)

  const accentNoun = pickUnique(COLOR_NOUNS[accentFamily][bands[accentIndex]])

  // Affinity filter, applied to whichever pool: keep the entries that either
  // declare no preference or declare one this palette matches.
  function byAffinity(pool: PlaceThing[]): string[] {
    const matching = pool.filter(
      (p) =>
        (!p.families || p.families.includes(dominantFamily)) &&
        (!p.moods || p.moods.includes(overallMood))
    )
    return (matching.length > 0 ? matching : pool).map((p) => p.word)
  }

  const place = pickUnique(byAffinity(PLACE_THINGS))
  const reference = pickUnique(byAffinity(REFERENCES))
  const modifier = pickUnique(MODIFIERS[overallMood])

  // Templates follow natural English adjective order — opinion/mood first,
  // color next, concrete head noun last ("Dusty Cobalt Harbor") — so names
  // read as coherent phrases instead of shuffled word piles like
  // "Cobalt Solstice Slate". A cultural reference occupies the same slot as a
  // place: it is the head noun, never a modifier, so "Faded Indigo Nocturne"
  // parses and "Nocturne Faded Indigo" is never generated.
  const templates = [
    `${modifier} ${dominantNoun}`,
    `${accentNoun} ${place}`,
    `${modifier} ${reference}`,
    `${dominantNoun} ${reference}`,
    `${accentNoun} ${reference}`,
    `${modifier} ${dominantNoun} ${place}`,
    `${modifier} ${dominantNoun} ${reference}`,
    `${modifier} ${accentNoun} ${reference}`,
  ]

  // The cap is a real constraint, not a formality — a stray multi-word entry
  // in any pool would otherwise ship four-word names.
  const candidates = templates.filter((name) => wordCount(name) <= 3)
  return pick(rng, candidates)
}
