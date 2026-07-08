# Share Link + JSON Export/Import — Design Spec

Date: 2026-07-08
Status: Approved design; ready for implementation planning.

## Goal

Let a user share a single gradient or their whole saved board with someone else, or move it to another device, without any backend or accounts. Two transports:

- **Share link** — a URL that opens the app pre-loaded with the incoming gradient(s), for quick person-to-person sharing.
- **JSON export/copy** — a plain-JSON representation for full board backup, or for feeding into other tools (AI assistants, Figma plugins, etc).

This also produces the reusable wire format the (currently deferred) hosted cross-device sync feature will need later — see `TODOS.md`.

## Naming

Reuses the already-approved, unimplemented spec at `docs/superpowers/specs/2026-07-07-palette-naming-design.md` (`namePalette(hexes)` in `src/lib/naming.ts`, hex-based deterministic word-bank name). This spec does not redesign naming — it just consumes it: every gradient gets a `name` before it can be shared or exported, generated via `namePalette` if not already set.

Implementation note: since that spec is unimplemented, building it is a prerequisite task within this feature's plan (see "Dependencies" below), not a separate future session.

## 1. Data & codec — `src/lib/gradientCodec.ts`

Shared envelope for both single-gradient and whole-board payloads:

```ts
interface SharePayload {
  kind: 'gradient' | 'board'
  gradients: Array<{
    type: GradientType
    stops: GradientStop[]
    reversed?: boolean
    repeatEnabled?: boolean
    hardStops?: boolean
    name: string
  }>
}
```

- `id` is intentionally excluded from the wire format — import always assigns fresh `crypto.randomUUID()`s, so re-importing the same link twice can't collide with existing saved ids (matches the existing `saveGradient` dedup approach in `useAppStore.ts`, keyed on `gradientSignature`, not `id`).
- `encodeToFragment(payload: SharePayload): string` — JSON.stringify → base64url-encode → returns a hash fragment value (e.g. `d=<encoded>`), so the full link is `${location.origin}${location.pathname}#d=<encoded>`.
- `decodeFromFragment(hash: string): SharePayload | null` — reverses it; returns `null` (never throws) on malformed/truncated input so the caller can fail closed.
- `toExportJson(payload: SharePayload): string` — `JSON.stringify(payload, null, 2)`.
- `fromImportJson(text: string): SharePayload | null` — `JSON.parse` + shape validation (kind is one of the two literals, gradients is an array, each entry has `type`/`stops`); returns `null` on any failure.

## 2. Data model change

Add `name?: string` to `Gradient` in `src/store/types.ts`. In `useAppStore.ts`, `saveGradient` sets `name` via `namePalette()` when the incoming gradient doesn't already carry one (imported gradients already have a name from the payload; freshly-generated ones don't).

## 3. UI entry points

- **Drawer** (`src/components/Drawer.tsx`): header-level actions — "Share board" (copies a board share link to clipboard) and "Copy JSON" (copies board export JSON). Also "Import" (see flow below).
- **Per-gradient**: an icon on each saved drawer card — tap copies a single-gradient share link; a secondary action (long-press or adjacent icon, following whatever pattern `LikeButton.tsx` already establishes for card-level actions) copies that gradient's JSON.
- Clipboard writes use `navigator.clipboard.writeText`. No existing toast/transient-feedback primitive was found in the codebase, so this feature adds one small shared component (e.g. a brief inline checkmark swap on the pressed icon, similar to how `LikeButton` already animates its own state) rather than a global toast system — kept minimal, reused across all four copy actions.

## 4. Import flow

- **Link import**: on load, `App.tsx` checks `location.hash` for a `d=` payload. If `decodeFromFragment` succeeds, the app enters a `preview-import` state: incoming gradient(s) render in explore mode behind a confirm banner — "Import N gradient(s)? [Add to board] [Dismiss]". Confirm calls `saveGradient` for each; dismiss clears the hash (`history.replaceState`) and returns to normal state. Malformed hashes are ignored silently (treated as no share data present).
- **JSON import**: drawer "Import" action opens a paste target (textarea) or file picker (`.json`). Input goes through `fromImportJson`, then the same preview-confirm banner as link import. Invalid JSON shows an inline error instead of the banner.

## 5. Testing

- `gradientCodec`: round-trip encode/decode for both `gradient` and `board` kinds; malformed fragment/JSON returns `null` without throwing.
- `namePalette` (from the naming spec): determinism, coverage, no in-name word repeats — carried over as part of implementing that prerequisite spec.
- Store integration: `saveGradient` assigns a name only when absent; imported names are preserved verbatim.
- Component test: import-preview banner confirm adds to board, dismiss clears hash and discards.

## Out of scope

- Backend-hosted short links or accounts (deferred — see `TODOS.md`).
- Editing a gradient's name manually.
- Import from sources other than this app's own JSON/link format.

## Dependencies

- Implementing `src/lib/naming.ts` per `docs/superpowers/specs/2026-07-07-palette-naming-design.md` is a prerequisite step inside this feature's implementation plan.
