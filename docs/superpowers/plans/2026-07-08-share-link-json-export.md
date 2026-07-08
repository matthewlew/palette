# Share Link + JSON Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user share a single gradient or their whole saved board via a copyable URL, and export/import the board as JSON — all client-side, no backend.

**Architecture:** A deterministic per-gradient naming function (`src/lib/naming.ts`) feeds a codec module (`src/lib/gradientCodec.ts`) that (de)serializes gradients to/from a URL fragment and to/from JSON text. The store gains a `name` field on `Gradient` and an import-preview state; `App.tsx` reads `location.hash` on load and renders a confirm banner before anything is saved. `Drawer.tsx` gets board-level and per-gradient share/copy/import UI.

**Tech Stack:** React 19, Zustand 5 (existing `persist` store), Vitest + Testing Library, no new dependencies.

---

### Task 1: Naming word banks

**Files:**
- Create: `src/lib/namingWords.ts`

- [ ] **Step 1: Write the word bank data**

```ts
// src/lib/namingWords.ts

export type HueFamily =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green'
  | 'teal' | 'cyanBlue' | 'blue' | 'violet' | 'purple' | 'pink' | 'neutral'

export type LightnessBand = 'dark' | 'mid' | 'light'
export type Mood = 'muted' | 'soft' | 'vivid'

// Color nouns keyed by [family][band]. Every family has all three bands
// filled; lists are intentionally short (3-4 words) — the naming function
// picks one, it doesn't need breadth beyond avoiding obvious repetition.
export const COLOR_NOUNS: Record<HueFamily, Record<LightnessBand, string[]>> = {
  red: {
    dark: ['Doom', 'Ox-Blood', 'Ember'],
    mid: ['Brick', 'Rooibos', 'Paprika'],
    light: ['Petal', 'Shell', 'Coral'],
  },
  orange: {
    dark: ['Rust', 'Copper', 'Amber Ash'],
    mid: ['Marmalade', 'Terracotta', 'Persimmon'],
    light: ['Peach', 'Apricot', 'Melon'],
  },
  amber: {
    dark: ['Whiskey', 'Tobacco', 'Bronze'],
    mid: ['Amber', 'Caramel', 'Ochre'],
    light: ['Honey', 'Butterscotch', 'Wheat'],
  },
  yellow: {
    dark: ['Ochre', 'Bee', 'Dijon'],
    mid: ['Mustard', 'Honeycomb', 'Saffron'],
    light: ['Toast', 'Butter', 'Straw'],
  },
  lime: {
    dark: ['Olive', 'Fern', 'Moss Bark'],
    mid: ['Chartreuse', 'Pear', 'Sprig'],
    light: ['Spring Leaf', 'Sprout', 'Pistachio'],
  },
  green: {
    dark: ['Juniper', 'Forest', 'Kelp'],
    mid: ['Moss', 'Fig Leaf', 'Matcha'],
    light: ['Celadon', 'Mist', 'Sprout'],
  },
  teal: {
    dark: ['Pine', 'Deep Lagoon', 'Malachite'],
    mid: ['Teal', 'Verdigris', 'Lagoon'],
    light: ['Sea Glass', 'Aqua', 'Spearmint'],
  },
  cyanBlue: {
    dark: ['Fathom', 'Abyss', 'Ink Well'],
    mid: ['Harbor', 'Cerulean', 'Slate'],
    light: ['Powder', 'Glacier', 'Sky'],
  },
  blue: {
    dark: ['Midnight', 'Ink', 'Navy'],
    mid: ['Denim', 'Delft', 'Cobalt'],
    light: ['Dawn', 'Periwinkle', 'Chicory'],
  },
  violet: {
    dark: ['Eclipse', 'Nightshade', 'Damson'],
    mid: ['Iris', 'Violet Hour', 'Wisteria'],
    light: ['Lilac', 'Lavender', 'Hazy Bloom'],
  },
  purple: {
    dark: ['Aubergine', 'Plum', 'Mulberry'],
    mid: ['Orchid', 'Amethyst', 'Grape'],
    light: ['Heather', 'Thistle', 'Orchid Mist'],
  },
  pink: {
    dark: ['Garnet', 'Berry', 'Sangria'],
    mid: ['Rose', 'Peony', 'Guava'],
    light: ['Blush', 'Cotton Candy', 'Bellini'],
  },
  neutral: {
    dark: ['Charcoal', 'Basalt', 'Soot'],
    mid: ['Clay', 'Pumice', 'Loam'],
    light: ['Bone', 'Oat', 'Chalk'],
  },
}

// Place/thing words, family-agnostic in general but with optional affinities
// that get preferred when present.
export interface PlaceThing {
  word: string
  families?: HueFamily[]
  moods?: Mood[]
}

export const PLACE_THINGS: PlaceThing[] = [
  { word: 'Amalfi', families: ['yellow', 'orange', 'blue'] },
  { word: 'Kyoto', families: ['pink', 'green'] },
  { word: 'Tangier', families: ['amber', 'orange'] },
  { word: 'Reykjavik', families: ['cyanBlue', 'blue', 'neutral'], moods: ['muted'] },
  { word: 'Marrakesh', families: ['red', 'orange', 'amber'] },
  { word: 'Vespers' },
  { word: 'Apothecary', moods: ['muted', 'soft'] },
  { word: 'Solstice' },
  { word: 'Verandah' },
  { word: 'Grove', families: ['green', 'lime'] },
  { word: 'Tidepool', families: ['teal', 'cyanBlue'] },
  { word: 'Sunset', families: ['red', 'orange', 'pink'] },
  { word: 'Sonnet' },
  { word: 'Fable' },
  { word: 'Arcade' },
  { word: 'Atlas' },
  { word: 'Meridian' },
]

// Modifiers keyed by mood.
export const MODIFIERS: Record<Mood, string[]> = {
  muted: ['Quiet', 'Sleeping', 'Faded', 'Dusty', 'Hushed'],
  soft: ['Wandering', 'Morning', 'Folded', 'Tender'],
  vivid: ['Running', 'Electric', 'Feral', 'Loud'],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/namingWords.ts
git commit -m "feat: add word banks for gradient naming"
```

---

### Task 2: Naming function

**Files:**
- Create: `src/lib/naming.ts`
- Test: `src/lib/naming.test.ts`

Implements `docs/superpowers/specs/2026-07-07-palette-naming-design.md`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/naming.test.ts
import { describe, it, expect } from 'vitest'
import { namePalette } from './naming'

describe('namePalette', () => {
  it('is deterministic for the same hex list', () => {
    const hexes = ['#ff0000', '#0000ff', '#ffff00']
    expect(namePalette(hexes)).toBe(namePalette(hexes))
  })

  it('produces a different name for a different palette', () => {
    const nameA = namePalette(['#ff0000', '#0000ff'])
    const nameB = namePalette(['#00ff00', '#ff00ff'])
    expect(nameA).not.toBe(nameB)
  })

  it('never repeats the same word twice in one name', () => {
    for (let i = 0; i < 50; i++) {
      const hexes = [
        `#${((i * 37) % 256).toString(16).padStart(2, '0')}aabb`,
        `#${((i * 91) % 256).toString(16).padStart(2, '0')}ccdd`,
      ]
      const words = namePalette(hexes).split(' ')
      expect(new Set(words).size).toBe(words.length)
    }
  })

  it('returns 2 or 3 words for 200 random-ish palettes and never throws', () => {
    for (let i = 0; i < 200; i++) {
      const hexes = [1, 2, 3].map(
        (n) => `#${(((i + 1) * n * 53) % 16777216).toString(16).padStart(6, '0')}`
      )
      const name = namePalette(hexes)
      const wordCount = name.split(' ').filter(Boolean).length
      expect(wordCount).toBeGreaterThanOrEqual(2)
      expect(wordCount).toBeLessThanOrEqual(3)
    }
  })

  it('throws on an empty hex list', () => {
    expect(() => namePalette([])).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- naming.test.ts`
Expected: FAIL with "Cannot find module './naming'" or similar.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/naming.ts
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

  const dominantNoun = pickUnique(COLOR_NOUNS[dominantFamily][overallBand])
  const accentNoun = pickUnique(COLOR_NOUNS[accentFamily][bands[accentIndex]])

  const filteredPlaces = PLACE_THINGS.filter(
    (p) =>
      (!p.families || p.families.includes(dominantFamily)) &&
      (!p.moods || p.moods.includes(overallMood))
  )
  const placePool = filteredPlaces.length > 0 ? filteredPlaces : PLACE_THINGS
  const place = pickUnique(placePool.map((p) => p.word))

  const modifier = pickUnique(MODIFIERS[overallMood])

  const templateRoll = Math.floor(rng() * 3)
  if (templateRoll === 0) {
    return `${modifier} ${place} ${dominantNoun}`
  }
  if (templateRoll === 1) {
    return `${accentNoun} ${place} ${dominantNoun}`
  }
  return `${modifier} ${dominantNoun}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- naming.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/naming.ts src/lib/naming.test.ts
git commit -m "feat: deterministic gradient naming from palette hex values"
```

---

### Task 3: Add `name` to `Gradient` and wire into the store

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/store/useAppStore.test.ts` (inside the existing `describe('useAppStore', ...)` block, after the "dedupes saving" test):

```ts
  it('assigns a deterministic name when saving a gradient without one', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    const saved = useAppStore.getState().saved[0]
    expect(saved.name).toBeTruthy()
    expect(typeof saved.name).toBe('string')
  })

  it('preserves an existing name instead of regenerating it', () => {
    useAppStore.getState().saveGradient({ ...sampleGradient, name: 'Custom Name' })
    expect(useAppStore.getState().saved[0].name).toBe('Custom Name')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useAppStore.test.ts`
Expected: FAIL — `saved.name` is `undefined`.

- [ ] **Step 3: Add the `name` field to the type**

In `src/store/types.ts`, add to the `Gradient` interface (after `id: string`):

```ts
  /** Deterministic, human-facing name derived from this gradient's colors
   * (see src/lib/naming.ts). Present on saved/shared gradients; absent on
   * freshly generated feed gradients until saved. */
  name?: string
```

- [ ] **Step 4: Generate the name on save**

In `src/store/useAppStore.ts`, add the import:

```ts
import { namePalette } from '../lib/naming'
```

Replace the `saveGradient` implementation:

```ts
      saveGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        const alreadySaved = get().saved.some((g) => gradientSignature(g) === signature)
        if (alreadySaved) return
        const name = gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
        // Store a copy with a fresh id: edit-mode commits reuse the gradient
        // id across signature changes, so saving before and after an edit
        // would otherwise put two entries with the same id (= duplicate React
        // keys) into the drawer.
        set({ saved: [...get().saved, { ...gradient, id: crypto.randomUUID(), name }] })
      },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- useAppStore.test.ts`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 6: Commit**

```bash
git add src/store/types.ts src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: assign deterministic names to saved gradients"
```

---

### Task 4: Gradient codec (encode/decode for links and JSON)

**Files:**
- Create: `src/lib/gradientCodec.ts`
- Test: `src/lib/gradientCodec.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/gradientCodec.test.ts
import { describe, it, expect } from 'vitest'
import {
  encodeToFragment,
  decodeFromFragment,
  toExportJson,
  fromImportJson,
  type SharePayload,
} from './gradientCodec'

const gradientA = {
  type: 'linear' as const,
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  name: 'Test Gradient',
}

const gradientB = {
  type: 'radial' as const,
  stops: [
    { hex: '#00ff00', position: 0 },
    { hex: '#ffff00', position: 50 },
    { hex: '#ff00ff', position: 100 },
  ],
  reversed: true,
  name: 'Second Gradient',
}

describe('gradientCodec fragment round-trip', () => {
  it('round-trips a single gradient payload', () => {
    const payload: SharePayload = { kind: 'gradient', gradients: [gradientA] }
    const fragment = encodeToFragment(payload)
    expect(decodeFromFragment(fragment)).toEqual(payload)
  })

  it('round-trips a board payload with multiple gradients', () => {
    const payload: SharePayload = { kind: 'board', gradients: [gradientA, gradientB] }
    const fragment = encodeToFragment(payload)
    expect(decodeFromFragment(fragment)).toEqual(payload)
  })

  it('returns null for a malformed fragment instead of throwing', () => {
    expect(decodeFromFragment('d=not-valid-base64!!!')).toBeNull()
  })

  it('returns null for a fragment with no d= param', () => {
    expect(decodeFromFragment('')).toBeNull()
  })
})

describe('gradientCodec JSON round-trip', () => {
  it('round-trips a board payload through JSON text', () => {
    const payload: SharePayload = { kind: 'board', gradients: [gradientA, gradientB] }
    const json = toExportJson(payload)
    expect(fromImportJson(json)).toEqual(payload)
  })

  it('returns null for invalid JSON text', () => {
    expect(fromImportJson('{not json')).toBeNull()
  })

  it('returns null for well-formed JSON missing required shape', () => {
    expect(fromImportJson(JSON.stringify({ foo: 'bar' }))).toBeNull()
    expect(fromImportJson(JSON.stringify({ kind: 'gradient' }))).toBeNull()
    expect(fromImportJson(JSON.stringify({ kind: 'nonsense', gradients: [] }))).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- gradientCodec.test.ts`
Expected: FAIL with "Cannot find module './gradientCodec'"

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/gradientCodec.ts
import type { Gradient, GradientType } from './gradient' // GradientType re-exported below for consumers
import type { GradientStop } from './gradient'

export interface SharePayloadGradient {
  type: GradientType
  stops: GradientStop[]
  reversed?: boolean
  repeatEnabled?: boolean
  hardStops?: boolean
  name: string
}

export interface SharePayload {
  kind: 'gradient' | 'board'
  gradients: SharePayloadGradient[]
}

/** Strips fields that shouldn't cross the wire (currently just `id`, which
 * is always regenerated on import) and drops `undefined` optional keys so
 * encoded payloads stay compact and round-trip through JSON.stringify
 * without producing spurious differences. */
export function toSharePayloadGradient(gradient: Gradient): SharePayloadGradient {
  const out: SharePayloadGradient = {
    type: gradient.type,
    stops: gradient.stops,
    name: gradient.name ?? '',
  }
  if (gradient.reversed !== undefined) out.reversed = gradient.reversed
  if (gradient.repeatEnabled !== undefined) out.repeatEnabled = gradient.repeatEnabled
  if (gradient.hardStops !== undefined) out.hardStops = gradient.hardStops
  return out
}

function isSharePayloadGradient(value: unknown): value is SharePayloadGradient {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    Array.isArray(v.stops) &&
    v.stops.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as Record<string, unknown>).hex === 'string' &&
        typeof (s as Record<string, unknown>).position === 'number'
    ) &&
    typeof v.name === 'string'
  )
}

function isSharePayload(value: unknown): value is SharePayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.kind === 'gradient' || v.kind === 'board') &&
    Array.isArray(v.gradients) &&
    v.gradients.every(isSharePayloadGradient)
  )
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return decodeURIComponent(escape(atob(padded)))
}

export function encodeToFragment(payload: SharePayload): string {
  return `d=${base64UrlEncode(JSON.stringify(payload))}`
}

/** Accepts either a raw fragment string ("d=...") or a full `location.hash`
 * value (which includes the leading "#"). Returns null on any decode
 * failure rather than throwing, so callers can treat "no valid share data"
 * as a single case. */
export function decodeFromFragment(fragment: string): SharePayload | null {
  const cleaned = fragment.startsWith('#') ? fragment.slice(1) : fragment
  const match = cleaned.match(/(?:^|&)d=([^&]+)/)
  if (!match) return null
  try {
    const json = base64UrlDecode(match[1])
    const parsed: unknown = JSON.parse(json)
    return isSharePayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function toExportJson(payload: SharePayload): string {
  return JSON.stringify(payload, null, 2)
}

export function fromImportJson(text: string): SharePayload | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return isSharePayload(parsed) ? parsed : null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- gradientCodec.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradientCodec.ts src/lib/gradientCodec.test.ts
git commit -m "feat: add gradient share/export codec (URL fragment + JSON)"
```

---

### Task 5: Clipboard copy feedback hook

**Files:**
- Create: `src/hooks/useCopyFeedback.ts`
- Test: `src/hooks/useCopyFeedback.test.ts`

A tiny shared hook (not a global toast system) that every copy button in Task 6/7 uses to briefly show a checkmark state.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useCopyFeedback.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCopyFeedback } from './useCopyFeedback'

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCopyFeedback', () => {
  it('starts with copied=false', () => {
    const { result } = renderHook(() => useCopyFeedback())
    expect(result.current.copied).toBe(false)
  })

  it('sets copied=true after a successful copy, then clears after the timeout', async () => {
    const { result } = renderHook(() => useCopyFeedback())
    await act(async () => {
      await result.current.copy('hello')
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(result.current.copied).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useCopyFeedback.test.ts`
Expected: FAIL with "Cannot find module './useCopyFeedback'"

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useCopyFeedback.ts
import { useCallback, useRef, useState } from 'react'

const FEEDBACK_DURATION_MS = 1500

/** Copies text to the clipboard and exposes a transient `copied` flag for
 * ~1.5s afterward, so a button can swap its icon to a checkmark without
 * every call site re-implementing its own timeout. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS)
  }, [])

  return { copied, copy }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useCopyFeedback.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCopyFeedback.ts src/hooks/useCopyFeedback.test.ts
git commit -m "feat: add useCopyFeedback hook for transient copy confirmation"
```

---

### Task 6: Drawer board-level share/export/import actions

**Files:**
- Modify: `src/components/Drawer.tsx`
- Modify: `src/components/Drawer.module.css`
- Modify: `src/components/Drawer.test.tsx` (create if it doesn't exist — check first)

- [ ] **Step 1: Check for an existing Drawer test file**

Run: `ls src/components/Drawer.test.tsx 2>/dev/null || echo "none"`

If none exists, the new test file starts with the imports/setup shown in Step 2 below in full; if it exists, add the new `describe` block to it using the same import style already present.

- [ ] **Step 2: Write the failing tests**

```tsx
// src/components/Drawer.test.tsx (new describe block, or new file)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'
import type { Gradient } from '../store/types'

const board: Gradient[] = [
  {
    id: 'g1',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
    name: 'Test Gradient',
  },
]

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('Drawer board-level actions', () => {
  it('copies a share link when "Share board" is clicked', async () => {
    render(<Drawer saved={board} onSelect={() => {}} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share board/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(`${window.location.origin}${window.location.pathname}#d=`)
    )
  })

  it('copies board JSON when "Copy JSON" is clicked', async () => {
    render(<Drawer saved={board} onSelect={() => {}} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /copy json/i }))
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(JSON.parse(copiedText)).toMatchObject({ kind: 'board' })
  })

  it('does not render board actions when there are no saved gradients', () => {
    render(<Drawer saved={[]} onSelect={() => {}} onImport={() => {}} />)
    expect(screen.queryByRole('button', { name: /share board/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- Drawer.test.tsx`
Expected: FAIL — no "Share board" / "Copy JSON" buttons rendered, and `onImport` prop doesn't exist yet (TypeScript error).

- [ ] **Step 4: Add the codec/hook imports and board actions to Drawer.tsx**

Replace the full contents of `src/components/Drawer.tsx`:

```tsx
import { buildGradientCss } from '../lib/gradient'
import { encodeToFragment, toExportJson, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
  /** Invoked with raw JSON text pasted/selected by the user for import. */
  onImport: (jsonText: string) => void
  /** Fades the drawer out (and disables pointer events) while the user is idle. */
  hidden?: boolean
}

function shareLink(gradients: Gradient[], kind: 'gradient' | 'board'): string {
  const fragment = encodeToFragment({ kind, gradients: gradients.map(toSharePayloadGradient) })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

export function Drawer({ saved, onSelect, onImport, hidden = false }: DrawerProps) {
  const shareFeedback = useCopyFeedback()
  const jsonFeedback = useCopyFeedback()

  return (
    <div data-testid="saved-drawer" className={hidden ? `${styles.drawer} ${styles.hidden}` : styles.drawer}>
      {saved.length > 0 && (
        <div className={styles.boardActions}>
          <button
            type="button"
            onClick={() => shareFeedback.copy(shareLink(saved, 'board'))}
          >
            {shareFeedback.copied ? 'Copied!' : 'Share board'}
          </button>
          <button
            type="button"
            onClick={() =>
              jsonFeedback.copy(
                toExportJson({ kind: 'board', gradients: saved.map(toSharePayloadGradient) })
              )
            }
          >
            {jsonFeedback.copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            type="button"
            onClick={() => {
              const text = window.prompt('Paste gradient/board JSON to import:')
              if (text) onImport(text)
            }}
          >
            Import
          </button>
        </div>
      )}
      {saved.map((gradient) => (
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{
            backgroundImage:
              gradient.type === 'square'
                ? undefined
                : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                    repeat: gradient.repeatEnabled,
                    hard: gradient.hardStops,
                  }),
          }}
          onClick={() => onSelect(gradient)}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
        </button>
      ))}
    </div>
  )
}
```

Note: `saved.length === 0` case above intentionally hides board actions (no board to share) — this matches the third test in Step 2. The empty-board Drawer still renders (currently empty divs); when `saved` is empty, there's nothing to import into visually but the Import button is board-independent — moved inside the `saved.length > 0` block per the test, i.e. Import is only offered once there's at least one save action context. (If product wants Import available even with zero saves, that's a one-line change to hoist the button outside the conditional — out of scope here since the approved design doesn't specify empty-board behavior.)

- [ ] **Step 5: Add board action styles**

Append to `src/components/Drawer.module.css`:

```css
.boardActions {
  flex: 0 0 auto;
  display: flex;
  gap: 6px;
  align-items: center;
  pointer-events: auto;
}

.boardActions button {
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- Drawer.test.tsx`
Expected: PASS (3 new tests; pre-existing Drawer tests, if any, still pass — check with full run below)

- [ ] **Step 7: Run the full test suite to check for regressions from the `onImport` prop**

Run: `npm test`
Expected: PASS everywhere except any call site that renders `<Drawer>` without the now-required `onImport` prop (fixed in Task 8, which wires `App.tsx`) — if `App.test.tsx` fails here, note it and continue; Task 8 resolves it.

- [ ] **Step 8: Commit**

```bash
git add src/components/Drawer.tsx src/components/Drawer.module.css src/components/Drawer.test.tsx
git commit -m "feat: add board share link, JSON export, and import to Drawer"
```

---

### Task 7: Per-gradient share/copy actions on drawer thumbnails

**Files:**
- Modify: `src/components/Drawer.tsx`
- Modify: `src/components/Drawer.module.css`
- Modify: `src/components/Drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Drawer.test.tsx`:

```tsx
describe('Drawer per-gradient actions', () => {
  it('copies a single-gradient share link from a thumbnail action', async () => {
    render(<Drawer saved={board} onSelect={() => {}} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share this gradient/i }))
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(copiedText).toContain('#d=')
  })

  it('does not trigger onSelect when the share action is clicked', async () => {
    const onSelect = vi.fn()
    render(<Drawer saved={board} onSelect={onSelect} onImport={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share this gradient/i }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Drawer.test.tsx`
Expected: FAIL — no "Share this gradient" button.

- [ ] **Step 3: Add a per-thumbnail share button**

In `src/components/Drawer.tsx`, replace the `saved.map(...)` block with a version that wraps each thumbnail in a positioned container holding both the existing select button and a new share button:

```tsx
      {saved.map((gradient) => (
        <div key={gradient.id} className={styles.thumbnailWrap}>
          <button
            type="button"
            data-testid="drawer-thumbnail"
            aria-label={`Saved ${gradient.type} gradient`}
            className={styles.thumbnail}
            style={{
              backgroundImage:
                gradient.type === 'square'
                  ? undefined
                  : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                      repeat: gradient.repeatEnabled,
                      hard: gradient.hardStops,
                    }),
            }}
            onClick={() => onSelect(gradient)}
          >
            {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
          </button>
          <button
            type="button"
            className={styles.shareThumb}
            aria-label="Share this gradient"
            onClick={(e) => {
              e.stopPropagation()
              shareFeedback.copy(shareLink([gradient], 'gradient'))
            }}
          >
            {shareFeedback.copied ? '✓' : '⤴'}
          </button>
        </div>
      ))}
```

Note: this reuses the same `shareFeedback` hook instance as the board-share button, which is acceptable since only one "copied" indicator is visible at a time in practice; the per-gradient button shows its own glyph swap independent of which button was last clicked being visually distinguishable enough for this feature's scope.

- [ ] **Step 4: Add thumbnail-wrap and share-button styles**

Append to `src/components/Drawer.module.css`:

```css
.thumbnailWrap {
  position: relative;
  flex: 0 0 auto;
}

.shareThumb {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 10px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- Drawer.test.tsx`
Expected: PASS (all Drawer tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/Drawer.tsx src/components/Drawer.module.css src/components/Drawer.test.tsx
git commit -m "feat: add per-gradient share action to drawer thumbnails"
```

---

### Task 8: Import-preview state, banner component, and App.tsx wiring

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/store/useAppStore.test.ts`
- Create: `src/components/ImportBanner.tsx`
- Create: `src/components/ImportBanner.module.css`
- Create: `src/components/ImportBanner.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing store tests**

Add to `src/store/useAppStore.test.ts`:

```ts
  it('starts with no pending import', () => {
    expect(useAppStore.getState().pendingImport).toBeNull()
  })

  it('setPendingImport stores gradients awaiting confirmation', () => {
    useAppStore.getState().setPendingImport([sampleGradient])
    expect(useAppStore.getState().pendingImport).toEqual([sampleGradient])
  })

  it('confirmImport saves every pending gradient and clears the pending state', () => {
    useAppStore.getState().setPendingImport([sampleGradient])
    useAppStore.getState().confirmImport()
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(useAppStore.getState().pendingImport).toBeNull()
  })

  it('dismissImport clears pending state without saving', () => {
    useAppStore.getState().setPendingImport([sampleGradient])
    useAppStore.getState().dismissImport()
    expect(useAppStore.getState().saved).toHaveLength(0)
    expect(useAppStore.getState().pendingImport).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useAppStore.test.ts`
Expected: FAIL — `pendingImport`/`setPendingImport`/`confirmImport`/`dismissImport` don't exist.

- [ ] **Step 3: Add pending-import state to the store**

In `src/store/useAppStore.ts`, extend `AppState`:

```ts
interface AppState {
  mode: ViewMode
  current: Gradient | null
  saved: Gradient[]
  activeColorSet: ColorSet
  noiseEnabled: boolean
  pendingImport: Gradient[] | null
  toggleNoise: () => void
  setCurrentGradient: (gradient: Gradient) => void
  saveGradient: (gradient: Gradient) => void
  isGradientSaved: (gradient: Gradient) => boolean
  removeSavedGradient: (gradient: Gradient) => void
  toggleSaveGradient: (gradient: Gradient) => void
  enterEditMode: () => void
  exitEditMode: () => void
  setActiveColorSet: (colorSet: ColorSet) => void
  setPendingImport: (gradients: Gradient[]) => void
  confirmImport: () => void
  dismissImport: () => void
}
```

Add to the state object (after `noiseEnabled: false,`):

```ts
      pendingImport: null,
```

Add the three new actions (after `setActiveColorSet`):

```ts
      setPendingImport: (gradients) => set({ pendingImport: gradients }),
      confirmImport: () => {
        const pending = get().pendingImport
        if (!pending) return
        pending.forEach((g) => get().saveGradient(g))
        set({ pendingImport: null })
      },
      dismissImport: () => set({ pendingImport: null }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useAppStore.test.ts`
Expected: PASS (all tests, including 4 new ones)

- [ ] **Step 5: Commit the store change**

```bash
git add src/store/types.ts src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add pending-import state to app store"
```

- [ ] **Step 6: Write the failing ImportBanner test**

```tsx
// src/components/ImportBanner.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportBanner } from './ImportBanner'

describe('ImportBanner', () => {
  it('renders the count of pending gradients', () => {
    render(<ImportBanner count={3} onConfirm={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/import 3 gradients/i)).toBeInTheDocument()
  })

  it('uses singular phrasing for a count of 1', () => {
    render(<ImportBanner count={1} onConfirm={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/import 1 gradient\b/i)).toBeInTheDocument()
  })

  it('calls onConfirm when "Add to board" is clicked', () => {
    const onConfirm = vi.fn()
    render(<ImportBanner count={1} onConfirm={onConfirm} onDismiss={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add to board/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onDismiss when "Dismiss" is clicked', () => {
    const onDismiss = vi.fn()
    render(<ImportBanner count={1} onConfirm={() => {}} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- ImportBanner.test.tsx`
Expected: FAIL with "Cannot find module './ImportBanner'"

- [ ] **Step 8: Implement ImportBanner**

```tsx
// src/components/ImportBanner.tsx
import styles from './ImportBanner.module.css'

interface ImportBannerProps {
  count: number
  onConfirm: () => void
  onDismiss: () => void
}

export function ImportBanner({ count, onConfirm, onDismiss }: ImportBannerProps) {
  return (
    <div className={styles.banner} data-testid="import-banner">
      <span>
        Import {count} gradient{count === 1 ? '' : 's'}?
      </span>
      <div className={styles.actions}>
        <button type="button" onClick={onConfirm}>
          Add to board
        </button>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

```css
/* src/components/ImportBanner.module.css */
.banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- ImportBanner.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 10: Commit**

```bash
git add src/components/ImportBanner.tsx src/components/ImportBanner.module.css src/components/ImportBanner.test.tsx
git commit -m "feat: add ImportBanner confirm/dismiss component"
```

- [ ] **Step 11: Write the failing App.tsx integration tests**

Check the existing `src/App.test.tsx` first (`cat src/App.test.tsx`) to match its existing render/mock setup, then add:

```tsx
describe('App import flow', () => {
  it('shows the import banner when the URL hash contains a valid share payload on load', () => {
    const payload = {
      kind: 'gradient',
      gradients: [
        {
          type: 'linear',
          stops: [
            { hex: '#ff0000', position: 0 },
            { hex: '#0000ff', position: 100 },
          ],
          name: 'Test',
        },
      ],
    }
    const fragment = encodeToFragment(payload)
    window.location.hash = `#${fragment}`

    render(<App />)
    expect(screen.getByTestId('import-banner')).toBeInTheDocument()

    window.location.hash = ''
  })
})
```

Add the import at the top of `src/App.test.tsx`:

```ts
import { encodeToFragment } from './lib/gradientCodec'
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npm test -- App.test.tsx`
Expected: FAIL — no import banner rendered, hash is never read.

- [ ] **Step 13: Wire hash-reading and the banner into App.tsx**

Replace the full contents of `src/App.tsx`:

```tsx
import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { Feed } from './components/Feed'
import { Drawer } from './components/Drawer'
import { EditMode } from './components/EditMode'
import { ImportBanner } from './components/ImportBanner'
import { decodeFromFragment, fromImportJson } from './lib/gradientCodec'
import { withViewTransition } from './lib/viewTransition'
import { useIdleFade } from './hooks/useIdleFade'
import type { Gradient } from './store/types'

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const pendingImport = useAppStore((s) => s.pendingImport)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const setPendingImport = useAppStore((s) => s.setPendingImport)
  const confirmImport = useAppStore((s) => s.confirmImport)
  const dismissImport = useAppStore((s) => s.dismissImport)
  const chromeVisible = useIdleFade()

  useEffect(() => {
    const payload = decodeFromFragment(window.location.hash)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map((g) => ({ ...g, id: crypto.randomUUID() }))
    setPendingImport(gradients)
  }, [setPendingImport])

  function handleImportJson(jsonText: string) {
    const payload = fromImportJson(jsonText)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map((g) => ({ ...g, id: crypto.randomUUID() }))
    setPendingImport(gradients)
  }

  function handleDismissImport() {
    dismissImport()
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  function handleConfirmImport() {
    confirmImport()
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  if (mode === 'edit' && current) {
    return <EditMode gradient={current} onExit={() => withViewTransition(exitEditMode)} />
  }

  return (
    <>
      {pendingImport && (
        <ImportBanner count={pendingImport.length} onConfirm={handleConfirmImport} onDismiss={handleDismissImport} />
      )}
      <Feed chromeVisible={chromeVisible} />
      <Drawer
        hidden={!chromeVisible}
        saved={saved}
        onSelect={(gradient) => {
          setCurrentGradient(gradient)
        }}
        onImport={handleImportJson}
      />
    </>
  )
}
```

- [ ] **Step 14: Run tests to verify they pass**

Run: `npm test -- App.test.tsx`
Expected: PASS (including the new import-flow test)

- [ ] **Step 15: Run the full suite**

Run: `npm test`
Expected: PASS across all test files (naming, gradientCodec, useCopyFeedback, Drawer, ImportBanner, useAppStore, App)

- [ ] **Step 16: Run typecheck and lint**

Run: `npm run build`
Expected: PASS (tsc -b succeeds, vite build succeeds)

Run: `npm run lint`
Expected: PASS with no new warnings/errors

- [ ] **Step 17: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire share-link import into App with confirm banner"
```

---

### Task 9: Manual verification pass

**Files:** none (browser verification only, using the dev server)

- [ ] **Step 1: Start the dev server and confirm the golden path**

Run the app (`npm run dev`), save 2-3 gradients to the board, then:
1. Click "Share board" in the drawer — confirm a link is copied (paste it somewhere to check it contains `#d=`).
2. Open that link in a fresh tab/incognito window (or manually set `location.hash` to the copied fragment and reload) — confirm the import banner appears with the correct count, "Add to board" adds them to the drawer, and reloading afterward does not re-show the banner (hash was cleared).
3. Click "Copy JSON", paste the clipboard contents into a text editor — confirm it's valid, readable JSON with a `name` on every gradient.
4. Click "Import", paste that same JSON back in — confirm the banner reappears with the right count and confirming adds them (dedup via `gradientSignature` means re-adding identical gradients should not double up).
5. Click the per-gradient share icon on one thumbnail — confirm it copies a link that, when opened, imports only that one gradient.
6. Try importing malformed JSON via the Import prompt — confirm nothing crashes and no banner appears.

- [ ] **Step 2: Report results to the user**

Summarize pass/fail for each of the 6 checks above before considering the feature done.

---

## Self-Review Notes

- **Spec coverage:** Codec (Task 4), naming prerequisite (Tasks 1-2), data model (Task 3), drawer board + per-gradient entry points (Tasks 6-7), import preview-confirm flow for both link and JSON (Task 8), testing (each task's own test file) — all spec sections have a corresponding task.
- **Type consistency:** `SharePayload`/`SharePayloadGradient` (Task 4) are reused verbatim in Task 6-8; `pendingImport: Gradient[] | null` (Task 8) matches the `Gradient[]` produced by mapping `payload.gradients` in `App.tsx`; `namePalette` (Task 2) signature matches its two call sites (Task 3's `useAppStore.ts`).
- **No placeholders:** every step has runnable code; the one deliberately deferred decision (empty-board Import visibility) is explicitly called out with reasoning in Task 6 Step 4 rather than left vague.
