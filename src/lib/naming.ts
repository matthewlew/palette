import { hexToOklch } from './oklch'
import type { HueFamily, LightnessBand, Mood } from './namingWords'
import { COLOR_NOUNS, PLACE_THINGS, MODIFIERS } from './namingWords'

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

export function namePalette(hexes: string[]): string {
  if (hexes.length === 0) {
    throw new Error('namePalette requires at least one hex color')
  }

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

  const rng = mulberry32(fnv1a(hexes.join(',')))
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

  const filteredPlaces = PLACE_THINGS.filter(
    (p) =>
      (!p.families || p.families.includes(dominantFamily)) &&
      (!p.moods || p.moods.includes(overallMood))
  )
  const placePool = filteredPlaces.length > 0 ? filteredPlaces : PLACE_THINGS
  const place = pickUnique(placePool.map((p) => p.word))

  const modifier = pickUnique(MODIFIERS[overallMood])

  const twoWordTemplate = `${modifier} ${dominantNoun}`
  const threeWordTemplates = [
    `${modifier} ${place} ${dominantNoun}`,
    `${accentNoun} ${place} ${dominantNoun}`,
  ].filter((name) => wordCount(name) <= 3)

  const candidates = threeWordTemplates.length > 0 ? [...threeWordTemplates, twoWordTemplate] : [twoWordTemplate]
  return pick(rng, candidates)
}
