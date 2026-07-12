# Gradient Copy & Paste Design

**Date:** 2026-07-13
**Status:** Approved, ready for implementation plan

## Goal

Make it effortless to copy and paste gradients between Palette sessions with
`Cmd/Ctrl+C` and `Cmd/Ctrl+V`, put a Figma-usable SVG on the clipboard as a
bonus, and replace the awkward import banner with a frictionless auto-add +
undo flow. Every copy/paste/undo shows a confirming toast.

## Background

Current state:

- **Copy** only exists inside the share menu (`BoardShare`): share link, JSON
  export, curated entry — all button-driven, no keyboard.
- **Paste/import** flows through `fromImportJson` → `setPendingImport` →
  `ImportBanner` ("Import N gradients? Add to board / Dismiss"). No preview, a
  small banner, an extra confirm step.
- A robust `SharePayload` codec already exists (`src/lib/gradientCodec.ts`):
  JSON + base64url fragment, with strict validation (`isSharePayload`,
  hex/position guards).
- The store already implements a delete undo/redo pattern
  (`lastDeleted`/`undoDelete`), which we mirror for imports.

## Decisions (from brainstorming)

- **Copy scope:** the single focused gradient only. Board copy stays in the
  share flow.
- **Clipboard format:** multi-format — Palette JSON (for exact round-trips)
  plus an SVG (for Figma/design tools).
- **Figma fidelity:** nice-to-have SVG. Faithful for linear/radial; conic types
  fall back to a linear approximation.
- **Paste behavior:** auto-add to Gallery immediately + an undo toast. No
  banner, no preview/confirm step.
- **Import banner:** removed entirely; share-link imports become auto-add +
  undo too, consistent with paste.
- **Confirming toasts** on copy, paste, and undo.

## Architecture

### 1. Clipboard format (multi-format write)

On copy, write three representations of the single focused gradient in one
synchronous `copy` DOM event via `e.clipboardData.setData(...)`:

- `text/plain` → Palette JSON, the existing `toExportJson({kind:'gradient',
  gradients:[toSharePayloadGradient(g)]})` shape. This is what another Palette
  session reads back on paste, so round-trips are exact.
- `image/svg+xml` **and** `text/html` (same SVG string) → a self-contained
  `<svg>` with a real gradient fill, so pasting into Figma/Illustrator yields a
  vector rectangle with a gradient. `text/html` covers apps that only sniff
  HTML on paste.

Native `copy`/`paste` DOM events are used (not `navigator.clipboard.write`) so
multiple formats are set synchronously with no permission prompt.

### 2. SVG builder — `src/lib/gradientSvg.ts`

`gradientToSvg(gradient: Gradient, size = 512): string`

Maps gradient type to SVG:

- `linear` / `mirror` / `repeat` → SVG `<linearGradient>` (all render as 180°
  linear under the hood; use `positionedStops`/`repeatedStops` helpers already
  in `lib/gradient.ts` to compute the effective stop list, then honor
  `reversed`).
- `radial` → SVG `<radialGradient>` (circle, centered).
- `angular` / `square` / `fan` (conic) → SVG has no native conic gradient, so
  fall back to a `<linearGradient>` approximation of the stop sequence.
- Respect `reversed`, `hardStops` (duplicate stop positions to create bands),
  `repeatEnabled` (via `repeatedStops`).

Output is a standalone `<svg xmlns=... viewBox="0 0 size size"><defs>…</defs>
<rect width height fill="url(#id)"/></svg>` with a unique gradient id.

### 3. Clipboard helpers — `src/lib/clipboard.ts`

- `writeGradientToClipboard(e: ClipboardEvent, gradient: Gradient): void` —
  sets the three formats on `e.clipboardData` and calls `preventDefault()`.
- `readGradientsFromClipboard(e: ClipboardEvent): Gradient[] | null` — reads
  `text/plain`, runs `fromImportJson`, maps through `importGradient`. Returns
  null when the clipboard has no valid Palette payload.

### 4. Global copy/paste handlers — `App.tsx`

A single `useEffect` attaches document-level `copy` and `paste` listeners.

**Copy** copies the one gradient in focus, never the board:

- Create / Edit → the store's `current`.
- Gallery viewer open → the gradient the viewer is showing (Gallery exposes its
  open-viewer gradient to the handler — via a store field, e.g.
  `galleryViewerGradient`, or a ref surfaced to App).
- **Bail out** (let native copy proceed, do not `preventDefault`) when there is
  a non-collapsed text selection or focus is in an `input`/`textarea`, so
  selecting JSON text still copies normally.
- On success: write clipboard + show a "Copied gradient" toast.

**Paste**:

- Ignore when focus is in an `input`/`textarea` (the JSON import box keeps
  working with native paste).
- Otherwise read via `readGradientsFromClipboard`. If valid, auto-add to the
  Gallery and show the undo toast. Invalid/foreign clipboard → do nothing.

### 5. Store: import + undo — `useAppStore.ts`

Add an import action that mirrors the delete-undo pattern:

- `importGradients(gradients: Gradient[]): void` — saves each (reusing
  `saveGradient` dedupe semantics), and records the ids actually added into
  `lastImported: { ids: string[] } | null` (not persisted; same-session undo).
- `undoImport(): void` — removes exactly the gradients whose ids are in
  `lastImported`, then clears it.

Remove `pendingImport`, `setPendingImport`, `confirmImport`, `dismissImport`.

Note: `saveGradient` dedupes by signature, so pasting an already-saved gradient
may add nothing. `importGradients` records only the ids that were truly added,
so the undo toast count and Undo behavior stay accurate (and the toast should
reflect the added count, which can be 0 → "Already in your Gallery").

### 6. Undo toast

The current `Hint` is text-only. Add an action affordance:

- Either extend `Hint` with an optional `actionLabel` + `onAction`, or add a
  small `UndoToast` component. Prefer extending `Hint` to reuse styling/idle
  behavior if clean; otherwise a dedicated component.
- Auto-dismiss ~5s. "Undo" calls `undoImport` and clears the toast.
- Copy and paste both surface a toast; paste's toast carries the Undo action.

### 7. Removals

- Delete `src/components/ImportBanner.tsx`, `ImportBanner.module.css`,
  `ImportBanner.test.tsx`.
- Remove `ImportBanner` usage and `pendingImport` wiring from `App.tsx`.
- Point the share menu's "Import JSON…" textarea at the same auto-add + undo
  action instead of `setPendingImport`.

## Data Flow

```
Cmd+C ─▶ document 'copy' ─▶ (focused gradient) ─▶ writeGradientToClipboard
                                                    ├─ text/plain: Palette JSON
                                                    ├─ image/svg+xml: SVG
                                                    └─ text/html: SVG
                              └─▶ "Copied gradient" toast

Cmd+V ─▶ document 'paste' ─▶ readGradientsFromClipboard ─▶ importGradients
Share #d=… on load ────────▶ decodeFromFragment ─────────▶ importGradients
Share menu "Import JSON…" ─▶ fromImportJson ─────────────▶ importGradients
                                                            └─▶ undo toast
Undo ─▶ undoImport (removes just-added ids)
```

## Error Handling

- Invalid/foreign clipboard on paste → no-op, no toast.
- Copy with no focused gradient → no-op (let native copy proceed).
- Text selection / input focus → never hijack copy or paste.
- Duplicate paste (already saved) → toast reflects "already in Gallery"; Undo is
  a no-op or hidden when nothing was added.
- SVG builder must never throw on valid gradients; conic types always resolve to
  the linear fallback.

## Testing

- `gradientSvg.test.ts` — valid SVG structure per type; reversed/hardStops/
  repeat honored; conic falls back to linear; never throws.
- `clipboard.test.ts` — write sets all three formats + preventDefault; read
  parses valid JSON, rejects foreign text, round-trips a written gradient.
- Store tests — `importGradients` records added ids; dedupe; `undoImport`
  removes exactly those ids.
- App/component tests — copy/paste listeners fire; input-focus and text-
  selection bail-outs; undo toast appears and Undo works; share-link load
  auto-adds (replaces existing ImportBanner test coverage).

## Out of Scope

- Copying the whole board via keyboard (stays in share menu).
- Perfect conic SVG fidelity in Figma.
- Pasting raw images/colors from non-Palette sources.
