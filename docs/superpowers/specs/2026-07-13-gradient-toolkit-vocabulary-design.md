# Gradient Toolkit — Keyword Vocabulary + Authoring (Slice 1) Design

**Date:** 2026-07-13
**Status:** Approved (design), pending implementation plan
**Scope:** First slice of the larger keyword-driven "gradient toolkit" reframe of Daily Drops.

## Background & reframe

Daily Drops is being reframed from a read-only themed feed into a **keyword-driven
gradient toolkit**. The author hand-curates drops by supplying **keywords**, binding
each to a **color pairing** (and optional shape/composition), producing curated
gradients that are aesthetically scored, will later become SEO-discoverable
"gradient wallpaper" pages, and whose keyword→color vocabulary others can reuse as
prompts in their own AI tools.

The full product is five pieces: (1) keyword vocabulary, (2) authoring flow,
(3) the dated blog presentation, (4) SEO/prerender, (5) export-as-prompt toolkit.
**This spec covers only pieces 1 + a minimal 2.** Pieces 3–5 are each their own
later spec and are explicitly out of scope here.

## Goals for this slice

1. A persisted **keyword→color vocabulary** data model (keyword → color pairing +
   optional shape + note).
2. A minimal **in-app authoring flow** that "forces" hand-curation: define keyword
   bindings, compose gradients from them, and assemble one **CuratedDrop**.
3. Every composed gradient shows a live **aesthetic score**, reusing the existing
   `scorePalette` engine — so the author curates toward high-scoring pairings.
4. Persisted per-browser (localStorage), same pattern as collections. Export is a
   later slice.

## Data model (`src/store/types.ts`)

```ts
interface KeywordBinding {
  id: string
  keyword: string          // "glacier", "espresso crema"
  colors: string[]         // ordered hexes = the color pairing for this word (>=1)
  shape?: GradientType     // optional composition hint
  note?: string            // optional free-text clarity ("and other things")
}

interface CuratedDrop {
  id: string
  title: string
  description: string      // short blog copy
  date: string             // ISO calendar day (YYYY-MM-DD) — the "marked per day"
  gradients: Gradient[]    // composed from bindings (each carries its own stops/type)
}
```

The **keyword is the training unit**: word → color pairing (+ shape + note). The
`keywordBindings` list is the reusable vocabulary the future export/toolkit reads
verbatim.

## Store (`src/store/useAppStore.ts`)

Add two persisted arrays plus CRUD, following the existing collections pattern:

- State: `keywordBindings: KeywordBinding[]`, `curatedDrops: CuratedDrop[]`.
- Actions:
  - `addKeywordBinding(binding: Omit<KeywordBinding,'id'>): string`
  - `updateKeywordBinding(id, patch)`, `deleteKeywordBinding(id)`
  - `createCuratedDrop(drop: Omit<CuratedDrop,'id'>): string`
  - `updateCuratedDrop(id, patch)`, `deleteCuratedDrop(id)`
- Persistence: bump the persist `version` and add a migration that defaults both
  arrays to `[]` for existing stored state (exact same shape as the collections v3
  migration).

## Composition + aesthetic scoring

Building a gradient from selected keyword bindings (new pure helper,
`src/lib/keywordCompose.ts`):

- `composeStops(bindings: KeywordBinding[]): GradientStop[]` — concatenate each
  binding's `colors` in selection order into stops, evenly spaced across 0–100.
- `composeGradient(bindings, type?): Gradient` — `composeStops` + a `type` (the
  first binding's `shape`, else `'linear'`).
- **Score:** reuse `scorePalette(colors: Oklch[])` from `src/lib/paletteScore.ts`
  (returns 0–100). `scoreComposition(bindings): number` converts the composed
  stops' hexes to OKLCH via `hexToOklch` and calls `scorePalette`. This is the same
  aesthetic engine that ranks generated palettes, surfaced live in authoring so the
  author curates toward high-scoring pairings.

No new scoring math — this slice consumes the existing `scorePalette` verbatim.

## Authoring flow (minimal UI)

Reached from the Daily Drops segment via an "Author" affordance (author-facing;
not gated behind auth in this slice). Three regions:

1. **Vocabulary**: list of keyword bindings; a form to add one (keyword text,
   1+ color inputs = the pairing, optional shape select, optional note). Edit/delete
   inline.
2. **Compose**: multi-select keywords → live gradient preview via `buildGradientCss`,
   with the **aesthetic score (0–100)** shown beside it. "Add to drop" saves the
   composed gradient.
3. **Drop**: title + short description (date defaults to today, editable). The
   composed gradients collect here. "Save drop" writes a `CuratedDrop` to the store.

## Minimal render

The saved drop renders in a **bare** list under the Daily Drops segment: dated
header + description + the gradient set (reusing the existing tile/gradient
rendering). This is only enough to prove the loop end-to-end. The polished dated
Tumblr blog view is the next slice, not this one.

## Out of scope (each its own later spec)

- The blog visual design / Tumblr feel (slice 3).
- SEO + prerender/static generation — flagged: this is a client-rendered Vite SPA,
  so real indexing needs a prerender step (slice 4).
- Export the vocabulary as AI prompts / toolkit (slice 5).
- Auth / multi-author. This slice assumes a single local author.

## Testing

- `keywordCompose.test.ts`: `composeStops` preserves order and spaces evenly;
  `composeGradient` picks the shape; `scoreComposition` returns the same number as
  `scorePalette` on the equivalent OKLCH colors (proves reuse, not reimplementation).
- Store tests: CRUD for bindings and drops; the persist migration defaults both
  arrays to `[]`.
- A component test for the authoring flow: add a binding → compose → score shows →
  save drop → drop appears in the store and renders.

## Build order

1. Types + store state/actions + migration (+ tests).
2. `keywordCompose.ts` (compose + score reuse) (+ tests).
3. Authoring UI (vocabulary / compose / drop) wired to the store.
4. Minimal drop render under Daily Drops.
