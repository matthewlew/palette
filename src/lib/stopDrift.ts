import type { GradientStop, GradientType } from './gradient'

/* Slow, endless motion for a gradient's stops.
 *
 * Only POSITIONS move. The hexes are untouched, so an animating gradient is
 * always still the palette the user chose — it is the same colors breathing,
 * not a different gradient. That is what makes it usable as a wallpaper rather
 * than as an effect.
 *
 * Everything here is a pure function of (stops, elapsed ms). No internal state,
 * no Math.random, so the same moment always renders the same frame — which is
 * what lets it be unit-tested, and what lets a paused animation resume without
 * a jump. */

/** Slowest and fastest a stop may travel, as the time for one full cycle.
 * Both are deliberately far slower than a UI animation: at 17s the motion is
 * still readable as movement, and by 40s a stop is drifting at the edge of
 * perception, which is where the ambient quality comes from. */
const PERIOD_MIN_MS = 17_000
const PERIOD_SPREAD_MS = 23_000

/** Ceiling on how far a stop may travel from home, in position units (0–100).
 * The real limit is usually the neighbour clamp below; this only caps stops
 * that have lots of room. */
const MAX_AMPLITUDE = 6

/** Fraction of the distance to its nearest neighbour a stop may use. Below 0.5
 * two adjacent stops travelling toward each other can never meet, so the ramp
 * can never invert or collapse to a hard edge mid-animation. */
const NEIGHBOUR_HEADROOM = 0.42

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
  return Math.max(0, Math.min(MAX_AMPLITUDE, room * NEIGHBOUR_HEADROOM))
}

/**
 * The gradient's stops as they sit `elapsed` ms into the animation.
 *
 * Each stop rides its own sine wave, so the ramp breathes unevenly rather than
 * sliding as a unit. Amplitude is bounded per stop by the distance to its
 * nearest neighbour, which means a tightly clustered pair (palette allows two
 * stops half a unit apart) barely moves — correctly, since moving it would
 * redraw the design rather than animate it.
 */
export function driftStops(stops: readonly GradientStop[], elapsedMs: number): GradientStop[] {
  return stops.map((stop, i) => {
    const amplitude = amplitudeFor(stops, i)
    if (amplitude === 0) return { ...stop }
    const angle = (elapsedMs / periodFor(i)) * Math.PI * 2 + phaseFor(i)
    const position = stop.position + Math.sin(angle) * amplitude
    // The clamp is a backstop; the amplitude bound already keeps this in range.
    return { ...stop, position: Math.min(100, Math.max(0, position)) }
  })
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
