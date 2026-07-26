# Gradient Smoothing ("Smooth" toggle) — Design

## Problem

Gradients render today as plain CSS stops (`#hex position%`), leaving the browser
to interpolate linearly in **sRGB**. This produces two visible artifacts:

1. **A defined seam / break-line at every stop.** Color is continuous across a
   stop but its *rate of change* is not — that first-derivative discontinuity
   reads as a Mach-band line. With a contrasting middle color it's most obvious:
   two hard break-lines on either side of the middle stop.
2. **Muddy / dark midpoints.** sRGB interpolation drives two-color blends through
   desaturated gray (e.g. indigo→gold passes through `#926a57` brown-gray).

We want an **opt-in** setting (conceptually like the existing noise/grain toggle)
that makes a gradient's transitions read as seamless.

## Chosen approach

Decouple the two effects and fix each with the right tool. This was validated
visually against alternatives (sRGB-linear, OKLCH+ease, sRGB+ease, Oklab+ease):

- **Ease the stop distribution (smoothstep).** Supersample each adjacent color
  pair into ~16 intermediate stops whose interpolation parameter follows
  `smoothstep(t) = t·t·(3 − 2t)`. Because the derivative of smoothstep is zero at
  each endpoint, the rate of color change goes to zero at every stop — the
  Mach-band seam disappears.
- **Blend color in Oklab (rectangular L/a/b).** Interpolating in Oklab travels a
  straight line in a perceptual space. It does **not** loop around the hue wheel
  the way OKLCH (polar) does, so it never invents in-between hues that weren't in
  the palette — while still giving more even lightness than raw sRGB (fixes
  black→white bunching). This was the explicitly chosen option ("E") over
  sRGB+ease and over OKLCH+ease (which was rejected for phantom hues).

Endpoints are always the user's exact chosen colors; only the in-between samples
are synthesized.

### Why not just use CSS `linear-gradient(in oklab, …)`?

CSS native interpolation color spaces (`in oklab`, `in oklch`) fix the color path
but do **not** ease the stop distribution — the seam/Mach-band remains, and the
easing is the part the user most wanted. Supersampling gives us both in one
mechanism and keeps behavior identical across every geometry and the SVG export
path (SVG has no `in oklab` support at all).

## Scope of application

Smoothing applies to the continuous-blend geometries:
**linear, radial, mirror, repeat, fan, angular.**

- **square (Turrell)** is skipped — it paints solid nested blocks, not a blend.
- **hard** is the conceptual opposite (crisp bands). The two are **mutually
  exclusive**: in render, if both flags are set, `hard` wins; in the UI, turning
  one on turns the other off.

## Components & changes

### 1. `src/lib/oklch.ts`
- Add `blendOklabHex(hexA, hexB, t)`: convert both hexes to Oklab (reuse the
  existing linear-sRGB↔Oklab machinery — stop before the polar OKLCH conversion),
  lerp `L`/`a`/`b` rectangularly, convert back to hex.

### 2. `src/lib/gradient.ts`
- Add `SMOOTH_SAMPLES_PER_SEGMENT = 16` (module constant, tunable).
- Add `smoothStops(stops: GradientStop[]): GradientStop[]`: for each adjacent
  pair, emit `SMOOTH_SAMPLES_PER_SEGMENT` samples at smoothstep-eased parameter,
  colored via `blendOklabHex`, positioned linearly across the pair's span. Drop
  the duplicate seam stop where segments meet. Returns a denser positioned list.
  - Guard: `stops.length < 2` returns input unchanged.
- Add `smooth?: boolean` to the `GradientFilters` interface.
- In `buildGradientCss`: apply `smoothStops` as the **final** stop transform for
  the in-scope geometries, skipped when `filters.hard` is set and skipped for
  `square`. Threaded so mirror/repeat/fan/angular (which build their own
  positioned sequences) are smoothed on their final sequence, not before.

### 3. `src/store/types.ts`
- Add `smoothEnabled?: boolean` to `Gradient`, documented alongside
  `repeatEnabled` / `hardStops`.

### 4. `src/lib/gradientCodec.ts`
- Encode, decode, and validate `smoothEnabled` exactly as `hardStops` is handled
  (share-link round-trip). **Not** written to the Supabase published row — matches
  `hardStops`, so no DB migration.

### 5. `src/lib/gradientSvg.ts` (vector export parity)
- In `effectiveStops`, apply `smoothStops` when `gradient.smoothEnabled` (and not
  `hardStops`) in the default / mirror / repeat branches, so pasted SVG matches
  the on-screen render. `square` branch unchanged.

### 6. `src/lib/canvasExport.ts` (raster/PNG export parity)
- After the reversed/repeat/hard preprocessing (currently lines ~56-63), apply
  `smoothStops` to the working `stops` when `gradient.smoothEnabled` and not
  `hardStops`, so exported PNGs (IG posts/posters) match the on-screen render for
  the addColorStop-based paths. Mirrors the CSS scope (skipped for square).

### 7. UI wiring
- **`src/components/GeometryTabs.tsx`**: this is where the Repeat/Hard filter
  chips live. Add a **"Smooth"** chip button (same markup as the Hard chip,
  `data-testid="filter-smooth"`, `aria-pressed={gradient.smoothEnabled}`),
  disabled only for `square`. Pass `smooth: gradient.smoothEnabled` into the
  per-tab preview `buildGradientCss` filters here too. Add an `onToggleSmooth?`
  prop.
- **`src/components/EditMode.tsx`**: add `handleToggleSmooth` →
  `commitPreservingPositions({ smoothEnabled: !gradient.smoothEnabled, hardStops: false })`,
  and make `handleToggleHardStops` also clear `smoothEnabled` (mutual exclusion).
  Add `smoothEnabled` to the `commitPreservingPositions` `overrides` Pick type.
  Pass `smooth: gradient.smoothEnabled` into the preview `buildGradientCss`
  filters, and pass `onToggleSmooth={handleToggleSmooth}` to `<GeometryTabs>`.
- **All other `buildGradientCss` call sites** (Gallery, ExportModal,
  ShapePreviews, GradientPage, CollectionsRow, Drawer, SavedBrowser, TabBar)
  pass `smooth: gradient.smoothEnabled` so every preview reflects the setting.

## History note

A prior `smooth`/`fluted` filter pair existed and was removed in commit `9cb40d2`
("didn't add anything visually useful"). The old `smoothenStops` used the same
`easeInOut` curve but blended in **OKLCH** (polar) — which introduces phantom
in-between hues (validated as the rejected option during design). This design
deliberately differs by blending in **Oklab** (rectangular), plus more samples
and full export parity. Reintroducing `smoothEnabled` in the codec means old
share links carrying the flag will once again render smoothed — acceptable, as
it's the same concept.

## Non-goals

- **`gradientColorAt`** (chrome-tone picking) stays as-is. It only needs an
  approximate tone and endpoints are unchanged by smoothing.
- **Supabase persistence** of `smoothEnabled` — out of scope (matches `hardStops`).
- Making smoothing the default. It is opt-in, off by default.

## Performance

Measured build cost (Oklab math included): ~3.6 µs for a 2-color gradient,
~15 µs for a 5-color gradient at 16 samples/segment — ~0.09% of one 60fps frame,
even on the per-frame edit-mode animation path. Paint cost of 17–65 stops on a
CSS gradient is negligible. Off by default, so unenabled gradients pay nothing.

## Testing

- `smoothStops`: endpoints preserved (first/last hex+position unchanged),
  positions strictly monotonic non-decreasing, expected sample count,
  `< 2` stops passthrough.
- `blendOklabHex`: `t=0`→A, `t=1`→B, midpoint stays in-gamut and does not
  introduce a hue absent from both ends (e.g. green↔magenta midpoint is not cyan).
- `gradientCodec`: round-trip `smoothEnabled` (encode→decode) and validation.
- `gradientSvg`: smoothed gradient emits the supersampled `<stop>` list.

Deploy is gated on green `npm test`, so all of the above must pass before ship.
