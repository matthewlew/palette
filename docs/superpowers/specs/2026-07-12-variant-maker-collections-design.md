# Design: Variant maker + collections

Date: 2026-07-12
Status: approved (brainstorm), pending implementation plan

## Summary

Two coupled features on a shared data model, built in two phases:

1. **Collections** — Pinterest-style boards in the Gallery that group saved
   gradients. A collection is a labeled subset of the Gallery, not a separate
   silo: every save still lands in the Gallery's "All" view.
2. **Variant maker** — a seed tray over the existing create feed. The active
   collection's gradients become the seed pool; the generator produces new
   gradients related to them, tuned by three bias levers ported from Bklyn
   Clay. The tray you fill *is* the collection.

The unifying idea: **the tray = the collection = the generation seed.** One
persisted object serves all three roles.

## Background

- The current generator, `generateGradientStops(colorSet)` in
  `src/lib/palette.ts`, samples colors from a fixed `ColorSet`, jitters them
  in OKLCH, builds 8 candidates, scores each with `scorePalette`
  (`src/lib/paletteScore.ts`), and weighted-random picks one by `score²`.
  There is no way to steer generation toward specific colors the user likes.
- The app already has a `saved: Gradient[]` collection persisted to
  localStorage, a Gallery grid, and a create feed (`Feed`/`GradientPage`) with
  a bottom-right **Save** pill (`LikeButton`).
- The default color set is literally named `bklyn-clay`
  (`src/lib/colorSets.ts`); we previously ported Bklyn Clay's aesthetic
  *scoring* math (see `2026-07-08-bklyn-clay-scoring-research.md`). This design
  ports its *generation levers* too.

## Decisions (from brainstorm)

- Variant maker is a **seed tray over the existing feed**, not a separate
  workspace screen.
- The tray holds **whole gradients only** (not single colors). Their stop
  colors are extracted to seed the generator.
- **Three bipolar levers**, 0–100, default 50 (neutral), matching Bklyn Clay's
  `scoreGlaze`:
  - **Temperature** — warm ↔ cool (biases OKLCH hue)
  - **Depth** — light ↔ dark (biases OKLCH lightness `l`)
  - **Character** — muted ↔ vivid (biases OKLCH chroma `c`)
  - No per-pin weights — the three global levers provide enough control.
- The tray is a **persisted collection**, reopenable across sessions. Fill it
  by Saving into it, or dragging gradients from the Gallery.
- **Orientation is responsive:** bottom strip on mobile, left side strip on
  desktop (mirrors edit mode's sheet/side-panel split).
- **One destination-aware Save**, no separate "Lock." With a collection
  active, the pill reads *"Save → [name]"* and adds to both the Gallery and
  the collection; with none active, plain *"Save"* → Gallery. Every save
  always lands in "All" so nothing is ever lost.

## Data model & persistence

New `Collection` type, persisted alongside `saved` in the existing store
(`src/store/`):

```ts
interface Collection {
  id: string
  name: string
  createdAt: number
  gradientIds: string[]              // references into `saved`; never copies
  levers: { temp: number; depth: number; char: number } // 0–100, default 50
}
```

Store additions:

- State: `collections: Collection[]`, `activeCollectionId: string | null`.
- Actions: `createCollection(name?)`, `renameCollection(id, name)`,
  `deleteCollection(id)`, `addToCollection(collectionId, gradientId)`,
  `removeFromCollection(collectionId, gradientId)`,
  `setActiveCollection(id | null)`, `setCollectionLevers(id, levers)`.

Invariants:

- Collections hold only ids. Deleting a gradient from `saved` prunes its id
  from every collection; removing from a collection never deletes the
  gradient.
- Persistence uses the same localStorage mechanism/versioning as `saved`; add
  a migration that defaults `collections: []`, `activeCollectionId: null` for
  existing stored state.

## Generation engine

New pure module `src/lib/variantGen.ts`, keeping `palette.ts` focused:

- `poolFromGradients(gradients): ColorSet` — extract every stop color from the
  tray's gradients into an ad-hoc `ColorSet` (deduped in OKLCH).
- `leverWeight(color, levers): number` — port of Bklyn Clay's
  `scoreGlaze(g, lv)` (`~/Documents/bklynclay-glaze/scoring.js`), adapted to
  OKLCH: temp biases warm/cool hue bands, depth biases lightness, character
  biases chroma. Returns a positive multiplier (min ~0.05).
- `generateVariant(collection): Gradient` — builds candidates by sampling the
  pool with `leverWeight` as the per-color sampling weight, then ranks
  candidates with the existing `scorePalette` and weighted-picks by `score²`
  (same final step as today, so quality bias is preserved).

Fallback: an empty pool (no tray gradients) defers to the current
`generateGradientStops(DEFAULT_COLOR_SET)` behavior, so the feed still works
with no active collection.

Integration: `Feed` reads the active collection (if any) and calls
`generateVariant` instead of the plain generator; changing a lever re-rolls
the bias live.

## Create-feed UI

- **Seed tray**: responsive filmstrip — bottom strip on mobile, left side
  strip on desktop — showing the active collection's gradient thumbnails, a
  header with the collection name + a switcher (open another / none), and a
  remove-from-tray affordance per thumbnail.
- **Levers**: three slim, collapsible sliders bound to the active collection's
  `levers` via `setCollectionLevers`.
- **Save**: destination chip (`◳ [name] ▾`) beside the existing Save pill.
  `▾` switches the target collection, offers "Gallery only", and "+ New
  collection". Saving with a collection active calls the normal save plus
  `addToCollection`.

## Gallery collections UI

- A **Collections** row (board covers with counts) above the existing All
  grid; a "+ New" cover creates a collection.
- Opening a board shows its member gradients and an **"Open in feed"** action
  that calls `setActiveCollection` and navigates to the create feed with the
  tray loaded.
- **Drag-and-drop**: dropping a Gallery tile onto a board cover calls
  `addToCollection`.

## Phasing

Two shippable phases on the shared data model:

- **Phase 1 — Collections as boards:** data model + store actions + Gallery
  Collections row + destination-aware Save. Ships the boards value with no
  generation change.
- **Phase 2 — Variant maker:** `variantGen.ts` + seed tray + levers + feed
  integration.

## Testing

- `variantGen`: pool extraction/dedup; `leverWeight` monotonicity (warmer temp
  ⇒ higher weight for warm colors, etc.); empty-pool fallback path.
- Store: collection CRUD; id-reference integrity (deleting a saved gradient
  prunes it from collections; removing from a collection preserves it in
  `saved`); persistence migration defaults.
- Components: seed tray render + remove; destination-aware Save label and
  target; Gallery Collections row, create, open-in-feed, and drag-to-add.

Follow existing vitest + Testing Library patterns; run with
`NODE_OPTIONS=--no-experimental-webstorage`.

## Out of scope (YAGNI)

- Single-color pins in the tray (gradients-only for now).
- Per-pin weights / drag-ranking affinity (the three levers replace it).
- Continuous OKLCH-attractor generation (revisit only if pooled sampling feels
  too "griddy").
- Multiple lever presets / a preset picker.
- Sharing/exporting collections (existing share flow is per-gradient/board
  already; no new surface here).
