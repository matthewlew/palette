# Gradient Toolkit — Keyword Vocabulary + Authoring (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the author hand-curate gradient "drops" from a keyword→color-pairing vocabulary, arranging keywords via a drag-to-reorder word-matching sort, with a live aesthetic score reused from the existing scorer, all persisted in-browser.

**Architecture:** Add two persisted arrays (`keywordBindings`, `curatedDrops`) to the zustand store with CRUD + a v4 migration, following the existing collections pattern. A pure `keywordCompose.ts` turns an ordered list of bindings into a `Gradient` and scores it via the existing `scorePalette`. A new `DropAuthor` component provides the three-region authoring UI (vocabulary / word-matching sort compose / drop), reusing the existing `useDragReorder` hook for the sort. A minimal render lists saved drops under the Daily Drops segment.

**Tech Stack:** TypeScript, React 19, zustand + persist, Vitest + Testing Library. Reuses `src/lib/paletteScore.ts` (`scorePalette`), `src/lib/oklch.ts` (`hexToOklch`), `src/lib/gradient.ts` (`buildGradientCss`, `GradientType`, `GradientStop`), `src/hooks/useDragReorder.ts`.

---

## File Structure

- Modify: `src/store/types.ts` — add `KeywordBinding`, `CuratedDrop` interfaces.
- Modify: `src/store/useAppStore.ts` — state + CRUD actions + v4 migration.
- Create: `src/lib/keywordCompose.ts` — `composeStops`, `composeGradient`, `scoreComposition`.
- Create: `src/lib/keywordCompose.test.ts`.
- Create: `src/components/DropAuthor.tsx` + `DropAuthor.module.css` — authoring UI.
- Create: `src/components/DropAuthor.test.tsx`.
- Modify: `src/components/Gallery.tsx` — an "Author" toggle in the Daily Drops (feed) segment that mounts `DropAuthor`, and a minimal saved-drops list.

---

### Task 1: Data model — `KeywordBinding` and `CuratedDrop`

**Files:**
- Modify: `src/store/types.ts`

- [ ] **Step 1: Add the interfaces**

Append to `src/store/types.ts` (after the existing `Collection` interfaces). `GradientType` and `Gradient` are already available in this file (`GradientType` via the top import, `Gradient` defined above):

```ts
/** One unit of the keyword vocabulary: a word bound to an ordered color
 * pairing, plus optional composition hints. This is the reusable "training"
 * unit a future export surfaces as an AI prompt. */
export interface KeywordBinding {
  id: string
  keyword: string
  colors: string[] // ordered hexes — the color / pairing for this word (>=1)
  shape?: GradientType
  note?: string
}

/** A hand-curated, dated drop: short blog copy plus the gradients the author
 * composed from keyword bindings. */
export interface CuratedDrop {
  id: string
  title: string
  description: string
  date: string // ISO calendar day, YYYY-MM-DD
  gradients: Gradient[]
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors (pure type additions).

- [ ] **Step 3: Commit**

```bash
git add src/store/types.ts
git commit -m "feat: KeywordBinding and CuratedDrop types"
```

---

### Task 2: Store state, CRUD actions, and v4 migration

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

**Context:** The store uses zustand `persist`. The `AppState` interface (around line 30–62) declares state + action signatures; the `create()` body (around line 66+) implements them; the persist config (around line 286) has `version` and `migrate`. Follow the collections pattern exactly.

- [ ] **Step 1: Write failing store tests**

Append to `src/store/useAppStore.test.ts`:

```ts
describe('keyword vocabulary + curated drops', () => {
  beforeEach(() => {
    useAppStore.setState({ keywordBindings: [], curatedDrops: [] })
  })

  it('adds a keyword binding and returns its id', () => {
    const id = useAppStore.getState().addKeywordBinding({
      keyword: 'glacier',
      colors: ['#005e6b', '#e3ecec'],
    })
    const bindings = useAppStore.getState().keywordBindings
    expect(bindings).toHaveLength(1)
    expect(bindings[0].id).toBe(id)
    expect(bindings[0].keyword).toBe('glacier')
    expect(bindings[0].colors).toEqual(['#005e6b', '#e3ecec'])
  })

  it('updates and deletes a keyword binding', () => {
    const id = useAppStore.getState().addKeywordBinding({ keyword: 'pine', colors: ['#142b1f'] })
    useAppStore.getState().updateKeywordBinding(id, { note: 'spruce canopy' })
    expect(useAppStore.getState().keywordBindings[0].note).toBe('spruce canopy')
    useAppStore.getState().deleteKeywordBinding(id)
    expect(useAppStore.getState().keywordBindings).toHaveLength(0)
  })

  it('creates, updates, and deletes a curated drop', () => {
    const id = useAppStore.getState().createCuratedDrop({
      title: 'Banff',
      description: 'Rockies.',
      date: '2026-07-13',
      gradients: [],
    })
    expect(useAppStore.getState().curatedDrops).toHaveLength(1)
    useAppStore.getState().updateCuratedDrop(id, { title: 'Banff NP' })
    expect(useAppStore.getState().curatedDrops[0].title).toBe('Banff NP')
    useAppStore.getState().deleteCuratedDrop(id)
    expect(useAppStore.getState().curatedDrops).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/store/useAppStore.test.ts`
Expected: FAIL — `addKeywordBinding is not a function`.

- [ ] **Step 3: Add types to the `AppState` interface**

In `src/store/useAppStore.ts`, add the import for the new types to the existing `import type { ... } from './types'` line (it already imports `Collection`, `CollectionLevers`): add `KeywordBinding, CuratedDrop`.

Then add to the `AppState` interface, right after `setCollectionLevers` (line ~61):

```ts
  keywordBindings: KeywordBinding[]
  curatedDrops: CuratedDrop[]
  addKeywordBinding: (binding: Omit<KeywordBinding, 'id'>) => string
  updateKeywordBinding: (id: string, patch: Partial<Omit<KeywordBinding, 'id'>>) => void
  deleteKeywordBinding: (id: string) => void
  createCuratedDrop: (drop: Omit<CuratedDrop, 'id'>) => string
  updateCuratedDrop: (id: string, patch: Partial<Omit<CuratedDrop, 'id'>>) => void
  deleteCuratedDrop: (id: string) => void
```

- [ ] **Step 4: Implement state + actions in the `create()` body**

Add to the store body, right after the `setCollectionLevers` implementation (near line ~229, matching the collections block):

```ts
      keywordBindings: [],
      curatedDrops: [],
      addKeywordBinding: (binding) => {
        const id = crypto.randomUUID()
        set({ keywordBindings: [...get().keywordBindings, { id, ...binding }] })
        return id
      },
      updateKeywordBinding: (id, patch) => {
        set({
          keywordBindings: get().keywordBindings.map((b) =>
            b.id === id ? { ...b, ...patch } : b
          ),
        })
      },
      deleteKeywordBinding: (id) => {
        set({ keywordBindings: get().keywordBindings.filter((b) => b.id !== id) })
      },
      createCuratedDrop: (drop) => {
        const id = crypto.randomUUID()
        set({ curatedDrops: [...get().curatedDrops, { id, ...drop }] })
        return id
      },
      updateCuratedDrop: (id, patch) => {
        set({
          curatedDrops: get().curatedDrops.map((d) =>
            d.id === id ? { ...d, ...patch } : d
          ),
        })
      },
      deleteCuratedDrop: (id) => {
        set({ curatedDrops: get().curatedDrops.filter((d) => d.id !== id) })
      },
```

- [ ] **Step 5: Bump persist version to 4 and default the new arrays**

In the persist config, change `version: 3` to `version: 4`. In the `migrate` function's `state` type add `keywordBindings?: KeywordBinding[]` and `curatedDrops?: CuratedDrop[]`, and before `return state` add:

```ts
        // v4: keyword vocabulary + curated drops are new.
        if (!Array.isArray(state.keywordBindings)) state.keywordBindings = []
        if (!Array.isArray(state.curatedDrops)) state.curatedDrops = []
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/store/useAppStore.test.ts && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: store CRUD for keyword vocabulary + curated drops (v4 migration)"
```

---

### Task 3: `keywordCompose` — compose stops/gradient + reuse the aesthetic score

**Files:**
- Create: `src/lib/keywordCompose.ts`
- Test: `src/lib/keywordCompose.test.ts`

**Context:** `scorePalette(colors: Oklch[], weights?) => number` (0–100) lives in `src/lib/paletteScore.ts`. `hexToOklch(hex) => Oklch` lives in `src/lib/oklch.ts`. `GradientStop = { hex; position; label? }` and `GradientType` from `src/lib/gradient.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/keywordCompose.test.ts
import { describe, it, expect } from 'vitest'
import { composeStops, composeGradient, scoreComposition } from './keywordCompose'
import { scorePalette } from './paletteScore'
import { hexToOklch } from './oklch'
import type { KeywordBinding } from '../store/types'

const glacier: KeywordBinding = { id: 'g', keyword: 'glacier', colors: ['#005e6b', '#e3ecec'], shape: 'radial' }
const pine: KeywordBinding = { id: 'p', keyword: 'pine', colors: ['#142b1f', '#b3c4b8'] }

describe('composeStops', () => {
  it('concatenates colors in binding order, evenly spaced 0-100', () => {
    const stops = composeStops([glacier, pine])
    expect(stops.map((s) => s.hex)).toEqual(['#005e6b', '#e3ecec', '#142b1f', '#b3c4b8'])
    expect(stops.map((s) => s.position)).toEqual([0, 33, 67, 100])
  })

  it('reordering the bindings reorders the stops (word-matching sort drives it)', () => {
    const stops = composeStops([pine, glacier])
    expect(stops.map((s) => s.hex)).toEqual(['#142b1f', '#b3c4b8', '#005e6b', '#e3ecec'])
  })
})

describe('composeGradient', () => {
  it('uses the first binding shape, defaulting to linear', () => {
    expect(composeGradient([glacier, pine]).type).toBe('radial')
    expect(composeGradient([pine]).type).toBe('linear')
  })
})

describe('scoreComposition', () => {
  it('matches scorePalette on the equivalent OKLCH colors (reuse, not reimplementation)', () => {
    const bindings = [glacier, pine]
    const expected = scorePalette(
      composeStops(bindings).map((s) => hexToOklch(s.hex))
    )
    expect(scoreComposition(bindings)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/keywordCompose.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/keywordCompose.ts
import type { GradientStop, GradientType } from './gradient'
import type { Gradient, KeywordBinding } from '../store/types'
import { hexToOklch } from './oklch'
import { scorePalette } from './paletteScore'

/** Flatten the bindings' colors in order into evenly-spaced stops. Order is the
 * author's word-matching-sort arrangement. */
export function composeStops(bindings: KeywordBinding[]): GradientStop[] {
  const hexes = bindings.flatMap((b) => b.colors)
  const last = hexes.length - 1
  return hexes.map((hex, i) => ({
    hex,
    position: last <= 0 ? 0 : Math.round((i / last) * 100),
  }))
}

/** Build a gradient from the arranged bindings. Type comes from the first
 * binding's shape hint, else linear. */
export function composeGradient(bindings: KeywordBinding[], type?: GradientType): Gradient {
  return {
    id: crypto.randomUUID(),
    type: type ?? bindings[0]?.shape ?? 'linear',
    stops: composeStops(bindings),
  }
}

/** Aesthetic score (0-100) for the arrangement, reusing the existing palette
 * scorer verbatim so authored drops rank on the same axis as generated ones. */
export function scoreComposition(bindings: KeywordBinding[]): number {
  return scorePalette(composeStops(bindings).map((s) => hexToOklch(s.hex)))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/keywordCompose.test.ts && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/keywordCompose.ts src/lib/keywordCompose.test.ts
git commit -m "feat: keywordCompose - stops/gradient + reused aesthetic score"
```

---

### Task 4: `DropAuthor` — vocabulary panel

**Files:**
- Create: `src/components/DropAuthor.tsx`
- Create: `src/components/DropAuthor.module.css`
- Test: `src/components/DropAuthor.test.tsx`

**Context:** First region of the authoring UI. Reads/writes the store directly (`useAppStore`). Keep this task to the vocabulary panel only; compose (Task 5) and drop assembly (Task 6) extend the same component.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/DropAuthor.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { DropAuthor } from './DropAuthor'
import { useAppStore } from '../store/useAppStore'

describe('DropAuthor vocabulary', () => {
  beforeEach(() => {
    useAppStore.setState({ keywordBindings: [], curatedDrops: [] })
  })

  it('adds a keyword binding from the form', () => {
    render(<DropAuthor />)
    fireEvent.change(screen.getByTestId('kw-keyword'), { target: { value: 'glacier' } })
    fireEvent.change(screen.getByTestId('kw-colors'), { target: { value: '#005e6b, #e3ecec' } })
    fireEvent.click(screen.getByTestId('kw-add'))
    expect(useAppStore.getState().keywordBindings).toHaveLength(1)
    expect(screen.getByText('glacier')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/DropAuthor.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the vocabulary panel**

```tsx
// src/components/DropAuthor.tsx
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { GradientType } from '../lib/gradient'
import styles from './DropAuthor.module.css'

const SHAPES: GradientType[] = ['linear', 'radial', 'angular', 'square', 'fan']

function parseColors(raw: string): string[] {
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
}

export function DropAuthor() {
  const keywordBindings = useAppStore((s) => s.keywordBindings)
  const addKeywordBinding = useAppStore((s) => s.addKeywordBinding)
  const deleteKeywordBinding = useAppStore((s) => s.deleteKeywordBinding)

  const [keyword, setKeyword] = useState('')
  const [colorsRaw, setColorsRaw] = useState('')
  const [shape, setShape] = useState<GradientType>('linear')

  function add() {
    const colors = parseColors(colorsRaw)
    if (!keyword.trim() || colors.length === 0) return
    addKeywordBinding({ keyword: keyword.trim(), colors, shape })
    setKeyword('')
    setColorsRaw('')
  }

  return (
    <div className={styles.author} data-testid="drop-author">
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Vocabulary</h3>
        <div className={styles.form}>
          <input
            data-testid="kw-keyword"
            className={styles.input}
            placeholder="keyword (e.g. glacier)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <input
            data-testid="kw-colors"
            className={styles.input}
            placeholder="#005e6b, #e3ecec"
            value={colorsRaw}
            onChange={(e) => setColorsRaw(e.target.value)}
          />
          <select
            data-testid="kw-shape"
            className={styles.input}
            value={shape}
            onChange={(e) => setShape(e.target.value as GradientType)}
          >
            {SHAPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="button" data-testid="kw-add" className={styles.btn} onClick={add}>
            Add
          </button>
        </div>
        <ul className={styles.list}>
          {keywordBindings.map((b) => (
            <li key={b.id} className={styles.item}>
              <span className={styles.itemName}>{b.keyword}</span>
              <span className={styles.swatches}>
                {b.colors.map((c, i) => (
                  <span key={i} className={styles.swatch} style={{ background: c }} />
                ))}
              </span>
              <button
                type="button"
                aria-label={`Delete ${b.keyword}`}
                className={styles.del}
                onClick={() => deleteKeywordBinding(b.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Create the stylesheet**

```css
/* src/components/DropAuthor.module.css */
.author { display: flex; flex-direction: column; gap: 20px; padding: 8px 2px 24px; }
.panel { display: flex; flex-direction: column; gap: 10px; }
.panelTitle { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.85); margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
.form { display: flex; flex-wrap: wrap; gap: 8px; }
.input { flex: 1 1 140px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px 10px; color: #fff; font-size: 13px; font-family: var(--sans); }
.btn { background: rgba(255,255,255,0.95); color: #111; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 13px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.item { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 6px 10px; }
.itemName { font-size: 13px; color: #fff; flex: 0 0 auto; min-width: 90px; }
.swatches { display: flex; gap: 4px; flex: 1 1 auto; }
.swatch { width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); }
.del { background: transparent; border: none; color: rgba(255,255,255,0.5); font-size: 18px; cursor: pointer; line-height: 1; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/DropAuthor.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/DropAuthor.tsx src/components/DropAuthor.module.css src/components/DropAuthor.test.tsx
git commit -m "feat: DropAuthor vocabulary panel"
```

---

### Task 5: Compose — word-matching sort with live preview + aesthetic score

**Files:**
- Modify: `src/components/DropAuthor.tsx`
- Modify: `src/components/DropAuthor.module.css`
- Test: `src/components/DropAuthor.test.tsx`

**Context:** Add the compose region. The author toggles keywords into an ordered "match row" and reorders them; the gradient preview and score update live. Reuse `useDragReorder(items, onReorder)` from `src/hooks/useDragReorder.ts` for the drag sort, and expose testable up/down reorder buttons so the behavior is verifiable without simulating native DnD. `buildGradientCss` from `src/lib/gradient.ts`, `composeGradient`/`scoreComposition` from `src/lib/keywordCompose.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/DropAuthor.test.tsx`:

```tsx
describe('DropAuthor compose (word-matching sort)', () => {
  beforeEach(() => {
    useAppStore.setState({
      keywordBindings: [
        { id: 'g', keyword: 'glacier', colors: ['#005e6b', '#e3ecec'] },
        { id: 'p', keyword: 'pine', colors: ['#142b1f', '#b3c4b8'] },
      ],
      curatedDrops: [],
    })
  })

  it('adds keywords to the match row and shows an aesthetic score', () => {
    render(<DropAuthor />)
    fireEvent.click(screen.getByTestId('match-add-g'))
    fireEvent.click(screen.getByTestId('match-add-p'))
    expect(screen.getByTestId('compose-score')).toBeInTheDocument()
    // Two chips in the match row.
    expect(screen.getAllByTestId(/^match-chip-/)).toHaveLength(2)
  })

  it('reordering the match row changes the composed order', () => {
    render(<DropAuthor />)
    fireEvent.click(screen.getByTestId('match-add-g'))
    fireEvent.click(screen.getByTestId('match-add-p'))
    const before = screen.getAllByTestId(/^match-chip-/).map((c) => c.getAttribute('data-kw-id'))
    expect(before).toEqual(['g', 'p'])
    fireEvent.click(screen.getByTestId('match-down-g')) // move glacier after pine
    const after = screen.getAllByTestId(/^match-chip-/).map((c) => c.getAttribute('data-kw-id'))
    expect(after).toEqual(['p', 'g'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/DropAuthor.test.tsx`
Expected: FAIL — `match-add-g` not found.

- [ ] **Step 3: Extend `DropAuthor` with the compose region**

Add these imports at the top of `src/components/DropAuthor.tsx`:

```tsx
import { buildGradientCss } from '../lib/gradient'
import { composeGradient, scoreComposition } from '../lib/keywordCompose'
import type { KeywordBinding } from '../store/types'
```

Inside the component, after the vocabulary state, add the match-row state and helpers:

```tsx
  // Ordered ids the author has matched into the current composition.
  const [matchIds, setMatchIds] = useState<string[]>([])
  const byId = (id: string) => keywordBindings.find((b) => b.id === id)
  const matched: KeywordBinding[] = matchIds.map(byId).filter(Boolean) as KeywordBinding[]

  function addToMatch(id: string) {
    setMatchIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
  }
  function removeFromMatch(id: string) {
    setMatchIds((ids) => ids.filter((x) => x !== id))
  }
  function move(id: string, dir: 1 | -1) {
    setMatchIds((ids) => {
      const i = ids.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ids.length) return ids
      const next = [...ids]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const composedGradient = matched.length > 0 ? composeGradient(matched) : null
  const score = matched.length >= 2 ? Math.round(scoreComposition(matched)) : null
```

Then render the compose section after the vocabulary `<section>` (still inside the outer `<div>`):

```tsx
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Compose — match words to colors</h3>
        <div className={styles.pickRow}>
          {keywordBindings.map((b) => (
            <button
              key={b.id}
              type="button"
              data-testid={`match-add-${b.id}`}
              className={styles.pick}
              onClick={() => addToMatch(b.id)}
            >
              + {b.keyword}
            </button>
          ))}
        </div>
        <div className={styles.matchRow}>
          {matched.map((b) => (
            <div key={b.id} data-testid={`match-chip-${b.id}`} data-kw-id={b.id} className={styles.chip}>
              <button type="button" data-testid={`match-up-${b.id}`} className={styles.move} onClick={() => move(b.id, -1)} aria-label={`Move ${b.keyword} earlier`}>‹</button>
              <span className={styles.chipName}>{b.keyword}</span>
              <span className={styles.swatches}>
                {b.colors.map((c, i) => (
                  <span key={i} className={styles.swatch} style={{ background: c }} />
                ))}
              </span>
              <button type="button" data-testid={`match-down-${b.id}`} className={styles.move} onClick={() => move(b.id, 1)} aria-label={`Move ${b.keyword} later`}>›</button>
              <button type="button" className={styles.del} onClick={() => removeFromMatch(b.id)} aria-label={`Remove ${b.keyword}`}>×</button>
            </div>
          ))}
        </div>
        {composedGradient && (
          <div
            data-testid="compose-preview"
            className={styles.preview}
            style={{ backgroundImage: buildGradientCss(composedGradient.type, composedGradient.stops, false) }}
          />
        )}
        {score !== null && (
          <div data-testid="compose-score" className={styles.score}>Aesthetic score: {score}/100</div>
        )}
      </section>
```

- [ ] **Step 4: Add compose styles**

Append to `src/components/DropAuthor.module.css`:

```css
.pickRow { display: flex; flex-wrap: wrap; gap: 6px; }
.pick { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; padding: 5px 12px; color: #fff; font-size: 12px; cursor: pointer; }
.matchRow { display: flex; flex-wrap: wrap; gap: 8px; min-height: 8px; }
.chip { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 4px 8px; }
.chipName { font-size: 12px; color: #fff; }
.move { background: transparent; border: none; color: rgba(255,255,255,0.6); font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; }
.preview { height: 120px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); }
.score { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/DropAuthor.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/DropAuthor.tsx src/components/DropAuthor.module.css src/components/DropAuthor.test.tsx
git commit -m "feat: DropAuthor word-matching sort compose with live score"
```

---

### Task 6: Assemble + save the drop, and render saved drops under Daily Drops

**Files:**
- Modify: `src/components/DropAuthor.tsx`
- Modify: `src/components/DropAuthor.module.css`
- Test: `src/components/DropAuthor.test.tsx`
- Modify: `src/components/Gallery.tsx`

**Context:** Finish the loop: "Add to drop" collects composed gradients; a title + description + today's date + "Save drop" writes a `CuratedDrop`. Then mount `DropAuthor` behind an "Author" toggle in the Daily Drops (feed) segment, and list saved drops minimally.

- [ ] **Step 1: Write the failing test**

Append to `src/components/DropAuthor.test.tsx`:

```tsx
describe('DropAuthor drop assembly', () => {
  beforeEach(() => {
    useAppStore.setState({
      keywordBindings: [
        { id: 'g', keyword: 'glacier', colors: ['#005e6b', '#e3ecec'] },
        { id: 'p', keyword: 'pine', colors: ['#142b1f', '#b3c4b8'] },
      ],
      curatedDrops: [],
    })
  })

  it('adds a composed gradient then saves a curated drop to the store', () => {
    render(<DropAuthor />)
    fireEvent.click(screen.getByTestId('match-add-g'))
    fireEvent.click(screen.getByTestId('match-add-p'))
    fireEvent.click(screen.getByTestId('compose-add-to-drop'))
    fireEvent.change(screen.getByTestId('drop-title'), { target: { value: 'Banff' } })
    fireEvent.change(screen.getByTestId('drop-desc'), { target: { value: 'The Rockies.' } })
    fireEvent.click(screen.getByTestId('drop-save'))

    const drops = useAppStore.getState().curatedDrops
    expect(drops).toHaveLength(1)
    expect(drops[0].title).toBe('Banff')
    expect(drops[0].gradients).toHaveLength(1)
    expect(drops[0].gradients[0].stops.map((s) => s.hex)).toEqual(['#005e6b', '#e3ecec', '#142b1f', '#b3c4b8'])
    expect(drops[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/DropAuthor.test.tsx`
Expected: FAIL — `compose-add-to-drop` not found.

- [ ] **Step 3: Extend `DropAuthor` with drop assembly**

Add the `createCuratedDrop` selector near the other store selectors:

```tsx
  const createCuratedDrop = useAppStore((s) => s.createCuratedDrop)
```

Add drop state after the match state:

```tsx
  const [dropGradients, setDropGradients] = useState<ReturnType<typeof composeGradient>[]>([])
  const [dropTitle, setDropTitle] = useState('')
  const [dropDesc, setDropDesc] = useState('')

  function addToDrop() {
    if (!composedGradient) return
    setDropGradients((g) => [...g, composedGradient])
    setMatchIds([])
  }
  function saveDrop() {
    if (dropGradients.length === 0 || !dropTitle.trim()) return
    createCuratedDrop({
      title: dropTitle.trim(),
      description: dropDesc.trim(),
      date: new Date().toISOString().slice(0, 10),
      gradients: dropGradients,
    })
    setDropGradients([])
    setDropTitle('')
    setDropDesc('')
  }
```

Add an "Add to drop" button inside the compose section (right after the score line, still inside that `<section>`):

```tsx
        <button
          type="button"
          data-testid="compose-add-to-drop"
          className={styles.btn}
          disabled={!composedGradient}
          onClick={addToDrop}
        >
          Add to drop
        </button>
```

Add the drop section after the compose section:

```tsx
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Drop ({dropGradients.length})</h3>
        <div className={styles.dropStrip}>
          {dropGradients.map((g) => (
            <span
              key={g.id}
              className={styles.dropThumb}
              style={{ backgroundImage: buildGradientCss(g.type, g.stops, false) }}
            />
          ))}
        </div>
        <input data-testid="drop-title" className={styles.input} placeholder="title" value={dropTitle} onChange={(e) => setDropTitle(e.target.value)} />
        <textarea data-testid="drop-desc" className={styles.input} placeholder="short description" value={dropDesc} onChange={(e) => setDropDesc(e.target.value)} />
        <button type="button" data-testid="drop-save" className={styles.btn} disabled={dropGradients.length === 0 || !dropTitle.trim()} onClick={saveDrop}>
          Save drop
        </button>
      </section>
```

- [ ] **Step 4: Add drop styles**

Append to `src/components/DropAuthor.module.css`:

```css
.dropStrip { display: flex; flex-wrap: wrap; gap: 6px; min-height: 8px; }
.dropThumb { width: 44px; height: 44px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background-size: cover; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/DropAuthor.test.tsx && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS.

- [ ] **Step 6: Mount `DropAuthor` + minimal saved-drops list in the Daily Drops segment**

In `src/components/Gallery.tsx`: add `import { DropAuthor } from './DropAuthor'` with the other component imports. Add local state near the other `useState` calls in the `Gallery` component: `const [authoring, setAuthoring] = useState(false)`. Read drops from the store near the other selectors: `const curatedDrops = useAppStore((s) => s.curatedDrops)`.

Inside the `segment === 'feed'` branch (the block that renders `themeSelector`/`themeHero`, around `Gallery.tsx:640`), at the very top of that block add an Author toggle and, when authoring, render `DropAuthor` plus the saved-drops list instead of the legacy theme UI:

```tsx
          <button
            type="button"
            data-testid="drop-author-toggle"
            className={styles.chip}
            onClick={() => setAuthoring((v) => !v)}
          >
            {authoring ? 'Close author' : 'Author a drop'}
          </button>
          {authoring && (
            <>
              <DropAuthor />
              <div data-testid="curated-drops">
                {curatedDrops.map((d) => (
                  <article key={d.id} className={styles.themeHero} data-testid={`curated-drop-${d.id}`}>
                    <div className={styles.themeHeroBadge}>{d.date}</div>
                    <h3 className={styles.themeHeroTitle}>{d.title}</h3>
                    <p className={styles.themeHeroDescription}>{d.description}</p>
                    <div className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}>
                      {d.gradients.map((g) => (
                        <span
                          key={g.id}
                          className={styles.tilePreview}
                          style={{ backgroundImage: buildGradientCss(g.type, g.stops, false), aspectRatio: '4 / 5', display: 'block' }}
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
```

Guard the legacy theme UI so it hides while authoring: wrap the existing `themeSelector`/`themeHero`/grid JSX in `{!authoring && ( ... )}`. `buildGradientCss` is already imported in Gallery.tsx (used by `tileBackground`); if not, add it from `../lib/gradient`.

- [ ] **Step 7: Verify build + full suite**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: all pass, build clean.

- [ ] **Step 8: Browser verification**

Start the preview (`preview_start {name:"dev"}`), open the Gallery → Daily Drops, click "Author a drop". Add a keyword with colors, match two keywords, confirm the preview + score render, "Add to drop", set a title/description, "Save drop", and confirm the dated drop appears below. Screenshot it.

- [ ] **Step 9: Commit**

```bash
git add src/components/DropAuthor.tsx src/components/DropAuthor.module.css src/components/DropAuthor.test.tsx src/components/Gallery.tsx
git commit -m "feat: assemble + save curated drops, mount authoring under Daily Drops"
```

---

## Self-Review

**Spec coverage:**
- Data model (KeywordBinding, CuratedDrop) → Task 1. ✓
- Store CRUD + persist migration → Task 2. ✓
- Compose + reused aesthetic score → Task 3. ✓
- Word-matching sort (manual reorder, advisory live score) → Task 5. ✓
- Vocabulary authoring → Task 4. ✓
- Drop assembly + minimal render under Daily Drops → Task 6. ✓
- Out-of-scope (blog design, SEO/prerender, export) → not present. ✓

**Placeholder scan:** none — every code step carries real code and commands.

**Type consistency:** `KeywordBinding`/`CuratedDrop` fields (`keyword`, `colors`, `shape`, `note`; `title`, `description`, `date`, `gradients`) are used identically across Tasks 1–6. `addKeywordBinding`, `deleteKeywordBinding`, `createCuratedDrop`, `composeStops`, `composeGradient`, `scoreComposition` signatures match between definition and call sites. `composeGradient` returns `Gradient`; `dropGradients` is typed off its return.

**Note on reorder hook:** the plan implements the match-row reorder with explicit index-swap buttons (testable, no native DnD needed). `useDragReorder` can be layered on for pointer dragging as a follow-up without changing the data flow; not required for this slice's acceptance.
