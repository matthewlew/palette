# Design: aesthetic scoring for gradient generation

Date: 2026-07-08
Branch: `explore/glaze-scoring-weighting`
Related: [2026-07-08-bklyn-clay-scoring-research.md](2026-07-08-bklyn-clay-scoring-research.md)

## Problem

`generateGradientStops` (`src/lib/palette.ts`) picks colors from a
`ColorSet` uniformly at random and jitters them in OKLCH, with no notion
of whether the result looks good. Bklyn Clay (`bklynclay-glaze`) solves
this for glaze palettes with a 7-factor weighted aesthetic score. This
design ports the applicable parts of that model, recalibrated against
this user's actual preferences (determined via a blind visual A/B/C
ranking exercise — see Calibration below), and wires it into generation
so output quality improves without adding any visible UI.

## Calibration findings

Two rounds of blind gradient ranking (8 strategies, then 6 more isolating
hue relationship from lightness range) established, in order of
confidence:

1. **Lightness range is the dominant preference.** Every palette that
   spanned dark→light won its round; every narrow-range or clustered
   palette lost, regardless of hue content.
2. **Raw hue variety beats formula-matched harmony.** A wide random hue
   scatter outranked analogous and triadic sets even when lightness range
   was held equal. Complementary did get a mild boost over analogous/
   triadic, so hue-harmony isn't worthless — just secondary.
3. **Near-duplicate hues are penalized independent of lightness range** —
   confirms a minimum-pairwise-distance factor is warranted.
4. **Muddy/near-achromatic palettes are penalized independent of range** —
   confirms an achromatic-count penalty is warranted.
5. Saturation contrast read as a mild positive but wasn't isolated in
   testing — lowest-confidence factor, kept at a modest weight.

This inverts Bklyn Clay's own emphasis (which weights harmony highly in
its "Harmony" preset) — this user's taste rewards dispersion over
formula-fit, so hue harmony is carried over but demoted rather than
dropped.

## Non-goals

- No UI surfacing of the score (number, badge, sort control). Score is
  internal to generation only.
- No `SCORE_PRESETS`-style swappable weight sets — `palette` has no
  per-project concept to hang presets on, and only one weighting was
  calibrated. A single fixed default weight set.
- No `f3` (lightness-balance-around-midpoint) or `f6` (material variety)
  factors — f3 wasn't part of the calibration and f6 has no equivalent
  (no finish/material concept in `palette`'s color model).
- No affinity/liked-palette feedback loop (Bklyn Clay's
  `buildGlazeAffinity`) — out of scope, no liked/kept concept exists in
  `palette` yet. This design is scoped to the smaller, self-contained
  "score what gets generated" step only, per the prior research note.

## Architecture

New pure module `src/lib/paletteScore.ts`, following the existing
`src/lib` convention (pure functions, no DOM/global state, colocated
`.test.ts`).

### Factor functions

Each takes `Oklch[]` and returns a value normalized to `[0, 1]`:

- `saturationSpread(colors)` — stddev of chroma, normalized against an
  empirically reasonable ceiling. (f1, weight 0.12)
- `lightnessRange(colors)` — `max(l) - min(l)`, normalized. (f2, weight
  0.35 — dominant per calibration)
- `minPairwiseDistance(colors)` — minimum OKLCH perceptual distance
  across all pairs, combining circular hue distance + lightness delta +
  chroma delta (same weighting shape as Bklyn Clay's f4: hue 0.35 /
  lightness 0.45 / chroma 0.20), normalized. (f4, weight 0.30)
- `hueHarmony(colors)` — best-of analogous/complementary/triadic hue fit,
  ported near-verbatim from Bklyn Clay's `harmonyScore`/`circularSpan`
  (operates on hue degrees, portable as-is). (f5, weight 0.08 — demoted
  per calibration)
- `achromaticPenalty(colors)` — penalizes palettes with more than one
  low-chroma (near-gray) color, same shape as Bklyn Clay's f7. (f7,
  weight 0.15)

### Combinator

```ts
export const DEFAULT_SCORE_WEIGHTS = {
  lightnessRange: 0.35,
  minPairwiseDistance: 0.30,
  achromaticPenalty: 0.15,
  saturationSpread: 0.12,
  hueHarmony: 0.08,
}

export function scorePalette(colors: Oklch[], weights = DEFAULT_SCORE_WEIGHTS): number
```

Returns 0–100 (weighted sum × 100, matching Bklyn Clay's scale). Requires
`colors.length >= 2`; returns 0 otherwise (matches existing
`generateGradientStops` minimum of 3, so this won't trigger in practice
but keeps the function safe standalone).

### Generation integration

`generateGradientStops` in `src/lib/palette.ts` changes internally, no
signature change:

1. Build 8 candidate stop-sets using the existing `pickRandom` + `jitter`
   logic (same as today, just repeated).
2. Score each candidate's color list with `scorePalette`.
3. Weighted-random select one candidate, using `score²` as the sampling
   weight (squaring sharpens the bias toward higher scorers while
   remaining stochastic — mirrors Bklyn Clay's `weightedPick` philosophy
   without collapsing to a deterministic best-of-N).
4. Map the selected candidate's colors to `GradientStop[]` exactly as
   today (hex conversion, even position spacing).

`N = 8` and the `²` exponent are implementation constants, not exposed —
tunable later if generation feels too samey or too random in practice.

## Testing

- `paletteScore.test.ts`: each factor function against known-good/
  known-bad OKLCH fixtures mirroring the calibration findings (e.g.
  four same-hue similar-lightness colors → low `minPairwiseDistance`;
  a dark→light spanning set → high `lightnessRange`; ≥2 near-gray colors
  → reduced `achromaticPenalty` score).
- `palette.test.ts`: statistical assertion that `generateGradientStops`,
  run many times (e.g. 200 iterations) against `DEFAULT_COLOR_SET`,
  produces a materially higher average `scorePalette` than a baseline of
  plain `pickRandom` + `jitter` without the weighted-candidate step —
  proves the integration actually shifts output quality, not just that
  the scorer works in isolation.

## Open questions / explicitly deferred

- Whether `N=8` and the `²` weighting exponent feel right in practice —
  can only be judged by using it, not by further calibration rounds.
- Whether this should eventually gain a liked/kept-palette affinity loop
  (Bklyn Clay's other half) — deferred per Non-goals, would be its own
  design.
