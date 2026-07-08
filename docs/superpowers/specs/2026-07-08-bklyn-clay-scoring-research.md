# Research note: Bklyn Clay's gradient weighting & rating model

Date: 2026-07-08
Branch: `explore/glaze-scoring-weighting`
Status: research only — no implementation planned yet

## Why

`palette`'s current generation path (`src/lib/palette.ts`) is fully unweighted:
`generateGradientStops` picks random colors from a `ColorSet` and jitters
them in OKLCH. There is no notion of "this palette is better than that one,"
and no feedback loop from what a user keeps/likes back into what gets
generated next. Bklyn Clay (`~/Documents/bklynclay-glaze`) solves both
problems for its glaze palettes, so it's worth understanding before deciding
whether/how to bring anything similar into `palette`.

## What Bklyn Clay does

Two independent, composable mechanisms, both in `scoring.js`:

### 1. Generation-time weighting (steers *what gets picked*)

- `scoreGlaze(glaze, levers)` — a per-glaze preference score driven by three
  0–100 UI sliders (temperature, depth, character). Warm/cool hue bands,
  luminance, and saturation each get pushed up or down depending on lever
  position.
- `buildGlazeAffinity(rankedMeta)` — turns a user's drag-ranked list of
  pinned palettes into a per-glaze-name multiplier (0.5x–2x, mean-normalized
  to 1). Glazes that cluster near the top of the ranking get boosted;
  glazes near the bottom get suppressed. This is the feedback loop: rank
  palettes once, and every future generation is nudged toward the glazes
  that showed up in your favorites.
- `weightedPick(pool, scores, n)` — weighted-random sampling (not top-N),
  so generation stays random/exploratory rather than collapsing onto a
  single "best" combination.
- Final per-glaze weight fed into the sampler is `scoreGlaze(...) *
  affinity(...)` — lever intent and historical preference compound
  multiplicatively.

### 2. Post-hoc aesthetic scoring (ranks *what got generated*)

`scoreAesthetic(glazes, weights)` — a 0–100 score from seven independent
factors, each normalized to [0,1] and combined as a weighted sum:

| Factor | Measures |
|---|---|
| f1 | saturation spread (stddev) |
| f2 | lightness range (rewards banding/stripe repeats specially) |
| f3 | lightness balance around a mid-point target |
| f4 | minimum pairwise perceptual distance (hue+lum+sat weighted) — penalizes near-duplicate colors |
| f5 | hue harmony (best-of: analogous / complementary / triadic fit) |
| f6 | material/finish variety |
| f7 | achromatic penalty (too many low-saturation colors) |

Weights are swappable presets (`SCORE_PRESETS`: Balanced, Banding, Harmony,
Contrast, MaterialMix) — same seven factors, different emphasis, selected
per-project. This score sorts/filters the generated gallery; it does not
feed back into generation directly (that's `buildGlazeAffinity`'s job).

There's also a third, unrelated mechanism — `pairingScore` for 2-color
combinations, and a card-sort UI (`view-rating.js` + `summarizeViewRatings`)
where users rank *rendering modes* (linear/radial/conic/turrell/etc.)
independent of color content, aggregated into avg-rank-per-mode.

## Mapping onto `palette`'s model

`palette` already has the substrate this would sit on top of:

- `ColorSet` (`src/lib/colorSets.ts`) is the equivalent of Bklyn Clay's
  glaze pool — a natural place to attach affinity weights.
- `Oklch` (`src/lib/oklch.ts`) is a better perceptual space than Bklyn
  Clay's raw hue/lum/sat fields for factors like f4 (min pairwise
  distance) and f5 (hue harmony) — those factors would likely be *more*
  accurate here, not less.
- `generateGradientStops` is the direct equivalent of `generatePalette`/
  `generateBandingPalette` — currently `pickRandom` + `jitter`, with no
  weighted sampling step to slot a scoring function into.
- There is no existing concept of "liked/kept palettes" or ranking UI in
  `palette` to source an affinity signal from — that would be new surface
  area, not a port.

## Open questions for a follow-up brainstorm (not answered here)

- Does `palette` want a *ranking* feature (scoreAesthetic-style, sorts a
  generated batch) or a *feedback loop* (affinity-style, requires a
  liked/kept concept that doesn't exist yet) or both?
- Bklyn Clay's f2/f6/f7 factors are glaze-specific (banding repeats,
  finish/material variety, achromatic glazes) — palette has no finish or
  banding concept, so a port would need to drop or reinterpret those.
- Multiple weight presets add UI surface (a preset picker) — worth it only
  if `palette` has enough per-project variety to warrant it.

## Recommendation

Don't port code directly. If `palette` wants this, the next step is a
proper brainstorm session scoped to one concrete decision from the open
questions above — most likely "add an aesthetic score to sort generated
gradients" as the smaller, self-contained first step, since it needs no new
liked/kept concept and can reuse OKLCH values already computed for each
stop.
