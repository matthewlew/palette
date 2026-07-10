# TODOS

## Hosted cross-device board sync

**What:** Sync the `saved` gradients board across devices without manual JSON export/import — an account + small backend that a board follows automatically.

**Why:** Today, moving a board to another device means exporting JSON and importing it manually (see the share-link + JSON export work on `feat/full-palette-ux-improvements`). That's fine for a one-off share, but tedious for someone who wants their board to just be there on a new device.

**Pros:** Real cross-device continuity; no file hand-off step; natural next step once accounts exist for any other reason.

**Cons:** This is currently a no-backend static SPA (Vite + Zustand persist to localStorage only). Adding accounts + a backend is a big step up in infrastructure and ongoing maintenance for a solo side project — not proportional unless there's real demand for it.

**Context:** Reuses the same `gradientCodec.ts` plain-object shape built for share links/export, so the wire format is already solved — only the sync/auth layer is new. Surfaced during `/plan-eng-review` on 2026-07-08 while reviewing the share-link + boards/JSON-export design.

**Depends on / blocked by:** Share-link + JSON export/import (this branch) should land first.

## Color-set expansion for Create variety

**What:** Add 3-5 new ColorSets beyond bklyn-clay so the rolodex (and gallery hue chips) cover more of the color wheel.

**Why:** The app generates exclusively from one muted palette (clays, neutrals, mosses, denims). Cross-model review (2026-07-10) showed several OKLCH hue families (pink, cyan, saturated red/purple) are unreachable, so hue filter chips can match nothing and the rolodex reads as one narrow color mood.

**Pros:** More perceived range in Create; hue chips stop matching nothing; improves the product independent of any feature.

**Cons:** Curation time, not code time — each set should be as considered as bklyn-clay.

**Context:** `src/lib/colorSets.ts` has exactly one set; `generateGradientStops` draws only from the active set; gallery chips use OKLCH buckets with a chroma floor (c > 0.06) matched on the highest-chroma stop. Start by sketching sets around the missing buckets. Surfaced during /plan-eng-review of the tool-first design (D7/D17).

**Depends on / blocked by:** Nothing — independent of PR1.

## Canvas export presets (deferred PR2)

**What:** PNG export at 1179×2556 (iPhone wallpaper) / 1080×1920 (story) / 1200×630 (og-image); base gradient only v1; iOS share-sheet download path.

**Why:** The wallpaper/poster use case from the tool-first design — approved, then gated on post-launch evidence of export demand (eng review D10, 2026-07-10).

**Pros:** Unlocks the graphic-design use case; the spec is already fully written in the design doc's Launch gate section.

**Cons:** Riskiest code in the plan: zero canvas code exists today; square/mirror/repeat gradient types need custom paint math; angular needs createConicGradient (+ fallback); requires on-device iOS Safari testing.

**Context:** `src/lib/gradient.ts` has a `sampleGradient` per-pixel function mirroring the CSS math, which de-risks the port. Full spec: ~/.gstack/projects/matthewlew-palette/matthewlew-main-design-20260709-discovery-first-curated-feed.md (Launch gate section).

**Depends on / blocked by:** PR1 shipped + launch + evidence visitors want exports.

## Gallery accessibility + responsive spec (design debt, deferred from PR1)

**What:** Keyboard grid navigation (arrows/Enter/Esc), screen-reader roles (segments as tablist, viewer as aria-modal dialog, tiles labeled "name, type gradient" + "picked"), 44px touch targets on chips, column ladder 2/<600 3/600+ 4/1000+ 5/1400+, and a 4.5:1 contrast guarantee for the tile caption scrim.

**Why:** Explicitly deferred during /plan-design-review (2026-07-10, D11). Without it the Gallery is unusable by keyboard and screen-reader users and text on light gradients can go illegible.

**Pros:** Spec is fully written — implementation is composition of existing patterns (SavedBrowser breakpoint ladder, glassToneAt). CC: ~20-30min.

**Cons:** None beyond the implementation time.

**Context:** Full spec in the design-review session and referenced from the design doc's "Deferred by choice (D11)" bullet (~/.gstack/projects/matthewlew-palette/matthewlew-main-design-20260709-discovery-first-curated-feed.md).

**Depends on / blocked by:** PR1 Gallery shipped.

## Cap share-link payload sizes

**What:** Enforce upper bounds when importing share links / JSON: max gradients per board, max stops per gradient, max name length.

**Why:** Adversarial review (2026-07-10, /ship of chore/remove-smooth-fluted) noted nothing caps payload sizes. A crafted link with a multi-megabyte name or 100k stops, once confirmed into the board, can blow the localStorage quota (zustand persist then fails silently) and generates megabyte CSS strings on every render.

**Pros:** Closes the last known abuse path in the import surface; tiny change (a few guards in `isSharePayloadGradient`).

**Cons:** Needs sensible limits chosen (e.g. 50 gradients, 32 stops, 80-char names) — too tight and legitimate boards fail to import.

**Context:** `src/lib/gradientCodec.ts` — the validator already rejects bad hex/positions/types after the hardening commit; this adds size bounds on top.

**Depends on / blocked by:** Nothing.
