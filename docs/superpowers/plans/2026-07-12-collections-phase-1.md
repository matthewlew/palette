# Collections (Phase 1: Boards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pinterest-style collections (boards) that group saved gradients in the Gallery, with a destination-aware Save that can target a collection — no generation changes yet.

**Architecture:** A new `Collection` type stored in the existing zustand `persist` store holds only gradient-id references (a collection is a labeled subset of `saved`, never a copy). The Gallery gains a Collections row above the All grid; the create feed's Save becomes destination-aware via `activeCollectionId`. Phase 2 (the seed-tray variant maker) builds on this data model.

**Tech Stack:** React + TypeScript, Zustand (`persist` middleware, localStorage), CSS Modules, Vitest + Testing Library. Run tests with `NODE_OPTIONS=--no-experimental-webstorage` (see `package.json` `test` script).

---

## File Structure

- `src/store/types.ts` — add the `Collection` interface (Modify).
- `src/store/useAppStore.ts` — add `collections`, `activeCollectionId`, actions, persistence + migration, and prune-on-delete (Modify).
- `src/store/useAppStore.test.ts` — collection action tests (Modify).
- `src/components/CollectionsRow.tsx` + `.module.css` — the board-covers row in the Gallery (Create).
- `src/components/CollectionsRow.test.tsx` — tests (Create).
- `src/components/Gallery.tsx` + `.module.css` — mount the row, add board detail view, drag-to-add (Modify).
- `src/components/SaveDestination.tsx` + `.module.css` — the destination chip + picker beside Save (Create).
- `src/components/SaveDestination.test.tsx` — tests (Create).
- `src/components/GradientPage.tsx` / `src/components/Feed.tsx` — render the destination chip next to the existing Save (Modify).

Conventions to follow (already in the repo): `data-testid` on interactive nodes; CSS Modules for layout, global `ghost-chip`/`ghost-pill` for button skins; store actions are thin and pure-ish; tests reset with `useAppStore.setState(useAppStore.getInitialState())`.

---

## Task 1: `Collection` type

**Files:**
- Modify: `src/store/types.ts`

- [ ] **Step 1: Add the interface**

Append to `src/store/types.ts`:

```ts
/** Bias levers for Phase 2's variant generator; stored now so a collection
 * carries its recipe. 0–100, 50 = neutral. Unused by Phase 1 UI. */
export interface CollectionLevers {
  temp: number
  depth: number
  char: number
}

/** A labeled subset of `saved` — Pinterest-style board. Holds gradient ids
 * only (never copies), so "All" always contains everything and removing from
 * a collection never deletes the gradient. */
export interface Collection {
  id: string
  name: string
  createdAt: number
  gradientIds: string[]
  levers: CollectionLevers
}

export const NEUTRAL_LEVERS: CollectionLevers = { temp: 50, depth: 50, char: 50 }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no usages yet).

- [ ] **Step 3: Commit**

```bash
git add src/store/types.ts
git commit -m "feat: add Collection type"
```

---

## Task 2: Store scaffolding + persistence migration

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/store/useAppStore.test.ts` (inside the top `describe('useAppStore', …)` block):

```ts
it('starts with no collections and no active collection', () => {
  const state = useAppStore.getState()
  expect(state.collections).toEqual([])
  expect(state.activeCollectionId).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "no collections"`
Expected: FAIL — `state.collections` is `undefined`.

- [ ] **Step 3: Add state + persistence**

In `src/store/useAppStore.ts`:

1. Extend the import: `import type { Gradient, ViewMode, Collection, CollectionLevers } from './types'` and `import { NEUTRAL_LEVERS } from './types'`.
2. In the `AppState` interface, add:

```ts
  collections: Collection[]
  activeCollectionId: string | null
  createCollection: (name?: string) => string
  renameCollection: (id: string, name: string) => void
  deleteCollection: (id: string) => void
  addToCollection: (collectionId: string, gradientId: string) => void
  removeFromCollection: (collectionId: string, gradientId: string) => void
  setActiveCollection: (id: string | null) => void
  setCollectionLevers: (id: string, levers: CollectionLevers) => void
```

3. In the store body (near `saved: []`), add initial state:

```ts
      collections: [],
      activeCollectionId: null,
```

4. In `partialize`, add the two keys:

```ts
      partialize: (state) => ({
        saved: state.saved,
        noiseEnabled: state.noiseEnabled,
        galleryLayout: state.galleryLayout,
        collections: state.collections,
        activeCollectionId: state.activeCollectionId,
      }),
```

5. Bump `version: 2` → `version: 3` and extend `migrate` to default the new keys. Replace the `migrate` body's `return state` region so it reads:

```ts
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as {
          saved?: Gradient[]
          noiseEnabled?: boolean
          galleryLayout?: 'grid' | 'masonry'
          collections?: Collection[]
          activeCollectionId?: string | null
        }
        if (Array.isArray(state.saved)) {
          state.saved = state.saved.map((g) => {
            const { smoothEnabled: _s, flutedEnabled: _f, ...rest } = g as Gradient & {
              smoothEnabled?: boolean
              flutedEnabled?: boolean
            }
            return rest
          })
        }
        if (!state.galleryLayout || version < 2) {
          state.galleryLayout = 'masonry'
        }
        // v3: collections are new — default them for older persisted state.
        if (!Array.isArray(state.collections)) state.collections = []
        if (state.activeCollectionId === undefined) state.activeCollectionId = null
        return state
      },
```

(The action implementations land in Tasks 3–6; add the state now so this test passes. Reference `NEUTRAL_LEVERS` will be used there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "no collections"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/types.ts src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add collections state and v3 persistence migration"
```

---

## Task 3: create / rename / delete collection

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/store/useAppStore.test.ts`:

```ts
describe('collections CRUD', () => {
  it('creates a collection with a default name, neutral levers, and returns its id', () => {
    const id = useAppStore.getState().createCollection()
    const cols = useAppStore.getState().collections
    expect(cols).toHaveLength(1)
    expect(cols[0].id).toBe(id)
    expect(cols[0].name).toBe('New Collection')
    expect(cols[0].gradientIds).toEqual([])
    expect(cols[0].levers).toEqual({ temp: 50, depth: 50, char: 50 })
  })

  it('creates a collection with a provided name', () => {
    useAppStore.getState().createCollection('Kiln Studies')
    expect(useAppStore.getState().collections[0].name).toBe('Kiln Studies')
  })

  it('renames a collection (trimmed, ignores empty)', () => {
    const id = useAppStore.getState().createCollection()
    useAppStore.getState().renameCollection(id, '  Cool Porch  ')
    expect(useAppStore.getState().collections[0].name).toBe('Cool Porch')
    useAppStore.getState().renameCollection(id, '   ')
    expect(useAppStore.getState().collections[0].name).toBe('Cool Porch')
  })

  it('deletes a collection and clears it as active when it was active', () => {
    const id = useAppStore.getState().createCollection()
    useAppStore.getState().setActiveCollection(id)
    useAppStore.getState().deleteCollection(id)
    expect(useAppStore.getState().collections).toEqual([])
    expect(useAppStore.getState().activeCollectionId).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "collections CRUD"`
Expected: FAIL — `createCollection is not a function`.

- [ ] **Step 3: Implement the actions**

Add these to the store body (after the `redoDelete` block is fine):

```ts
      createCollection: (name) => {
        const id = crypto.randomUUID()
        const collection: Collection = {
          id,
          name: name?.trim() || 'New Collection',
          createdAt: Date.now(),
          gradientIds: [],
          levers: { ...NEUTRAL_LEVERS },
        }
        set({ collections: [...get().collections, collection] })
        return id
      },
      renameCollection: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set({
          collections: get().collections.map((c) =>
            c.id === id ? { ...c, name: trimmed } : c
          ),
        })
      },
      deleteCollection: (id) => {
        set({
          collections: get().collections.filter((c) => c.id !== id),
          activeCollectionId:
            get().activeCollectionId === id ? null : get().activeCollectionId,
        })
      },
```

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "collections CRUD"`
Expected: PASS (the `setActiveCollection` used in the delete test is implemented in Task 5; if running this task in isolation before Task 5, temporarily set `activeCollectionId` via `useAppStore.setState({ activeCollectionId: id })` in that test, then revert once Task 5 lands).

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: create/rename/delete collection actions"
```

---

## Task 4: add / remove gradient in a collection (with dedupe)

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('collection membership', () => {
  it('adds a gradient id once (no duplicates)', () => {
    const id = useAppStore.getState().createCollection()
    useAppStore.getState().addToCollection(id, 'g-abc')
    useAppStore.getState().addToCollection(id, 'g-abc')
    expect(useAppStore.getState().collections[0].gradientIds).toEqual(['g-abc'])
  })

  it('removes a gradient id from a collection', () => {
    const id = useAppStore.getState().createCollection()
    useAppStore.getState().addToCollection(id, 'g-abc')
    useAppStore.getState().addToCollection(id, 'g-def')
    useAppStore.getState().removeFromCollection(id, 'g-abc')
    expect(useAppStore.getState().collections[0].gradientIds).toEqual(['g-def'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "collection membership"`
Expected: FAIL — `addToCollection is not a function`.

- [ ] **Step 3: Implement**

```ts
      addToCollection: (collectionId, gradientId) => {
        set({
          collections: get().collections.map((c) =>
            c.id === collectionId && !c.gradientIds.includes(gradientId)
              ? { ...c, gradientIds: [...c.gradientIds, gradientId] }
              : c
          ),
        })
      },
      removeFromCollection: (collectionId, gradientId) => {
        set({
          collections: get().collections.map((c) =>
            c.id === collectionId
              ? { ...c, gradientIds: c.gradientIds.filter((gid) => gid !== gradientId) }
              : c
          ),
        })
      },
```

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "collection membership"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add/remove gradient in collection"
```

---

## Task 5: setActiveCollection + setCollectionLevers

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('active collection + levers', () => {
  it('sets and clears the active collection', () => {
    const id = useAppStore.getState().createCollection()
    useAppStore.getState().setActiveCollection(id)
    expect(useAppStore.getState().activeCollectionId).toBe(id)
    useAppStore.getState().setActiveCollection(null)
    expect(useAppStore.getState().activeCollectionId).toBeNull()
  })

  it('updates a collection\'s levers', () => {
    const id = useAppStore.getState().createCollection()
    useAppStore.getState().setCollectionLevers(id, { temp: 20, depth: 80, char: 65 })
    expect(useAppStore.getState().collections[0].levers).toEqual({ temp: 20, depth: 80, char: 65 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "active collection"`
Expected: FAIL — `setActiveCollection is not a function`.

- [ ] **Step 3: Implement**

```ts
      setActiveCollection: (id) => set({ activeCollectionId: id }),
      setCollectionLevers: (id, levers) => {
        set({
          collections: get().collections.map((c) =>
            c.id === id ? { ...c, levers } : c
          ),
        })
      },
```

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "active collection"`
Expected: PASS. (Re-run the Task 3 delete test too; it now passes as written.)

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: active-collection and collection-levers actions"
```

---

## Task 6: prune collection membership when a saved gradient is deleted

**Files:**
- Modify: `src/store/useAppStore.ts:removeSavedGradientById`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('prunes a deleted gradient id from every collection', () => {
  const store = useAppStore.getState()
  store.saveGradient({ id: 'seed', type: 'linear', stops: [
    { hex: '#111111', position: 0 }, { hex: '#eeeeee', position: 100 },
  ] })
  const savedId = useAppStore.getState().saved[0].id
  const cid = store.createCollection('Board')
  store.addToCollection(cid, savedId)
  useAppStore.getState().removeSavedGradientById(savedId)
  expect(useAppStore.getState().collections[0].gradientIds).toEqual([])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "prunes a deleted"`
Expected: FAIL — the id remains in the collection.

- [ ] **Step 3: Implement**

In `removeSavedGradientById`, extend the `set({ … })` call to also prune collections:

```ts
      removeSavedGradientById: (id) => {
        const saved = get().saved
        const index = saved.findIndex((g) => g.id === id)
        if (index === -1) return
        set({
          saved: saved.filter((g) => g.id !== id),
          collections: get().collections.map((c) =>
            c.gradientIds.includes(id)
              ? { ...c, gradientIds: c.gradientIds.filter((gid) => gid !== id) }
              : c
          ),
          lastDeleted: { gradient: saved[index], index },
          lastUndone: null,
        })
      },
```

(Undo restores the gradient into `saved` but not its old collection memberships — acceptable for Phase 1; note for future.)

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts -t "prunes a deleted"`
Expected: PASS.

- [ ] **Step 5: Full store suite + commit**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/store/useAppStore.test.ts`
Expected: PASS (all).

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: prune deleted gradient ids from collections"
```

---

## Task 7: CollectionsRow component

**Files:**
- Create: `src/components/CollectionsRow.tsx`
- Create: `src/components/CollectionsRow.module.css`
- Test: `src/components/CollectionsRow.test.tsx`

Renders a horizontal row of board covers (newest gradient in each collection as the cover), each with a member count, plus a "New" tile. Cover click calls `onOpen(id)`; New calls `onCreate()`. Presentational — it takes data + callbacks, no store access, so it's trivially testable.

- [ ] **Step 1: Write the failing test**

`src/components/CollectionsRow.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CollectionsRow } from './CollectionsRow'
import type { Collection } from '../store/types'
import type { Gradient } from '../store/types'

const grad = (id: string): Gradient => ({
  id, type: 'linear',
  stops: [{ hex: '#b5643c', position: 0 }, { hex: '#3a5a78', position: 100 }],
})
const col = (id: string, name: string, ids: string[]): Collection => ({
  id, name, createdAt: 0, gradientIds: ids, levers: { temp: 50, depth: 50, char: 50 },
})

describe('CollectionsRow', () => {
  it('renders a cover per collection with its member count and name', () => {
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', ['g1', 'g2'])]}
        gradientsById={{ g1: grad('g1'), g2: grad('g2') }}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByText('Kiln')).toBeInTheDocument()
    expect(screen.getByTestId('collection-count-c1')).toHaveTextContent('2')
  })

  it('calls onOpen with the id when a cover is clicked', () => {
    const onOpen = vi.fn()
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', ['g1'])]}
        gradientsById={{ g1: grad('g1') }}
        onOpen={onOpen} onCreate={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('collection-cover-c1'))
    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('calls onCreate when the New tile is clicked', () => {
    const onCreate = vi.fn()
    render(
      <CollectionsRow collections={[]} gradientsById={{}} onOpen={vi.fn()} onCreate={onCreate} />
    )
    fireEvent.click(screen.getByTestId('collection-new'))
    expect(onCreate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/CollectionsRow.test.tsx`
Expected: FAIL — cannot resolve `./CollectionsRow`.

- [ ] **Step 3: Implement the component**

`src/components/CollectionsRow.tsx`:

```tsx
import type { Collection, Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import styles from './CollectionsRow.module.css'

interface CollectionsRowProps {
  collections: Collection[]
  /** Lookup so a cover can render the collection's newest member. */
  gradientsById: Record<string, Gradient>
  onOpen: (id: string) => void
  onCreate: () => void
}

function coverStyle(collection: Collection, byId: Record<string, Gradient>) {
  const lastId = collection.gradientIds[collection.gradientIds.length - 1]
  const g = lastId ? byId[lastId] : undefined
  if (!g) return undefined
  return {
    backgroundImage: buildGradientCss(g.type, g.stops, g.reversed, {
      repeat: g.repeatEnabled,
      hard: g.hardStops,
      fanAnchor: g.fanAnchor,
    }),
  }
}

export function CollectionsRow({ collections, gradientsById, onOpen, onCreate }: CollectionsRowProps) {
  return (
    <div className={styles.row} data-testid="collections-row">
      {collections.map((c) => (
        <button
          key={c.id}
          type="button"
          data-testid={`collection-cover-${c.id}`}
          className={styles.cover}
          style={coverStyle(c, gradientsById)}
          onClick={() => onOpen(c.id)}
        >
          <span data-testid={`collection-count-${c.id}`} className={styles.count}>
            {c.gradientIds.length}
          </span>
          <span className={styles.name}>{c.name}</span>
        </button>
      ))}
      <button type="button" data-testid="collection-new" className={styles.newTile} onClick={onCreate}>
        + New
      </button>
    </div>
  )
}
```

`src/components/CollectionsRow.module.css`:

```css
.row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 2px 10px;
  scrollbar-width: none;
}
.row::-webkit-scrollbar { display: none; }

.cover {
  position: relative;
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background-color: #26262c;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
}
.count {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  padding: 1px 5px;
}
.name {
  position: absolute;
  left: 6px;
  bottom: 4px;
  right: 26px;
  font-size: 10px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.newTile {
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.28);
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/CollectionsRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CollectionsRow.tsx src/components/CollectionsRow.module.css src/components/CollectionsRow.test.tsx
git commit -m "feat: CollectionsRow board covers component"
```

---

## Task 8: Mount CollectionsRow in the Gallery + board detail view

**Files:**
- Modify: `src/components/Gallery.tsx`
- Modify: `src/components/Gallery.module.css`
- Test: `src/components/Gallery.test.tsx`

Add a `collectionView` local state to `Gallery` (`string | null`). When null, render the Collections row (from the store) above the existing All grid. When set, render only that collection's member gradients (filtered from `saved` by `gradientIds`) plus a back control and an "Open in feed" button that calls `setActiveCollection(id)` + `setMode('create')`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/Gallery.test.tsx` (follow the file's existing render helper / store setup):

```tsx
it('shows a Collections row and opens a board detail view', () => {
  const store = useAppStore.getState()
  store.saveGradient({ id: 's1', type: 'linear', stops: [
    { hex: '#b5643c', position: 0 }, { hex: '#3a5a78', position: 100 } ] })
  const savedId = useAppStore.getState().saved[0].id
  const cid = store.createCollection('Kiln')
  store.addToCollection(cid, savedId)

  render(<Gallery onRiff={vi.fn()} />)
  expect(screen.getByTestId('collections-row')).toBeInTheDocument()

  fireEvent.click(screen.getByTestId(`collection-cover-${cid}`))
  // Board detail view shows an Open-in-feed action.
  expect(screen.getByTestId('collection-open-in-feed')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/Gallery.test.tsx -t "Collections row"`
Expected: FAIL — no `collections-row`.

- [ ] **Step 3: Implement**

In `src/components/Gallery.tsx`:

1. Pull the new store bits:

```tsx
  const collections = useAppStore((s) => s.collections)
  const createCollection = useAppStore((s) => s.createCollection)
  const setActiveCollection = useAppStore((s) => s.setActiveCollection)
  const addToCollection = useAppStore((s) => s.addToCollection)
  const removeFromCollection = useAppStore((s) => s.removeFromCollection)
```

2. Add local state: `const [collectionView, setCollectionView] = useState<string | null>(null)`.

3. Build a lookup once per render:

```tsx
  const gradientsById = Object.fromEntries(saved.map((g) => [g.id, g])) as Record<string, Gradient>
```

4. Import and render the row above the All grid (in the non-empty branch, before `<div className={styles.chips}>`):

```tsx
  <CollectionsRow
    collections={collections}
    gradientsById={gradientsById}
    onOpen={(id) => setCollectionView(id)}
    onCreate={() => setCollectionView(createCollection())}
  />
```

5. When `collectionView` is set, render the board detail instead of the chips+grid. Compute members and render a header with a back button and Open-in-feed:

```tsx
  const activeCol = collections.find((c) => c.id === collectionView) ?? null
  const members = activeCol
    ? activeCol.gradientIds.map((id) => gradientsById[id]).filter(Boolean)
    : []
```

Detail markup (rendered when `activeCol`):

```tsx
  <div data-testid="collection-detail">
    <div className={styles.header}>
      <button type="button" className={styles.emptyAction} onClick={() => setCollectionView(null)}>← Collections</button>
      <h2 className={styles.title}>{activeCol.name} <span className={styles.titleCount}>({members.length})</span></h2>
      <button
        type="button"
        data-testid="collection-open-in-feed"
        className={styles.emptyAction}
        onClick={() => { setActiveCollection(activeCol.id); setMode('create') }}
      >
        Open in feed
      </button>
    </div>
    <div className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}>
      {members.map((g) => (
        <Tile
          key={g.id}
          gradient={g}
          galleryLayout={galleryLayout}
          enterDelayMs={0}
          onOpen={setOpen}
          onRiff={onRiff}
          onDelete={(id) => removeFromCollection(activeCol.id, id)}
        />
      ))}
    </div>
  </div>
```

Note: reuse the existing `Tile` component; in the detail view its "Delete" hover action means "remove from this collection" (`removeFromCollection`), NOT a global delete. Keep the All-grid `Tile` wired to the existing global delete path unchanged.

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/Gallery.test.tsx`
Expected: PASS (new test + existing Gallery tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Gallery.tsx src/components/Gallery.module.css src/components/Gallery.test.tsx
git commit -m "feat: Collections row + board detail view in Gallery"
```

---

## Task 9: Drag a Gallery tile onto a board cover to add it

**Files:**
- Modify: `src/components/CollectionsRow.tsx` (+ `.module.css`)
- Modify: `src/components/Gallery.tsx` (make All-grid tiles draggable)
- Test: `src/components/CollectionsRow.test.tsx`

Use native HTML5 drag-and-drop (no new deps). The All-grid `Tile` wrapper sets `draggable` and `dataTransfer` with the gradient id; a cover accepts `onDragOver`/`onDrop` and calls `onDropGradient(collectionId, gradientId)`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/CollectionsRow.test.tsx`:

```tsx
it('calls onDropGradient when a gradient id is dropped on a cover', () => {
  const onDropGradient = vi.fn()
  render(
    <CollectionsRow
      collections={[col('c1', 'Kiln', [])]}
      gradientsById={{}}
      onOpen={vi.fn()} onCreate={vi.fn()}
      onDropGradient={onDropGradient}
    />
  )
  const cover = screen.getByTestId('collection-cover-c1')
  const dataTransfer = { getData: () => 'g-xyz' }
  fireEvent.drop(cover, { dataTransfer })
  expect(onDropGradient).toHaveBeenCalledWith('c1', 'g-xyz')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/CollectionsRow.test.tsx -t "onDropGradient"`
Expected: FAIL — prop not wired.

- [ ] **Step 3: Implement**

In `CollectionsRow.tsx`, extend props with `onDropGradient?: (collectionId: string, gradientId: string) => void` and on each `.cover` button add:

```tsx
  onDragOver={(e) => { if (onDropGradient) e.preventDefault() }}
  onDrop={(e) => {
    if (!onDropGradient) return
    e.preventDefault()
    const gradientId = e.dataTransfer.getData('text/plain') || (e.dataTransfer as unknown as { getData: (t: string) => string }).getData('')
    if (gradientId) onDropGradient(c.id, gradientId)
  }}
```

(The test passes a stub `getData` returning the id regardless of type key; the `|| …getData('')` fallback keeps it robust in jsdom.)

In `Gallery.tsx`, on the All-grid `Tile`'s outer element add drag source behavior. Since `Tile` is a local component, add an optional `draggable`/`onDragStart` there: extend `Tile` to accept `onDragStartId?: (id: string) => void` and set on its root div:

```tsx
  draggable={!!onDragStartId}
  onDragStart={(e) => { e.dataTransfer.setData('text/plain', gradient.id); onDragStartId?.(gradient.id) }}
```

Wire the All-grid tiles with `onDragStartId={() => {}}` (presence enables `draggable`), and pass `onDropGradient={addToCollection}` to `CollectionsRow`.

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/CollectionsRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CollectionsRow.tsx src/components/CollectionsRow.module.css src/components/Gallery.tsx src/components/CollectionsRow.test.tsx
git commit -m "feat: drag gallery tile onto board cover to add to collection"
```

---

## Task 10: Destination-aware Save in the create feed

**Files:**
- Create: `src/components/SaveDestination.tsx`
- Create: `src/components/SaveDestination.module.css`
- Test: `src/components/SaveDestination.test.tsx`
- Modify: `src/components/GradientPage.tsx` (render the chip next to `LikeButton`)

A small chip beside the existing Save pill showing the active collection name (or "Gallery"). Tapping opens a menu to pick a collection, choose "Gallery only" (`setActiveCollection(null)`), or "+ New collection". It's presentational + callbacks; the wiring reads/writes the store from `GradientPage`.

- [ ] **Step 1: Write the failing test**

`src/components/SaveDestination.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SaveDestination } from './SaveDestination'
import type { Collection } from '../store/types'

const col = (id: string, name: string): Collection => ({
  id, name, createdAt: 0, gradientIds: [], levers: { temp: 50, depth: 50, char: 50 },
})

describe('SaveDestination', () => {
  it('labels the chip "Gallery" when no collection is active', () => {
    render(<SaveDestination collections={[]} activeId={null} onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByTestId('save-destination')).toHaveTextContent('Gallery')
  })

  it('labels the chip with the active collection name', () => {
    render(<SaveDestination collections={[col('c1', 'Kiln')]} activeId="c1" onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByTestId('save-destination')).toHaveTextContent('Kiln')
  })

  it('selects a collection from the menu', () => {
    const onSelect = vi.fn()
    render(<SaveDestination collections={[col('c1', 'Kiln')]} activeId={null} onSelect={onSelect} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByTestId('save-destination'))
    fireEvent.click(screen.getByTestId('save-destination-option-c1'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('selects Gallery-only (null) from the menu', () => {
    const onSelect = vi.fn()
    render(<SaveDestination collections={[col('c1', 'Kiln')]} activeId="c1" onSelect={onSelect} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByTestId('save-destination'))
    fireEvent.click(screen.getByTestId('save-destination-gallery'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/SaveDestination.test.tsx`
Expected: FAIL — cannot resolve `./SaveDestination`.

- [ ] **Step 3: Implement**

`src/components/SaveDestination.tsx`:

```tsx
import { useState } from 'react'
import type { Collection } from '../store/types'
import styles from './SaveDestination.module.css'

interface SaveDestinationProps {
  collections: Collection[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  color?: string
}

export function SaveDestination({ collections, activeId, onSelect, onCreate, color }: SaveDestinationProps) {
  const [open, setOpen] = useState(false)
  const active = collections.find((c) => c.id === activeId) ?? null
  const label = active ? active.name : 'Gallery'
  return (
    <div className={styles.wrap} style={color ? { color } : undefined}>
      {open && (
        <div className={styles.menu} role="menu">
          <button type="button" data-testid="save-destination-gallery"
            className={styles.item} onClick={() => { onSelect(null); setOpen(false) }}>
            Gallery only
          </button>
          {collections.map((c) => (
            <button key={c.id} type="button" data-testid={`save-destination-option-${c.id}`}
              className={styles.item} onClick={() => { onSelect(c.id); setOpen(false) }}>
              {c.name}
            </button>
          ))}
          <button type="button" data-testid="save-destination-new"
            className={styles.item} onClick={() => { onCreate(); setOpen(false) }}>
            + New collection
          </button>
        </div>
      )}
      <button type="button" data-testid="save-destination"
        className={`${styles.chip} ghost-chip ghost-pill`}
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        ◳ {label} ▾
      </button>
    </div>
  )
}
```

`src/components/SaveDestination.module.css`:

```css
.wrap {
  position: absolute;
  bottom: calc(16px + env(safe-area-inset-bottom));
  right: 96px;
  z-index: 3;
}
.chip {
  height: 44px;
  font-size: 12px;
  white-space: nowrap;
}
.menu {
  position: absolute;
  bottom: 52px;
  right: 0;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border-radius: 12px;
  background: rgba(20, 20, 24, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.item {
  text-align: left;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
}
.item:hover { background: rgba(255, 255, 255, 0.1); }
```

- [ ] **Step 4: Run to verify pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/SaveDestination.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into GradientPage**

In `src/components/GradientPage.tsx`, read the store and render `SaveDestination` next to `LikeButton`. Add near the other `useAppStore` selectors:

```tsx
  const collections = useAppStore((s) => s.collections)
  const activeCollectionId = useAppStore((s) => s.activeCollectionId)
  const setActiveCollection = useAppStore((s) => s.setActiveCollection)
  const createCollection = useAppStore((s) => s.createCollection)
  const addToCollection = useAppStore((s) => s.addToCollection)
  const saved = useAppStore((s) => s.saved)
```

Change the like/save handler so that when a collection is active, after saving, the saved gradient is added to it. Replace the `onToggleLike` passed down / the `LikeButton` `onToggle` so it runs:

```tsx
  function handleSave() {
    onToggleLike() // existing save-to-gallery toggle
    if (activeCollectionId) {
      // saveGradient stores a fresh-id copy; find it by being the newest save.
      const newest = useAppStore.getState().saved[useAppStore.getState().saved.length - 1]
      if (newest) addToCollection(activeCollectionId, newest.id)
    }
  }
```

Render the chip (only meaningful in the create feed, where `chromeVisible` is used) just before `<LikeButton …>`:

```tsx
  {chromeVisible && (
    <SaveDestination
      collections={collections}
      activeId={activeCollectionId}
      onSelect={setActiveCollection}
      onCreate={() => setActiveCollection(createCollection())}
      color={cornerColor}
    />
  )}
```

and switch `LikeButton`'s `onToggle={onToggleLike}` to `onToggle={handleSave}`.

- [ ] **Step 6: Verify + typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/GradientPage.test.tsx src/components/SaveDestination.test.tsx`
Expected: PASS.

```bash
git add src/components/SaveDestination.tsx src/components/SaveDestination.module.css src/components/SaveDestination.test.tsx src/components/GradientPage.tsx
git commit -m "feat: destination-aware Save chip in create feed"
```

---

## Task 11: Full suite + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke (browser preview)**

Start the dev server preview and confirm, in the mobile viewport:
1. Gallery shows a Collections row; "+ New" creates a board and opens its (empty) detail view.
2. Dragging an All-grid tile onto a board cover increments its count.
3. In a board detail, the tile "Delete" hover action removes it from the board only (still present in All).
4. "Open in feed" switches to the create feed with that collection active; the Save chip reads the collection name; Save adds the gradient to both All and the collection.
5. Reload the page — collections and membership persist.

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "test: verify collections phase 1 end to end"
```

---

## Notes for Phase 2 (not in this plan)

- `src/lib/variantGen.ts` (pool-from-gradients + `leverWeight` port of Bklyn Clay's `scoreGlaze`), the seed-tray filmstrip (bottom mobile / left desktop), the three lever sliders bound to `setCollectionLevers`, and `Feed` calling `generateVariant(activeCollection)` with an empty-pool fallback to today's behavior. The data model, `activeCollectionId`, and `levers` are already in place from this phase.
