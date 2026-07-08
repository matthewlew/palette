# TODOS

## Hosted cross-device board sync

**What:** Sync the `saved` gradients board across devices without manual JSON export/import — an account + small backend that a board follows automatically.

**Why:** Today, moving a board to another device means exporting JSON and importing it manually (see the share-link + JSON export work on `feat/full-palette-ux-improvements`). That's fine for a one-off share, but tedious for someone who wants their board to just be there on a new device.

**Pros:** Real cross-device continuity; no file hand-off step; natural next step once accounts exist for any other reason.

**Cons:** This is currently a no-backend static SPA (Vite + Zustand persist to localStorage only). Adding accounts + a backend is a big step up in infrastructure and ongoing maintenance for a solo side project — not proportional unless there's real demand for it.

**Context:** Reuses the same `gradientCodec.ts` plain-object shape built for share links/export, so the wire format is already solved — only the sync/auth layer is new. Surfaced during `/plan-eng-review` on 2026-07-08 while reviewing the share-link + boards/JSON-export design.

**Depends on / blocked by:** Share-link + JSON export/import (this branch) should land first.
