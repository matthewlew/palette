# Gradient Copy & Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users copy the focused gradient with Cmd/Ctrl+C (as Palette JSON + a Figma-usable SVG) and paste with Cmd/Ctrl+V, auto-adding to the Gallery with an undo toast — replacing the old import banner.

**Architecture:** Native document `copy`/`paste` listeners in `App.tsx` write/read a multi-format clipboard via small pure helpers (`lib/gradientSvg.ts`, `lib/clipboard.ts`). Imports (paste, share-link, JSON textarea) all funnel through one store action `importGradients` that records added ids so `undoImport` can reverse exactly them. A reusable `UndoToast` surfaces confirmation + Undo app-wide.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + @testing-library/react, Vanilla CSS modules.

---

## File Structure

- **Create** `src/lib/gradientSvg.ts` — `gradientToSvg(gradient, size?)`: pure SVG string builder.
- **Create** `src/lib/gradientSvg.test.ts` — unit tests for the builder.
- **Create** `src/lib/clipboard.ts` — `writeGradientToClipboard(e, gradient)` / `readGradientsFromClipboard(e)`.
- **Create** `src/lib/clipboard.test.ts` — unit tests using synthetic `ClipboardEvent`-like objects.
- **Create** `src/components/UndoToast.tsx` — small toast with text + Undo action.
- **Create** `src/components/UndoToast.module.css` — styling (mirrors Gallery's undo toast).
- **Create** `src/components/UndoToast.test.tsx` — render/interaction tests.
- **Modify** `src/store/useAppStore.ts` — add `importGradients`, `lastImported`, `undoImport`, `viewerGradient`, `setViewerGradient`; remove `pendingImport`/`setPendingImport`/`confirmImport`/`dismissImport`.
- **Modify** `src/App.tsx` — global copy/paste listeners, import routing, copy + import toasts; remove `ImportBanner`.
- **Modify** `src/App.test.tsx` — replace banner-based import tests with auto-add + paste tests.
- **Modify** `src/components/Gallery.tsx` — set/clear `viewerGradient` when the Viewer opens/closes.
- **Delete** `src/components/ImportBanner.tsx`, `ImportBanner.module.css`, `ImportBanner.test.tsx`.

Reference (do not modify): `src/lib/gradientCodec.ts` (`fromImportJson`, `importGradient`, `toExportJson`, `toSharePayloadGradient`, `decodeFromFragment`), `src/lib/gradient.ts` (`buildGradientCss`, `positionedStops`, `repeatedStops`, `hardenStops`, `GradientType`), `src/store/types.ts` (`Gradient`).

---

## Task 1: SVG builder (`gradientToSvg`)

**Files:**
- Create: `src/lib/gradientSvg.ts`
- Test: `src/lib/gradientSvg.test.ts`

Notes on mapping (from spec): `linear`/`mirror`/`repeat` → `<linearGradient>` top-to-bottom (x1=0,y1=0,x2=0,y2=1 to match the app's 180deg); `radial` → `<radialGradient>` centered circle; `angular`/`square`/`fan` (conic) → linear approximation of the stop sequence (SVG has no conic). Honor `reversed` by reversing the effective stop list. Keep it simple: use the gradient's own `stops` (already carry `position` 0–100) as the SVG offsets; do NOT re-run repeat/mirror geometry (YAGNI — the visible stops are a faithful-enough vector for Figma).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/gradientSvg.test.ts
import { describe, it, expect } from 'vitest'
import { gradientToSvg } from './gradientSvg'
import type { Gradient } from '../store/types'

function grad(overrides: Partial<Gradient> = {}): Gradient {
  return {
    id: 'x',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
    ...overrides,
  }
}

describe('gradientToSvg', () => {
  it('emits a standalone svg with an xmlns and a rect fill referencing the gradient', () => {
    const svg = gradientToSvg(grad())
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(svg).toContain('<rect')
    expect(svg).toMatch(/fill="url\(#[^)]+\)"/)
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('uses a linearGradient with vertical coordinates for linear', () => {
    const svg = gradientToSvg(grad({ type: 'linear' }))
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('x1="0"')
    expect(svg).toContain('y1="0"')
    expect(svg).toContain('x2="0"')
    expect(svg).toContain('y2="1"')
    expect(svg).toContain('stop-color="#ff0000"')
    expect(svg).toContain('offset="0%"')
    expect(svg).toContain('offset="100%"')
  })

  it('uses a radialGradient for radial', () => {
    const svg = gradientToSvg(grad({ type: 'radial' }))
    expect(svg).toContain('<radialGradient')
  })

  it('falls back to a linearGradient for conic types (angular/square/fan)', () => {
    for (const type of ['angular', 'square', 'fan'] as const) {
      const svg = gradientToSvg(grad({ type }))
      expect(svg).toContain('<linearGradient')
      expect(svg).not.toContain('<radialGradient')
    }
  })

  it('reverses stop order when reversed is set', () => {
    const svg = gradientToSvg(grad({ reversed: true }))
    // First rendered stop should now be the blue (originally last)
    const firstStopIdx = svg.indexOf('stop-color="#0000ff"')
    const secondStopIdx = svg.indexOf('stop-color="#ff0000"')
    expect(firstStopIdx).toBeGreaterThan(-1)
    expect(firstStopIdx).toBeLessThan(secondStopIdx)
  })

  it('never throws for any gradient type', () => {
    for (const type of ['linear', 'radial', 'angular', 'square', 'mirror', 'repeat', 'fan'] as const) {
      expect(() => gradientToSvg(grad({ type }))).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/gradientSvg.test.ts`
Expected: FAIL — "gradientToSvg is not a function" / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/gradientSvg.ts
import type { Gradient } from '../store/types'
import type { GradientStop, GradientType } from './gradient'

const RADIAL_TYPES: ReadonlySet<GradientType> = new Set(['radial'])

/** Escape a hex color for safe interpolation into SVG attributes. Hex is
 * already validated upstream (isHexColor in gradientCodec), so this is a
 * belt-and-braces guard against stray quotes. */
function safeHex(hex: string): string {
  return hex.replace(/[^#0-9a-fA-F]/g, '')
}

function stopEls(stops: GradientStop[], reversed: boolean): string {
  const ordered = reversed ? [...stops].reverse() : stops
  return ordered
    .map((s, i) => {
      // When reversed, positions run backwards; remap to a monotonic 0..100
      // so the SVG offsets stay ascending.
      const offset = reversed ? (i / Math.max(1, ordered.length - 1)) * 100 : s.position
      return `<stop offset="${offset}%" stop-color="${safeHex(s.hex)}"/>`
    })
    .join('')
}

/** Build a standalone SVG string with a real gradient fill so pasting into
 * Figma/Illustrator yields a vector rectangle. linear/mirror/repeat render as
 * a vertical linear gradient (matching the app's 180deg); radial as a centered
 * circle; conic types (angular/square/fan) fall back to a linear approximation
 * since SVG has no native conic gradient. */
export function gradientToSvg(gradient: Gradient, size = 512): string {
  const id = `g${gradient.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'grad'}`
  const reversed = gradient.reversed ?? false
  const stops = stopEls(gradient.stops, reversed)

  const def = RADIAL_TYPES.has(gradient.type)
    ? `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${def}</defs><rect width="${size}" height="${size}" fill="url(#${id})"/></svg>`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/gradientSvg.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradientSvg.ts src/lib/gradientSvg.test.ts
git commit -m "feat: add gradientToSvg builder for clipboard/Figma export"
```

---

## Task 2: Clipboard helpers

**Files:**
- Create: `src/lib/clipboard.ts`
- Test: `src/lib/clipboard.test.ts`

The helpers take the native `ClipboardEvent`. Tests use a fake event exposing a
`clipboardData` with a `Map`-backed `getData`/`setData` and a `preventDefault`
spy — jsdom does not construct real `ClipboardEvent`s with data.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/clipboard.test.ts
import { describe, it, expect, vi } from 'vitest'
import { writeGradientToClipboard, readGradientsFromClipboard } from './clipboard'
import type { Gradient } from '../store/types'

function fakeEvent(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  const preventDefault = vi.fn()
  return {
    event: {
      preventDefault,
      clipboardData: {
        setData: (type: string, val: string) => store.set(type, val),
        getData: (type: string) => store.get(type) ?? '',
      },
    } as unknown as ClipboardEvent,
    store,
    preventDefault,
  }
}

const gradient: Gradient = {
  id: 'abc',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  name: 'Sunset',
}

describe('writeGradientToClipboard', () => {
  it('writes text/plain JSON, image/svg+xml, and text/html and prevents default', () => {
    const { event, store, preventDefault } = fakeEvent()
    writeGradientToClipboard(event, gradient)
    expect(preventDefault).toHaveBeenCalled()
    expect(store.get('text/plain')).toContain('"kind": "gradient"')
    expect(store.get('image/svg+xml')).toContain('<svg')
    expect(store.get('text/html')).toContain('<svg')
  })
})

describe('readGradientsFromClipboard', () => {
  it('round-trips a written gradient back into Gradient objects', () => {
    const { event: writeEv, store } = fakeEvent()
    writeGradientToClipboard(writeEv, gradient)
    const { event: readEv } = fakeEvent({ 'text/plain': store.get('text/plain')! })
    const result = readGradientsFromClipboard(readEv)
    expect(result).not.toBeNull()
    expect(result!).toHaveLength(1)
    expect(result![0].type).toBe('linear')
    expect(result![0].name).toBe('Sunset')
    // Fresh id assigned on import
    expect(result![0].id).not.toBe('abc')
  })

  it('returns null for foreign / non-JSON clipboard text', () => {
    const { event } = fakeEvent({ 'text/plain': 'hello world' })
    expect(readGradientsFromClipboard(event)).toBeNull()
  })

  it('returns null when there is no clipboardData', () => {
    expect(readGradientsFromClipboard({} as ClipboardEvent)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/clipboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/clipboard.ts
import type { Gradient } from '../store/types'
import {
  fromImportJson,
  importGradient,
  toExportJson,
  toSharePayloadGradient,
} from './gradientCodec'
import { gradientToSvg } from './gradientSvg'

/** Write the focused gradient to the clipboard in three formats: Palette JSON
 * (text/plain, read back by another Palette session), and an SVG under both
 * image/svg+xml and text/html so design tools (Figma/Illustrator) paste a
 * vector gradient. Called from a native `copy` event so all formats are set
 * synchronously with no permission prompt. */
export function writeGradientToClipboard(e: ClipboardEvent, gradient: Gradient): void {
  const data = e.clipboardData
  if (!data) return
  const json = toExportJson({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  const svg = gradientToSvg(gradient)
  data.setData('text/plain', json)
  data.setData('image/svg+xml', svg)
  data.setData('text/html', svg)
  e.preventDefault()
}

/** Read Palette gradients from a native `paste` event. Returns fresh Gradient
 * objects (new ids) on a valid Palette payload, or null when the clipboard has
 * no recognizable Palette JSON. */
export function readGradientsFromClipboard(e: ClipboardEvent): Gradient[] | null {
  const text = e.clipboardData?.getData('text/plain')
  if (!text) return null
  const payload = fromImportJson(text)
  if (!payload) return null
  return payload.gradients.map(importGradient)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/clipboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clipboard.ts src/lib/clipboard.test.ts
git commit -m "feat: add multi-format gradient clipboard read/write helpers"
```

---

## Task 3: Store — import + undo, viewer target, remove pending-import

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts` (create if absent; otherwise append)

First check whether a store test file exists:
Run: `ls src/store/useAppStore.test.ts 2>/dev/null || echo MISSING`
If MISSING, create it with the imports shown in Step 1.

- [ ] **Step 1: Write the failing test**

```typescript
// src/store/useAppStore.test.ts  (append inside the file; create with this header if missing)
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Gradient } from './types'

function grad(id: string, name: string): Gradient {
  return {
    id,
    type: 'linear',
    name,
    stops: [
      { hex: '#111111', position: 0 },
      { hex: '#eeeeee', position: 100 },
    ],
  }
}

describe('useAppStore import + undo', () => {
  beforeEach(() => {
    useAppStore.setState({ saved: [], lastImported: null })
  })

  it('importGradients adds gradients and records their new ids', () => {
    useAppStore.getState().importGradients([grad('a', 'One'), grad('b', 'Two')])
    const { saved, lastImported } = useAppStore.getState()
    expect(saved).toHaveLength(2)
    expect(lastImported?.ids).toHaveLength(2)
    // Ids recorded must be the ids that actually landed in `saved`.
    expect(saved.map((g) => g.id).sort()).toEqual([...lastImported!.ids].sort())
  })

  it('undoImport removes exactly the gradients just imported', () => {
    useAppStore.setState({ saved: [grad('keep', 'Keep')] })
    useAppStore.getState().importGradients([grad('x', 'New')])
    expect(useAppStore.getState().saved).toHaveLength(2)
    useAppStore.getState().undoImport()
    const { saved, lastImported } = useAppStore.getState()
    expect(saved.map((g) => g.name)).toEqual(['Keep'])
    expect(lastImported).toBeNull()
  })

  it('records only ids that were actually added (dedupe by signature)', () => {
    useAppStore.getState().importGradients([grad('dup', 'Dup')])
    // Same colors/type/positions => same signature => not re-added.
    useAppStore.getState().importGradients([grad('dup2', 'Dup Again')])
    const { saved, lastImported } = useAppStore.getState()
    expect(saved).toHaveLength(1)
    expect(lastImported?.ids ?? []).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useAppStore.test.ts`
Expected: FAIL — `importGradients`/`lastImported`/`undoImport` do not exist.

- [ ] **Step 3: Modify the store**

In `src/store/useAppStore.ts`:

3a. In the `AppState` interface, **remove** these lines:
```typescript
  pendingImport: Gradient[] | null
```
```typescript
  setPendingImport: (gradients: Gradient[]) => void
  confirmImport: () => void
  dismissImport: () => void
```

3b. In the `AppState` interface, **add** (near the other saved-board actions):
```typescript
  /** Ids of the gradients added by the most recent import (paste, share link,
   * or JSON textarea). Not persisted — undo is a same-session affordance. */
  lastImported: { ids: string[] } | null
  importGradients: (gradients: Gradient[]) => void
  undoImport: () => void
  /** The gradient the Gallery viewer is currently showing, or null. Lets the
   * app-level copy handler copy the open gradient instead of `current`. */
  viewerGradient: Gradient | null
  setViewerGradient: (gradient: Gradient | null) => void
```

3c. In the store body, **remove** the initializer `pendingImport: null,` and the
three actions `setPendingImport`, `confirmImport`, `dismissImport`.

3d. In the store body, **add** initializers + actions (place near `undoDelete`):
```typescript
      lastImported: null,
      importGradients: (gradients) => {
        const before = new Set(get().saved.map((g) => g.id))
        gradients.forEach((g) => get().saveGradient(g))
        // saveGradient assigns a fresh id to every stored copy, so diff the
        // saved list to learn which ids actually landed (dedupe drops some).
        const added = get()
          .saved.filter((g) => !before.has(g.id))
          .map((g) => g.id)
        set({ lastImported: added.length > 0 ? { ids: added } : { ids: [] } })
      },
      undoImport: () => {
        const last = get().lastImported
        if (!last) return
        const ids = new Set(last.ids)
        set({ saved: get().saved.filter((g) => !ids.has(g.id)), lastImported: null })
      },
      viewerGradient: null,
      setViewerGradient: (gradient) => set({ viewerGradient: gradient }),
```

3e. In `partialize`, leave as-is (neither `lastImported` nor `viewerGradient`
persist — they're not listed, which is correct).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useAppStore.test.ts`
Expected: PASS. (TypeScript will now error in App.tsx — fixed in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add importGradients/undoImport and viewerGradient to store"
```

---

## Task 4: UndoToast component

**Files:**
- Create: `src/components/UndoToast.tsx`
- Create: `src/components/UndoToast.module.css`
- Test: `src/components/UndoToast.test.tsx`

Reuse the visual language of the Gallery undo toast. Copy the relevant rules
from `src/components/Gallery.module.css` (`.undoToast`, `.undoText`,
`.undoButton`) into `UndoToast.module.css` as `.toast`, `.text`, `.button`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/UndoToast.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UndoToast } from './UndoToast'

describe('UndoToast', () => {
  it('renders the message', () => {
    render(<UndoToast message="Added 2 gradients" />)
    expect(screen.getByText('Added 2 gradients')).toBeInTheDocument()
  })

  it('shows an Undo button and calls onUndo when clicked', () => {
    const onUndo = vi.fn()
    render(<UndoToast message="Added 1 gradient" onUndo={onUndo} />)
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('omits the Undo button when onUndo is not provided', () => {
    render(<UndoToast message="Copied gradient" />)
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/UndoToast.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component + CSS**

```tsx
// src/components/UndoToast.tsx
import styles from './UndoToast.module.css'

interface UndoToastProps {
  message: string
  onUndo?: () => void
}

/** App-wide confirmation toast. With `onUndo` it shows an Undo action (paste /
 * import); without it, it's a plain confirmation (copy). */
export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div data-testid="undo-toast" className={styles.toast} role="status">
      <span className={styles.text}>{message}</span>
      {onUndo && (
        <button type="button" data-testid="undo-import" className={styles.button} onClick={onUndo}>
          Undo
        </button>
      )}
    </div>
  )
}
```

```css
/* src/components/UndoToast.module.css
   Mirrors the Gallery undo toast. If Gallery.module.css's .undoToast/.undoText/
   .undoButton differ from the values below, copy those exact values instead so
   the two toasts match. */
.toast {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(20, 20, 22, 0.82);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  color: #fff;
  font-size: 14px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  z-index: 60;
}

.text {
  white-space: nowrap;
}

.button {
  border: none;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 9px;
  cursor: pointer;
}

.button:hover {
  background: rgba(255, 255, 255, 0.26);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/UndoToast.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/UndoToast.tsx src/components/UndoToast.module.css src/components/UndoToast.test.tsx
git commit -m "feat: add reusable UndoToast component"
```

---

## Task 5: Gallery — publish the open viewer gradient

**Files:**
- Modify: `src/components/Gallery.tsx`

The Gallery holds the open gradient in local `open` state (`const [open, setOpen] = useState<Gradient | null>(null)`). Publish it to the store so the app-level copy handler copies the viewed gradient.

- [ ] **Step 1: Add the store setter binding**

Near the other store selectors at the top of the `Gallery` component (around line 335, beside `const undoDelete = useAppStore((s) => s.undoDelete)`), add:
```typescript
  const setViewerGradient = useAppStore((s) => s.setViewerGradient)
```

- [ ] **Step 2: Sync `open` → store, clearing on unmount**

Immediately after the `const [open, setOpen] = useState<Gradient | null>(null)` line, add an effect:
```typescript
  // Publish the open viewer gradient so the app-level Cmd+C copies it.
  useEffect(() => {
    setViewerGradient(open)
    return () => setViewerGradient(null)
  }, [open, setViewerGradient])
```
(`useEffect` is already imported at the top of Gallery.tsx.)

- [ ] **Step 3: Run Gallery tests to verify nothing broke**

Run: `npx vitest run src/components/Gallery.test.tsx`
Expected: PASS (behavior unchanged; new effect is inert to existing tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/Gallery.tsx
git commit -m "feat: publish open Gallery viewer gradient to store for copy"
```

---

## Task 6: App — global copy/paste, toasts, remove ImportBanner

**Files:**
- Modify: `src/App.tsx`

This task rewrites the import wiring in `App.tsx`. Replace the whole component's
import-related pieces as shown. Keep `handleRiff`, `useIdleFade`, the
shortcuts, TabBar, and mode rendering intact.

- [ ] **Step 1: Update imports at the top of App.tsx**

Remove:
```typescript
import { ImportBanner } from './components/ImportBanner'
```
Change the codec import line to drop `importGradient` (now only used in clipboard.ts) but keep the rest:
```typescript
import { decodeFromFragment, fromImportJson, importGradient } from './lib/gradientCodec'
```
becomes:
```typescript
import { decodeFromFragment, fromImportJson, importGradient } from './lib/gradientCodec'
import { UndoToast } from './components/UndoToast'
import { writeGradientToClipboard, readGradientsFromClipboard } from './lib/clipboard'
```
(`importGradient` is still used by the share-link `useEffect` below, so keep it.)

- [ ] **Step 2: Replace store selectors and add import-toast state**

Replace these lines:
```typescript
  const pendingImport = useAppStore((s) => s.pendingImport)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const setMode = useAppStore((s) => s.setMode)
  const setPendingImport = useAppStore((s) => s.setPendingImport)
  const confirmImport = useAppStore((s) => s.confirmImport)
  const dismissImport = useAppStore((s) => s.dismissImport)
  const chromeVisible = useIdleFade()
  const [toastText, setToastText] = useState<string | null>(null)
```
with:
```typescript
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const setMode = useAppStore((s) => s.setMode)
  const importGradients = useAppStore((s) => s.importGradients)
  const undoImport = useAppStore((s) => s.undoImport)
  const chromeVisible = useIdleFade()
  const [toastText, setToastText] = useState<string | null>(null)
  // Import toast carries an Undo; copy toast does not (undoable = has ids).
  const [importToast, setImportToast] = useState<{ message: string; undoable: boolean } | null>(null)
  const importToastTimer = useRef<number | null>(null)
```
Add `useRef` to the React import at the top:
```typescript
import { useEffect, useRef, useState } from 'react'
```

- [ ] **Step 3: Replace the import handlers**

Replace the share-link `useEffect`, `handleImportJson`, `handleDismissImport`,
and `handleConfirmImport` block (the four items) with:
```typescript
  function showImportToast(count: number) {
    if (importToastTimer.current) clearTimeout(importToastTimer.current)
    if (count === 0) {
      setImportToast({ message: 'Already in your Gallery', undoable: false })
    } else {
      setImportToast({ message: `Added ${count} gradient${count === 1 ? '' : 's'} to Gallery`, undoable: true })
    }
    importToastTimer.current = window.setTimeout(() => setImportToast(null), 5000)
  }

  // Share-link import: decode #d=… on load, add straight to the Gallery.
  useEffect(() => {
    const payload = decodeFromFragment(window.location.hash)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map(importGradient)
    importGradients(gradients)
    const added = useAppStore.getState().lastImported?.ids.length ?? 0
    showImportToast(added)
    history.replaceState(null, '', window.location.pathname + window.location.search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleImportJson(jsonText: string) {
    const payload = fromImportJson(jsonText)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map(importGradient)
    importGradients(gradients)
    const added = useAppStore.getState().lastImported?.ids.length ?? 0
    showImportToast(added)
  }

  function handleUndoImport() {
    undoImport()
    if (importToastTimer.current) clearTimeout(importToastTimer.current)
    setImportToast(null)
  }
```

- [ ] **Step 4: Add the global copy/paste effect**

Add after the handlers, before `return`:
```typescript
  // App-wide Cmd/Ctrl+C copy and Cmd/Ctrl+V paste. Native clipboard events let
  // us write multiple formats synchronously and read them back on paste.
  useEffect(() => {
    function onCopy(e: ClipboardEvent) {
      const el = document.activeElement as HTMLElement | null
      const inField = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable
      const hasSelection = (window.getSelection()?.toString().length ?? 0) > 0
      if (inField || hasSelection) return // let native copy proceed
      const state = useAppStore.getState()
      const target = state.viewerGradient ?? state.current
      if (!target) return
      writeGradientToClipboard(e, target)
      setToastText('Copied gradient')
      window.setTimeout(() => setToastText(null), 2000)
    }
    function onPaste(e: ClipboardEvent) {
      const el = document.activeElement as HTMLElement | null
      const inField = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable
      if (inField) return // JSON import textarea keeps native paste
      const gradients = readGradientsFromClipboard(e)
      if (!gradients) return
      e.preventDefault()
      importGradients(gradients)
      const added = useAppStore.getState().lastImported?.ids.length ?? 0
      showImportToast(added)
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 5: Replace the ImportBanner render + add UndoToast**

Remove:
```tsx
      {pendingImport && (
        <ImportBanner count={pendingImport.length} onConfirm={handleConfirmImport} onDismiss={handleDismissImport} />
      )}
```
And near the bottom, after the existing `{toastText && <Hint … />}` line, add:
```tsx
      {importToast && (
        <UndoToast
          message={importToast.message}
          onUndo={importToast.undoable ? handleUndoImport : undefined}
        />
      )}
```

- [ ] **Step 6: Typecheck + run the app's test suite for App**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors related to App/store (any remaining errors point to a missed edit).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: global copy/paste with import undo toast; drop import banner"
```

---

## Task 7: Update App tests for the new flow

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Replace the banner-based import tests**

In `src/App.test.tsx`, replace the two tests inside `describe('App import flow', …)` that reference `import-banner`/`Add to board` (the "shows the import banner…" and "renders a toast notification once the import is confirmed" tests) with:

```typescript
  it('auto-adds gradients from a share link on load and shows an undo toast', () => {
    const payload = {
      kind: 'gradient' as const,
      gradients: [
        {
          type: 'linear' as const,
          stops: [
            { hex: '#ff0000', position: 0 },
            { hex: '#0000ff', position: 100 },
          ],
          name: 'Test',
        },
      ],
    }
    window.location.hash = `#${encodeToFragment(payload)}`
    render(<App />)
    expect(screen.getByTestId('undo-toast')).toBeInTheDocument()
    expect(screen.getByText(/added 1 gradient to gallery/i)).toBeInTheDocument()
    expect(screen.queryByTestId('import-banner')).not.toBeInTheDocument()
    window.location.hash = ''
  })

  it('undo removes the just-imported gradient', () => {
    const payload = {
      kind: 'board' as const,
      gradients: [
        {
          type: 'linear' as const,
          stops: [
            { hex: '#00ff00', position: 0 },
            { hex: '#000000', position: 100 },
          ],
          name: 'UndoMe',
        },
      ],
    }
    window.location.hash = `#${encodeToFragment(payload)}`
    render(<App />)
    fireEvent.click(screen.getByTestId('undo-import'))
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument()
    window.location.hash = ''
  })
```

Ensure `fireEvent` is imported in this file (it is used elsewhere in the file already; if the import list lacks it, add it to the `@testing-library/react` import).

- [ ] **Step 2: Run the App tests**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS. If a test relies on store state persisting between tests, reset with `useAppStore.setState({ saved: [], lastImported: null })` in a `beforeEach` (add if not present).

- [ ] **Step 3: Commit**

```bash
git add src/App.test.tsx
git commit -m "test: cover auto-add import flow and undo, drop banner tests"
```

---

## Task 8: Remove ImportBanner files

**Files:**
- Delete: `src/components/ImportBanner.tsx`, `src/components/ImportBanner.module.css`, `src/components/ImportBanner.test.tsx`

- [ ] **Step 1: Delete the files**

```bash
git rm src/components/ImportBanner.tsx src/components/ImportBanner.module.css src/components/ImportBanner.test.tsx
```

- [ ] **Step 2: Verify no remaining references**

Run: `grep -rn "ImportBanner\|pendingImport\|confirmImport\|dismissImport\|setPendingImport" src`
Expected: no output.

- [ ] **Step 3: Full suite + typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete ImportBanner"
```

---

## Task 9: Manual verification in the browser

**Files:** none (manual QA)

- [ ] **Step 1: Run the dev server and verify copy/paste**

Start the dev server (via the preview tooling / `npm run dev`) and check:
- In Create, press Cmd+C → "Copied gradient" toast appears.
- Open a new browser tab/session of the app, press Cmd+V → gradient is added to the Gallery, "Added 1 gradient to Gallery" toast with Undo appears; Undo removes it.
- Paste the copied clipboard into Figma (or a text editor to confirm SVG/JSON present) → a vector gradient rectangle appears in Figma.
- Selecting text in the "Import JSON…" textarea and pressing Cmd+C still copies the text (not hijacked); pasting into that textarea still works.
- Open a Gallery gradient in the viewer, press Cmd+C → copies that gradient.

- [ ] **Step 2: Note any issues and fix before landing**

If a check fails, diagnose against the relevant task and fix, re-running that task's tests.

---

## Self-Review Notes

- **Spec coverage:** multi-format clipboard (Task 2), SVG builder w/ conic fallback (Task 1), context-aware single-gradient copy via `viewerGradient ?? current` (Tasks 3, 5, 6), auto-add + undo toast for paste AND share-link AND JSON textarea (Tasks 3, 6, 7), removal of ImportBanner (Task 8), confirming toasts on copy/paste/undo (Tasks 4, 6). All spec sections mapped.
- **Type consistency:** `importGradients`, `undoImport`, `lastImported.ids`, `viewerGradient`, `setViewerGradient`, `gradientToSvg`, `writeGradientToClipboard`, `readGradientsFromClipboard` names are used identically across tasks.
- **Board copy** intentionally left in the share menu (out of scope, per spec).
