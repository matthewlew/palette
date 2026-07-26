import { blendOklabHex } from './oklch'
import type { GradientStop, GradientType } from './gradient'

/* Slow, endless motion for a gradient's stops.
 *
 * Stops MOVE and they CROSS. When two of them meet they trade places, so the
 * ramp genuinely reorders over a cycle rather than breathing in place — that is
 * what stops a long-running gradient reading as static.
 *
 * Colours are touched only in the moment of a crossing. As a pair converges the
 * two dissolve toward each other, so at coincidence they are the same colour and
 * there is no hard edge; as they separate the swap has already happened. Away
 * from a crossing every stop is exactly the hex the user chose, and because the
 * motion is sinusoidal the palette returns home every cycle.
 *
 * This is a deliberate reversal. The first version clamped amplitude below half
 * the neighbour gap precisely so stops could never meet, on the grounds that a
 * converging pair collapses to a hard edge. That is true of a naive crossing —
 * the dissolve is what makes it survivable.
 *
 * Everything here is a pure function of (stops, elapsed ms). No internal state,
 * no Math.random, so the same moment always renders the same frame — which is
 * what lets it be unit-tested, and what lets a paused animation resume without
 * a jump. */

/** Slowest and fastest a stop may travel, as the time for one full cycle.
 * Both are deliberately far slower than a UI animation, and were lengthened
 * again when crossing arrived. What the eye reads as aggression is SPEED, not
 * travel — amplitude/period — so raising amplitude 6 -> 26 without touching the
 * period made stops move 5.4x faster than the original ambient tuning. Slowing
 * the cycle keeps the crossings; cutting amplitude back would remove them.
 *
 * Measured at 43-101s: peak 3.2 position-units/sec, 2.0x the pre-crossing feel
 * rather than 5.4x, and still 84 reorders per ten minutes across five ramp
 * shapes. Halving these again lands near the original speed but roughly halves
 * the crossings too. */
const PERIOD_MIN_MS = 43_000
const PERIOD_SPREAD_MS = 58_000

/** Ceiling on how far a stop may travel from home, in position units (0–100).
 * Raised from 6, which was tuned for breathing-in-place. Two adjacent stops a
 * gap G apart cross only when 2A > G, so the ceiling decides which ramps can
 * reorder at all. At 6 nothing did; at 18 a 40-unit gap still closed to 4 and
 * stopped — measured, not guessed. 26 crosses gaps up to ~52, which covers the
 * ordinary 3–5 stop ramp, while a very wide pair still just breathes. The rate
 * stays gentle: a full cycle is 17–40s. */
const MAX_AMPLITUDE = 26

/** Fraction of the distance to its nearest neighbour a stop may use. Above 0.5,
 * so two stops travelling toward each other MEET and pass; the old value of 0.42
 * was chosen to guarantee they never could. */
const NEIGHBOUR_REACH = 0.95

/** Separation, in position units, at which a converging pair starts to dissolve
 * into each other. Wide enough that the swap reads as a fade rather than a cut,
 * narrow enough that stops show their own colour the rest of the time. */
const DISSOLVE_WINDOW = 8

/** Smoothstep, so the dissolve eases in and out instead of ramping linearly —
 * a linear fade still announces its start and end. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Per-stop period. Index-derived via an odd multiplier so adjacent stops never
 * share a speed — if they did they would move in lockstep and the whole ramp
 * would just slide, which reads as a scroll rather than as drift. */
function periodFor(index: number): number {
  return PERIOD_MIN_MS + ((index * 7919) % PERIOD_SPREAD_MS)
}

/** Per-stop phase offset, so stops do not all start at the same point in their
 * cycle (which would make the first few seconds look synchronised). */
function phaseFor(index: number): number {
  return ((index * 2654435761) % 997) / 997 * Math.PI * 2
}

/** How far stop `i` may move without being able to reach a neighbour.
 * The ends measure against the 0 and 100 boundaries instead. */
export function amplitudeFor(stops: readonly GradientStop[], index: number): number {
  const here = stops[index].position
  const leftGap = index === 0 ? here : here - stops[index - 1].position
  const rightGap = index === stops.length - 1 ? 100 - here : stops[index + 1].position - here
  const room = Math.min(leftGap, rightGap)
  return Math.max(0, Math.min(MAX_AMPLITUDE, room * NEIGHBOUR_REACH))
}

/**
 * The gradient's stops as they sit `elapsed` ms into the animation.
 *
 * Each stop rides its own sine wave, so the ramp reorders unevenly rather than
 * sliding as a unit. Adjacent stops are then dissolved through any crossing, and
 * the result is sorted — CSS requires ascending positions, and after a crossing
 * the input order is no longer ascending.
 */
export function driftStops(stops: readonly GradientStop[], elapsedMs: number): GradientStop[] {
  const moved = stops.map((stop, i) => {
    const amplitude = amplitudeFor(stops, i)
    if (amplitude === 0) return { ...stop }
    const angle = (elapsedMs / periodFor(i)) * Math.PI * 2 + phaseFor(i)
    const position = stop.position + Math.sin(angle) * amplitude
    return { ...stop, position: Math.min(100, Math.max(0, position)) }
  })

  // Dissolve converging pairs.
  //
  // Only ADJACENT pairs, and adjacent by the ORIGINAL index rather than by
  // current position: those are the two that are actually trading places. Using
  // current neighbours would re-pair the stops mid-crossing and blend a stop
  // against whichever one it had just passed.
  //
  // Both sides read from `moved`, never from the partially blended output, so
  // the fade is symmetric — at coincidence each is the same 50/50 mix and the
  // pair is one colour, which is the whole point: no hard edge to cut through.
  const blended = moved.map((s) => ({ ...s }))
  for (let i = 0; i < moved.length - 1; i++) {
    const separation = Math.abs(moved[i].position - moved[i + 1].position)
    if (separation >= DISSOLVE_WINDOW) continue
    const t = 0.5 * smoothstep(1 - separation / DISSOLVE_WINDOW)
    blended[i].hex = blendOklabHex(moved[i].hex, moved[i + 1].hex, t)
    blended[i + 1].hex = blendOklabHex(moved[i + 1].hex, moved[i].hex, t)
  }

  return blended.sort((a, b) => a.position - b.position)
}

/** Types whose CSS is actually built from stop positions.
 *
 * Two are not, and drifting them would be a no-op the user could see the button
 * for but never the effect of:
 *   angular — spreads colours evenly around the circle by INDEX (i/n), so it
 *             discards positions entirely
 *   square  — Turrell blocks, painted by their own component, not by a
 *             background gradient
 * linear, radial, fan, mirror and repeat all derive their CSS from position. */
const POSITION_DRIVEN: ReadonlySet<GradientType> = new Set([
  'linear', 'radial', 'fan', 'mirror', 'repeat',
] as GradientType[])

export function isDriftableType(type: GradientType): boolean {
  return POSITION_DRIVEN.has(type)
}

/** True when this gradient can visibly animate: the geometry has to be built
 * from positions, and at least one stop needs room to move. A ramp whose stops
 * are all bunched together animates to nothing, and the button should say so
 * rather than appear broken. */
export function canDrift(stops: readonly GradientStop[], type: GradientType): boolean {
  return isDriftableType(type) && stops.some((_, i) => amplitudeFor(stops, i) > 0.25)
}
