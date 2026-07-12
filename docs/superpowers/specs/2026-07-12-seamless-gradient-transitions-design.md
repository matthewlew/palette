# Seamless Gradient Transitions — Design

**Date:** 2026-07-12
**Status:** Approved (design), pending implementation plan
**Scope:** Create feed only (forward generation + settle transition)

## Problem

Scrolling the Create feed feels jerky. Two independent causes:

1. **Unrelated colors.** Each new gradient is generated with fully random colors
   (`Feed.tsx:207` → `makeGradient` → `generateGradientStops` off a random color
   set). Consecutive gradients have no relationship, so every step is a color jump.
2. **Instant swap.** `goTo` sets `displayed` to the next gradient with no tween, so
   the change cuts rather than flows.

Goal: neighboring gradients should share color proximity ("similar green turns
into the next similar green"), and the change between them should visibly *move*
rather than cut — while keeping the feed's snappy, haptic rolodex feel.

## Approach

Two composable levers, built in order:

### Lever A — Proximity sequencing (drift)

New module `driftGradientStops(prevStops: GradientStop[]): GradientStop[]`
(in `src/lib/drift.ts`, using `src/lib/oklch.ts`).

- Produces the next gradient's colors as a **bounded random-walk** from the current
  ones, per stop, in OKLCH space:
  - hue ±~20°, lightness ±0.05, chroma ±0.04 (clamped to valid/in-gamut ranges).
- **Stop count and positions are preserved** from the previous gradient — only the
  hex of each stop drifts. This is what makes the morph (Lever B) always valid.
- **Seeding:** the first gradient of a feed session still comes from
  `activeColorSet` (preserves the chosen mood). Every *forward* gradient after that
  drifts from the one before. `makeGradient`'s call site at `Feed.tsx:207` switches
  to the drift path when a previous gradient exists.
- Backward navigation replays persisted `feedSession.history` unchanged (drift only
  affects newly generated forward gradients).

### Lever B — Morph transition

New `useMorph` hook (or inline rAF controller) in `Feed.tsx`.

- On a **settled** step A→B, interpolate each stop with
  `blendOklchHex(a.hex, b.hex, t)` over **~300ms** with an ease-out curve,
  re-rendering the gradient CSS each `requestAnimationFrame`.
- Positions are constant across a drift step, so only color interpolates; the
  in-between frames are all valid gradients and the color flows.

## Edge cases (decided)

1. **Fast scroll / momentum → skip the morph.** During momentum scrolling or rapid
   discrete steps, snap instantly. The morph only plays when the user settles on a
   gradient. Preserves rolodex snappiness and keeps the haptic tick honest.
2. **Interrupting a morph** (a new step begins mid-animation) → cancel the running
   rAF and start a fresh morph *from the currently-rendered interpolated frame* to
   the new target. Never snaps back to A.
3. **Backward nav into structurally-different legacy history** (a pre-drift gradient
   whose stop count differs from the current frame) → morph requires equal stop
   counts; on mismatch, fall back to an instant swap. Forward drift always matches,
   so this only affects history generated before this feature.

## Guardrails / non-goals

- Touches only the Create feed's forward generation and the settle transition in
  `goTo`. **Untouched:** `cycleShape` (shape flips keep colors), saved gradients,
  Gallery, and Daily Drops.
- `prefers-reduced-motion` disables the morph (instant swap); drift sequencing still
  applies (it is not motion, just color choice).
- No ambient/idle self-animation in this iteration (was a considered option; cut for
  scope and mobile perf).

## Testing

- `drift.test.ts`: drifted stops preserve count and positions; each channel stays
  within its clamp; output stays in-gamut; determinism via injected RNG.
- Morph controller: interpolation endpoints (t=0 → A, t=1 → B); interruption starts
  from mid-frame; mismatched stop counts fall back to instant.
- Reduced-motion path skips the morph.

## Build order

1. `driftGradientStops` + tests.
2. Wire drift into `Feed.tsx:207` forward generation.
3. `useMorph` controller + settle detection + tests.
4. Wire morph into `goTo`, with momentum-skip and interruption handling.
5. Reduced-motion guard.
