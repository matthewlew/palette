

import { blendOklchHex, blendOklabHex, hexToSrgb } from './oklch'

export type GradientType = 'linear' | 'radial' | 'angular' | 'square' | 'mirror' | 'repeat' | 'fan'

/** Every geometry the user can select or cycle through, in display order.
 * The keyboard's ←/→ steps this whole list and GeometryTabs renders it, so
 * they can never drift out of sync. 'repeat' is intentionally absent — it's a
 * legacy type replaced by the Repeat×2 filter, reachable only via old saves. */
export const SELECTABLE_GEOMETRY: GradientType[] = ['linear', 'radial', 'angular', 'square', 'mirror', 'fan']

/** Display name per geometry — 'square' reads as "Turrell" everywhere in the
 * UI, not literally. Shared so GeometryTabs' tab labels and the Create feed's
 * subtitle (see lib/gradientSummary) can never name a shape differently. */
export const SHAPE_LABELS: Record<GradientType, string> = {
  linear: 'Linear',
  radial: 'Radial',
  angular: 'Angular',
  square: 'Turrell',
  mirror: 'Mirror',
  repeat: 'Repeat',
  fan: 'Fan',
}

export interface GradientStop {
  hex: string
  position: number // 0-100
  label?: string
}

/** Which edge the fan's 180° cone rises from. The pivot sits at the middle of
 * that edge and the visible semicircle faces inward. */
export type FanAnchor = 'bottom' | 'top' | 'left' | 'right'

export const FAN_ANCHORS: FanAnchor[] = ['bottom', 'top', 'left', 'right']

/** Where an un-rotated fan sits. Bottom, as it always has — see the note on
 * why a fan has no centre position. */
const FAN_DEFAULT = { at: '50% 100%', from: 270, span: 0.5, px: 0.5, py: 1 } as const

/**
 * Fan origin for an angle, on the SAME compass as getRadialConfig: 0 is top and
 * the cycle runs clockwise from there.
 *
 * This used to start at BOTTOM (0 = bottom, clockwise from there), so the
 * identical stored angle put a fan and a radial at opposite ends of the canvas
 * while sharing one rotate control. The eight geometries below are unchanged —
 * only which angle selects each one moved, by 180°.
 *
 * NO CENTRE POSITION, unlike radial and square. A fan is a cone with the last
 * colour held across the remainder, so there is always a wrap point where the
 * last colour meets the first. Pivoting on the boundary puts that wrap OFF the
 * canvas, which is the whole reason the construction looks seamless. From the
 * centre the entire circle is visible and the wrap is exposed: measured on a
 * red→green→blue ramp, the two sides of 12 o'clock come out #0003ff and
 * #ff0100 — a hard blue-to-red tear straight up the middle. Every boundary
 * pivot measures smooth there by comparison (#0bff00 vs #00ff06 at the bottom).
 * A seamless full-circle conic is what `angular` already is.
 */
export function getFanConfig(angle?: number) {
  if (angle == null) return { ...FAN_DEFAULT }
  // Map 0-360 degrees to one of 8 positions (steps of 45)
  const step = ((Math.round(angle / 45) * 45) % 360 + 360) % 360
  switch (step) {
    case 0: return { at: '50% 0%', from: 90, span: 0.5, px: 0.5, py: 0 } // top
    case 45: return { at: '100% 0%', from: 180, span: 0.25, px: 1, py: 0 } // top-right
    case 90: return { at: '100% 50%', from: 180, span: 0.5, px: 1, py: 0.5 } // right
    case 135: return { at: '100% 100%', from: 270, span: 0.25, px: 1, py: 1 } // bottom-right
    case 180: return { at: '50% 100%', from: 270, span: 0.5, px: 0.5, py: 1 } // bottom
    case 225: return { at: '0% 100%', from: 0, span: 0.25, px: 0, py: 1 } // bottom-left
    case 270: return { at: '0% 50%', from: 0, span: 0.5, px: 0, py: 0.5 } // left
    case 315: return { at: '0% 0%', from: 90, span: 0.25, px: 0, py: 0 } // top-left
    default: return { ...FAN_DEFAULT }
  }
}

/** The angle that reproduces a legacy `fanAnchor` under the new compass.
 * Fans saved before the origin cycle was unified carry an anchor and no angle;
 * mapping them here keeps them rendering exactly as they always have. */
const LEGACY_ANCHOR_ANGLE: Record<FanAnchor, number> = {
  top: 0, right: 90, bottom: 180, left: 270,
}

export const FAN_ANCHOR_CONFIG: Record<FanAnchor, { at: string; from: number; span: number; px: number; py: number }> = {
  bottom: { at: '50% 100%', from: 270, span: 0.5, px: 0.5, py: 1 },
  top: { at: '50% 0%', from: 90, span: 0.5, px: 0.5, py: 0 },
  left: { at: '0% 50%', from: 0, span: 0.5, px: 0, py: 0.5 },
  right: { at: '100% 50%', from: 180, span: 0.5, px: 1, py: 0.5 },
}

/** Types whose `angle` is an ORIGIN with a CENTRE position: the cycle runs
 * centre → 0 (top) → 45 → … → 315 → centre, nine positions.
 *
 * `fan` reads its angle as an origin on the same compass but is deliberately
 * absent: it has no centre position (see getFanConfig), so it cycles the eight
 * compass points. `linear` and the rest read `angle` as a plain rotation. */
const ORIGIN_TYPES: ReadonlySet<GradientType> = new Set(['radial', 'square'] as GradientType[])

/**
 * Where a gradient of this type starts when nothing else has said otherwise.
 *
 * `undefined` is CENTRE for the origin types — radial and Turrell — see
 * getRadialConfig. For every other type 0 is the natural default: linear's "to
 * bottom", angular's first wedge at the top.
 *
 * This exists because 0 means two different things. For linear it is the
 * default direction; for radial it is "origin at the TOP edge". A new radial
 * was already born centred, but a new Turrell was born at 0 and so lit from
 * the top, which reads as an off-centre accident rather than as the nested
 * squares the shape is for.
 */
export function defaultAngleForType(type: GradientType): number | undefined {
  return ORIGIN_TYPES.has(type) ? undefined : 0
}

/**
 * The angle to carry when the SHAPE changes under an existing gradient.
 *
 * Within a family it is kept: rotate a radial, switch to Turrell, and it stays
 * where you put it. Across the origin/direction boundary it resets to the new
 * type's default, because the number does not mean the same thing on both
 * sides — carrying linear's 0 into Radial silently reinterpreted it as "top",
 * so switching shape produced a burst pinned to the top edge.
 */
export function angleForTypeChange(
  from: GradientType,
  to: GradientType,
  angle: number | undefined,
): number | undefined {
  if (ORIGIN_TYPES.has(from) === ORIGIN_TYPES.has(to)) return angle
  return defaultAngleForType(to)
}

/**
 * The next angle for a 45° rotate step.
 *
 * Fan's compass was re-based to match radial's (0 = top, clockwise). It used to
 * start at bottom, so the same stored angle pointed a fan and a radial at
 * opposite edges of the canvas even though one control drives both.
 */
export function nextRotationAngle(type: GradientType, angle?: number): number | undefined {
  if (ORIGIN_TYPES.has(type)) {
    if (angle === undefined) return 0
    if (angle === 315) return undefined
    return (angle + 45) % 360
  }
  return ((angle ?? 0) + 45) % 360
}

/**
 * Rotating a fan also retires its legacy `fanAnchor`.
 *
 * An anchored fan resolves through LEGACY_ANCHOR_ANGLE so it keeps rendering as
 * it always has, but the anchor then shadows the angle. Dropping it on the
 * first rotate leaves the angle as the fan's only origin, so the two can never
 * disagree afterwards.
 */
export function nextFanRotation(angle?: number): { angle: number; fanAnchor: undefined } {
  return { angle: ((angle ?? 0) + 45) % 360, fanAnchor: undefined }
}

export function getRadialConfig(angle?: number) {
  if (angle == null) return { css: 'center', px: 0.5, py: 0.5 }
  const step = (Math.round(angle / 45) * 45) % 360
  switch (step) {
    case 0: return { css: 'top', px: 0.5, py: 0 }
    case 45: return { css: 'top right', px: 1, py: 0 }
    case 90: return { css: 'right', px: 1, py: 0.5 }
    case 135: return { css: 'bottom right', px: 1, py: 1 }
    case 180: return { css: 'bottom', px: 0.5, py: 1 }
    case 225: return { css: 'bottom left', px: 0, py: 1 }
    case 270: return { css: 'left', px: 0, py: 0.5 }
    case 315: return { css: 'top left', px: 0, py: 0 }
    default: return { css: 'center', px: 0.5, py: 0.5 }
  }
}

function assertStops(stops: GradientStop[]): void {
  if (stops.length < 2) {
    throw new Error('A gradient requires at least 2 stops')
  }
}

function stopsToCss(stops: GradientStop[]): string {
  return stops.map((s) => `${s.hex} ${s.position}%`).join(', ')
}

/** Smallest half-extent a Turrell layer may take, as a fraction of its reach.
 *
 * Was 0.2, which meant a stop dragged the full 0–100 only travelled 80% of the
 * range and the innermost block never shrank below a fifth of the canvas —
 * noticeably more damped than linear, radial or fan, which is what made the
 * control feel unresponsive by comparison. 0.1 lets a stop travel 90% of it.
 *
 * It stays well above 0 on purpose, and 0.05 was tried and rejected: layers are
 * blurred (24px by default), so a block only 5% of the canvas across is entirely
 * swallowed and the innermost colour disappears from the gradient. At 0.1 the
 * core still reads at the default blur. The extra 5% of travel is not worth
 * losing a colour. */
export const TURRELL_EXTENT_FLOOR = 0.1

/** A Turrell layer's half-extent for a stop position, as a fraction of the reach
 * to the farthest edge. Position 0 is the innermost block, 100 the outermost,
 * matching how radial reads.
 *
 * Single source for all four paths that paint or sample Turrell squares — the
 * component, the PNG export, this file's sampler, and (by hand, because it is a
 * separate Deno runtime) the preview edge function. Every one of those has
 * drifted from the others at least once. */
/** Turrell's default blur/softness, as a percentage of its container's
 * shorter edge (CSS `cqmin`) — resolution-independent by construction, unlike
 * a flat pixel radius. Was a hardcoded ~24px, which worked out to roughly
 * 4-6% of a typical canvas: high enough that the banded, concentric-square
 * character was barely legible from an oval-refit radial gradient at the
 * same blur. This lower value keeps the bands legible while still softening
 * the edges. Shared by the live TurrellSquare component (via CSS `cqmin`)
 * and canvasExport's Turrell path, so on-screen and exported renders match —
 * they used to diverge (a flat 24px on screen vs `24 * width/400` on
 * export), agreeing only at width=400. */
export const TURRELL_SOFTNESS_PERCENT = 1.75

export function turrellExtent(position: number, stopCount: number): number {
  if (stopCount <= 1) return 1
  return TURRELL_EXTENT_FLOOR + (position / 100) * (1 - TURRELL_EXTENT_FLOOR)
}

function buildSquareGradient(stops: GradientStop[]): string {
  const segmentCount = stops.length
  const degreesPerSegment = 360 / segmentCount
  const segments = Array.from({ length: segmentCount }, (_, i) => {
    const stop = stops[i]
    const start = i * degreesPerSegment
    const end = (i + 1) * degreesPerSegment
    return `${stop.hex} ${start}deg ${end}deg`
  })
  return `conic-gradient(${segments.join(', ')})`
}

/* ---- Conic geometries ----------------------------------------------------
 *
 * `angular` and `fan` are both conic-gradients, and they used to be written out
 * twice each: once to build the CSS, once again inside gradientColorAt to
 * sample it. The two copies drifted — gradientColorAt's fan hardcoded a 0.5
 * span and ignored `angle` entirely, so corner fans (span 0.25) and every
 * angle-driven fan sampled the wrong colour, which is what titleColorAt picks
 * the on-gradient ink against.
 *
 * The sequence builders below are now the single source for both paths.
 *
 * They are NOT merged into one geometry, and should not be. The two differ on
 * three axes, only one of which is origin:
 *   origin    angular is always centred; fan sits on an edge or corner
 *   sweep     angular covers the full circle and seams back to the first
 *             colour; fan compresses into a sector and the last colour holds
 *             the remainder
 *   positions angular IGNORES them (equal wedges by index, deliberately —
 *             see below); fan honours them
 * Merging would force one position model on both, and a flag to choose is just
 * the two geometries again with extra steps.
 */

/** Where angular places each stop around the circle, as a 0–100 offset.
 *
 * Positions used to be ignored entirely: colours were spread by index (i/n) so
 * that N colours read as N equal wedges, seam included. That held the wedges
 * even, but it also meant dragging a stop on an angular gradient emitted
 * byte-identical CSS — the control was inert, and drift had to disable itself
 * for the type because every frame rendered the same.
 *
 * Scaling by (n-1)/n keeps the even reading and restores the control. An
 * evenly-spaced ramp still lands exactly on i/n — 0/50/100 over three stops
 * gives 0/33.3/66.7, the seam taking the last 360/n — so the default is
 * unchanged and only a deliberately uneven ramp looks different. The factor is
 * what reserves the seam's wedge: positions span 0–100 but the circle has to
 * fit one more interval than the ramp has gaps. */
export function angularPositions(stops: GradientStop[]): number[] {
  const n = stops.length
  return stops.map((s) => (s.position * (n - 1)) / n)
}

/** Angular's stop sequence: the palette spread around the circle, plus the seam
 * wrapping back to the first colour. */
export function angularSequence(stops: GradientStop[]): GradientStop[] {
  const positions = angularPositions(stops)
  const spread = stops.map((s, i) => ({ hex: s.hex, position: Math.round(positions[i]) }))
  return [...spread, { hex: stops[0].hex, position: 100 }]
}

/** Fan's stop sequence: the palette compressed into the visible sector, plus
 * the last colour held across the remainder. */
export function fanSequence(stops: GradientStop[], span: number): GradientStop[] {
  const compressed = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position * span) }))
  return [...compressed, { hex: stops[stops.length - 1].hex, position: 100 }]
}

/**
 * The origin, start angle and sector a fan occupies. Both the render and the
 * sample path resolve through here, so they cannot disagree about the span.
 *
 * `angle` is the real control: null is centre, 0 is top, clockwise from there —
 * the same compass radial and square use.
 *
 * `anchor` is legacy and deprecated. It was only ever written as 'bottom' (no
 * UI ever set another value), so it carries a default rather than a choice. It
 * is still honoured for gradients saved before the cycle was unified, which
 * have an anchor and no angle — without it, every one of them would silently
 * become a centre fan. Once an anchored fan is rotated the anchor is dropped
 * (see nextFanRotation), which is what makes centre reachable.
 */
export function resolveFanConfig(anchor?: FanAnchor, angle?: number) {
  if (angle != null) return getFanConfig(angle)
  if (anchor) return getFanConfig(LEGACY_ANCHOR_ANGLE[anchor])
  return getFanConfig(undefined) // bottom, the historical default
}

function buildAngularGradient(stops: GradientStop[], hard = false, angle = 0, densify: Densifier = identityStops): string {
  if (hard) {
    // Solid wedges, each color filling up to the next stop's offset with a crisp
    // edge at the boundary (a double stop). The last wedge runs to the seam and
    // cuts straight back to the first. Boundaries come from angularPositions, so
    // hardened wedges track a dragged stop exactly as the blended ones do.
    const positions = angularPositions(stops)
    const segments = stops.map(
      (s, i) =>
        `${s.hex} ${Math.round(positions[i])}% ${Math.round(positions[i + 1] ?? 100)}%`,
    )
    return `conic-gradient(from ${angle}deg, ${segments.join(', ')})`
  }
  return `conic-gradient(from ${angle}deg, ${stopsToCss(densify(angularSequence(stops)))})`
}

function buildFanGradient(stops: GradientStop[], anchor: FanAnchor | undefined, angle: number | undefined, densify: Densifier = identityStops): string {
  const { at, from, span } = resolveFanConfig(anchor, angle)
  return `conic-gradient(from ${from}deg at ${at}, ${stopsToCss(densify(fanSequence(stops, span)))})`
}

export function applyReversed(stops: GradientStop[], reversed: boolean): GradientStop[] {
  if (!reversed) return stops
  // Swap which color sits at each position, but keep positions themselves
  // fixed — CSS gradient rendering is driven by position, not array order,
  // so reversing whole {hex, position} stop objects together is a no-op.
  const reversedHexes = [...stops].reverse().map((s) => s.hex)
  return stops.map((s, i) => ({ hex: reversedHexes[i], position: s.position }))
}

export function positionedStops(hexes: string[]): GradientStop[] {
  const count = hexes.length
  return hexes.map((hex, i) => ({
    hex,
    position: count === 1 ? 0 : Math.round((i / (count - 1)) * 100),
  }))
}

/** Mirror's stop sequence: the palette halved into 0–50, then reflected about
 * the 50% line.
 *
 * This used to normalize min–max onto a full 0–100 span before folding, which
 * made the whole geometry invariant to any shift or stretch of the ramp:
 * [0,50,100], [10,50,90] and [30,65,100] all emitted identical CSS, so dragging
 * either end stop was a no-op and interior stops moved at an unrelated rate.
 *
 * Halving directly restores that. An evenly-spaced ramp reaching 0 and 100 is
 * unchanged — [0,50,100] still gives 0/25/50/75/100 — so only ramps that do not
 * fill the span behave differently, which is exactly where the old normalization
 * was throwing information away.
 *
 * The normalization was there for a real reason: it guaranteed a stop landed on
 * the 50% fold, and without one the reflection left a gap. That is fixed here by
 * REFLECTING the last stop too, rather than by stretching the ramp to reach the
 * fold. A ramp ending at 70 folds at 35 and mirrors back at 65, holding its last
 * colour flat across the middle — a mirror with a plateau, which is what the
 * stop positions actually describe. The fold stop is dropped from the reflection
 * only when it sits exactly on 50 (i.e. the ramp reaches 100), where its
 * reflection would be a duplicate. */
export function mirrorSequence(stops: GradientStop[]): GradientStop[] {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const forward = sorted.map((s) => ({ hex: s.hex, position: s.position / 2 }))
  const fold = forward[forward.length - 1]
  const reflectable = fold.position === 50 ? forward.slice(0, -1) : forward
  const reverse = [...reflectable].reverse().map((s) => ({ hex: s.hex, position: 100 - s.position }))
  return [...forward, ...reverse]
}

function buildMirrorGradient(stops: GradientStop[], angle = 0, densify: Densifier = identityStops): string {
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(densify(mirrorSequence(stops)))})`
}

function buildRepeatGradient(stops: GradientStop[], angle = 0, densify: Densifier = identityStops): string {
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(densify(repeatedStops(stops)))})`
}

/** Cycles the stop sequence twice across the gradient — a "2x repeat"
 * filter. We insert a synthetic gap at the seam proportional to the average 
 * stop distance so it blends smoothly instead of cutting hard. */
export function repeatedStops(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 2) return stops
  const averageGap = 100 / (stops.length - 1)
  const scale = 100 / (100 + averageGap + 100)
  
  const first = stops.map((s) => ({ hex: s.hex, position: s.position * scale }))
  const offset = (100 + averageGap) * scale
  const second = stops.map((s) => ({ hex: s.hex, position: offset + s.position * scale }))
  
  return [...first, ...second]
}

/** Converts smooth blend points into hard color bands: each stop fills out
 * to the midpoint between it and its neighbors, so colors cut instead of
 * interpolating. Implemented via CSS's double-stop trick (same color at two
 * adjacent positions). */
export function hardenStops(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 2) return stops
  const result: GradientStop[] = []
  for (let i = 0; i < stops.length; i++) {
    const cur = stops[i]
    const start = i === 0 ? 0 : Math.round((stops[i - 1].position + cur.position) / 2)
    const end = i === stops.length - 1 ? 100 : Math.round((cur.position + stops[i + 1].position) / 2)
    result.push({ hex: cur.hex, position: start })
    result.push({ hex: cur.hex, position: end })
  }
  return result
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

function linearEase(t: number): number {
  return t
}

/** Interior samples inserted between each adjacent stop pair when smoothing. */
export const SMOOTH_SAMPLES_PER_SEGMENT = 16

/** Interior samples inserted between each adjacent stop pair by Prism. Matches
 * SMOOTH_SAMPLES_PER_SEGMENT: both are dense enough that the emitted stop list
 * reads as continuous rather than stepped. */
export const PRISM_SAMPLES_PER_SEGMENT = 16

/**
 * Shared machinery behind Smooth and Prism: the user's stops stay exactly where
 * they are, and between each adjacent pair we insert `samples` interior stops.
 * `blend` chooses the colour path between the pair, `ease` reshapes where along
 * that path each evenly-spaced interior position lands.
 */
function densifyStops(
  stops: GradientStop[],
  samples: number,
  blend: (a: string, b: string, t: number) => string,
  ease: (t: number) => number,
): GradientStop[] {
  if (stops.length < 2) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const result: GradientStop[] = [{ ...sorted[0] }]
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    for (let k = 1; k <= samples; k++) {
      const raw = k / (samples + 1)
      result.push({
        hex: blend(a.hex, b.hex, ease(raw)),
        position: Math.round((a.position + (b.position - a.position) * raw) * 10) / 10,
      })
    }
    result.push({ ...b })
  }
  return result
}

/** Densifies a stop list for seamless transitions. Interior stops' COLOR
 * follows an ease-in-out (smoothstep) curve, blended in Oklab. The eased
 * distribution drives the rate of color change to zero at every original stop —
 * dissolving the Mach-band seam — while Oklab blending avoids the phantom
 * in-between hues that polar OKLCH interpolation produces. */
export function smoothStops(stops: GradientStop[]): GradientStop[] {
  return densifyStops(stops, SMOOTH_SAMPLES_PER_SEGMENT, blendOklabHex, easeInOut)
}

/**
 * Densifies a stop list so the ramp travels the polar OKLCH arc instead of the
 * straight line in gamma-encoded sRGB a CSS gradient walks. Hue takes the
 * shorter way round the wheel between each pair, so two distant hues blend
 * THROUGH the hues that sit between them — orange to blue passes through green
 * — and mid-tones keep their chroma instead of desaturating toward the sRGB
 * midpoint. The emitted list is an ordinary CSS stop list, which is why this
 * works for every geometry and every crop with no separate rendering path.
 *
 * Unlike Smooth this does not ease: the point is the colour path, and easing
 * would additionally reshape the rate of travel along it.
 */
export function prismStops(stops: GradientStop[]): GradientStop[] {
  return densifyStops(stops, PRISM_SAMPLES_PER_SEGMENT, blendOklchHex, linearEase)
}

type Densifier = (stops: GradientStop[]) => GradientStop[]

const identityStops: Densifier = (stops) => stops

export interface GradientFilters {
  /** Cycles the stop sequence twice across the gradient, like the old
   * dedicated "repeat" type but layered on top of any geometry. */
  repeat?: boolean
  /** Renders solid color bands with hard cuts instead of smooth blends. */
  hard?: boolean
  /** Which edge a fan gradient rises from (ignored by other types). */
  fanAnchor?: FanAnchor
  /** Rotation angle in degrees. */
  angle?: number
  /** Densifies the blend with Oklab-eased interior stops so transitions are
   * seamless. Mutually exclusive with `hard`; ignored for `square`. */
  smooth?: boolean
  /** Densifies the blend with polar-OKLCH interior stops so the ramp travels
   * the hue arc. Mutually exclusive with `hard` and `smooth`; ignored for
   * `square`. */
  prism?: boolean
}

/** The single densification a filter set asks for, as a function to run over
 * the resolved stop list. `hard` wins over both (it is the opposite
 * instruction), then `smooth`; the UI keeps all three exclusive, so the order
 * only decides what a hand-crafted payload gets. Square is solid blocks with
 * no blend to densify. */
export function densifierFor(filters: GradientFilters, type?: GradientType): (s: GradientStop[]) => GradientStop[] {
  if (type === 'square' || filters.hard) return (s) => s
  if (filters.smooth) return smoothStops
  if (filters.prism) return prismStops
  return (s) => s
}

export function buildGradientCss(
  type: GradientType,
  stops: GradientStop[],
  reversed = false,
  filters: GradientFilters = {}
): string {
  assertStops(stops)
  let orderedStops = applyReversed(stops, reversed)

  // Turrell squares are already solid, non-interpolated blocks, and mirror/
  // legacy-repeat build their own position sequence from raw hex order —
  // the repeat/hard filters only make sense for types that render a genuine
  // continuous blend from `orderedStops` as given.
  if (type !== 'square' && type !== 'mirror' && type !== 'repeat') {
    // Repeat first: it rebuilds an even position sequence from hex order, so
    // hardening must run on the already-repeated stops for bands to stay even.
    if (filters.repeat) orderedStops = repeatedStops(orderedStops)
    // Angular hardens internally (its wedges are index-based, not position-
    // based, so a position-doubling harden here would be discarded).
    if (filters.hard && type !== 'angular') orderedStops = hardenStops(orderedStops)
  }

  // Smooth and Prism both densify the final blend, differing in the colour path
  // they walk; hard bands are the opposite instruction and win over both. None
  // of them mean anything for solid squares. See densifierFor.
  const densify = densifierFor(filters, type)
  const angle = filters.angle ?? 0
  switch (type) {
    case 'linear':
      return `linear-gradient(${180 + angle}deg, ${stopsToCss(densify(orderedStops))})`
    case 'radial': {
      const { css } = getRadialConfig(filters.angle)
      return `radial-gradient(circle at ${css}, ${stopsToCss(densify(orderedStops))})`
    }
    case 'angular':
      return buildAngularGradient(orderedStops, filters.hard, angle, densify)
    case 'square':
      return buildSquareGradient(orderedStops)
    case 'mirror':
      return buildMirrorGradient(orderedStops, angle, densify)
    case 'repeat':
      return buildRepeatGradient(orderedStops, angle, densify)
    case 'fan':
      return buildFanGradient(orderedStops, filters?.fanAnchor, filters?.angle, densify)
  }
}

/** Interpolates the color a stop sequence renders at normalized offset t
 * (0-1). Duplicate positions (hardened stops) resolve to piecewise-constant
 * bands, matching CSS. */
export function sampleStops(stops: GradientStop[], t: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const p = Math.min(100, Math.max(0, t * 100))
  if (p <= sorted[0].position) return sorted[0].hex
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (p <= b.position) {
      const range = b.position - a.position
      return range === 0 ? b.hex : blendOklchHex(a.hex, b.hex, (p - a.position) / range)
    }
  }
  return sorted[sorted.length - 1].hex
}

/**
 * Like `sampleStops`, but interpolating the way a CSS gradient does: a plain
 * per-channel lerp in gamma-encoded sRGB. `sampleStops` blends in polar OKLCH,
 * which travels a different path between the same two endpoints — so a stack
 * of flat layers sampled with it reads as a visibly different gradient from
 * the CSS one the rectangle crop paints for the identical stops. Layer-based
 * renderers (OvalRadialLayers) use this so the two crops agree.
 */
export function sampleStopsCss(stops: GradientStop[], t: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const p = Math.min(100, Math.max(0, t * 100))
  if (p <= sorted[0].position) return sorted[0].hex
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (p <= b.position) {
      const range = b.position - a.position
      if (range === 0) return b.hex
      return lerpHexSrgb(a.hex, b.hex, (p - a.position) / range)
    }
  }
  return sorted[sorted.length - 1].hex
}

function lerpHexSrgb(hexA: string, hexB: string, t: number): string {
  const a = hexToSrgb(hexA)
  const b = hexToSrgb(hexB)
  const mix = (x: number, y: number) => Math.round(Math.min(255, Math.max(0, x + (y - x) * t)))
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

/**
 * The exact stop list `buildGradientCss` would hand to CSS for a continuous
 * (non-square) type, after reversal and the repeat/hard/smooth filters. Layer
 * renderers need it so they quantize the SAME ramp the CSS path paints.
 */
export function resolvedCssStops(
  stops: GradientStop[],
  reversed: boolean,
  filters: GradientFilters = {},
): GradientStop[] {
  let ordered = applyReversed(stops, reversed)
  if (filters.repeat) ordered = repeatedStops(ordered)
  if (filters.hard) ordered = hardenStops(ordered)
  return densifierFor(filters)(ordered)
}

/** Approximates the color the rendered gradient shows at normalized page
 * coordinates (x, y in 0-1), mirroring buildGradientCss's per-type math and
 * the TurrellSquare component's nesting model for 'square'. Used to pick a
 * legible tone for floating chrome (see lib/glassTone). */
export function gradientColorAt(
  type: GradientType,
  stops: GradientStop[],
  x: number,
  y: number,
  reversed = false,
  filters: GradientFilters = {}
): string {
  assertStops(stops)
  let orderedStops = applyReversed(stops, reversed)
  if (type !== 'square' && type !== 'mirror' && type !== 'repeat') {
    if (filters.repeat) orderedStops = repeatedStops(orderedStops)
    if (filters.hard) orderedStops = hardenStops(orderedStops)
  }

  switch (type) {
    case 'linear':
      return sampleStops(orderedStops, y)
    case 'radial': {
      // radial-gradient(circle) extends to the farthest corner; treat the
      // container as square-ish — chrome tone only needs to be approximate.
      const r = Math.hypot(x - 0.5, y - 0.5) / Math.hypot(0.5, 0.5)
      return sampleStops(orderedStops, r)
    }
    case 'angular': {
      // Angle from the top edge, clockwise, over the very sequence
      // buildAngularGradient renders.
      const angle = (Math.atan2(x - 0.5, -(y - 0.5)) / (2 * Math.PI) + 1) % 1
      return sampleStops(angularSequence(orderedStops), angle)
    }
    case 'square': {
      // TurrellSquare paints nested solid layers; the visible colour at a point
      // is the SMALLEST layer still covering it (Chebyshev distance from the
      // origin, approximated as centred — chrome tone only needs to be close).
      //
      // This used to compute `100 - position * 0.8`, which inverts the ramp:
      // it made position 0 the outermost layer where the component makes it the
      // innermost, so the sampled colour was wrong for any square whose stops
      // were not symmetric. That is the same inversion canvasExport carried
      // before it was fixed; this was the last copy still holding it.
      const d = Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) * 2
      let hex = orderedStops[orderedStops.length - 1].hex
      let smallest = Infinity
      for (const stop of orderedStops) {
        const extent = turrellExtent(stop.position, orderedStops.length)
        if (extent >= d && extent < smallest) {
          smallest = extent
          hex = stop.hex
        }
      }
      return hex
    }
    case 'mirror':
      // The very sequence buildMirrorGradient renders. This used to rebuild an
      // evenly-spaced sequence from hex order alone, discarding positions —
      // a third copy of the geometry, drifting from the other two.
      return sampleStops(mirrorSequence(orderedStops), y)
    case 'repeat': {
      const hexes = orderedStops.map((s) => s.hex)
      return sampleStops(positionedStops([...hexes, ...hexes]), y)
    }
    case 'fan': {
      // Same sequence buildFanGradient renders, sampled by the angle (clockwise
      // from straight up) about the pivot.
      //
      // This used to resolve the config as FAN_ANCHOR_CONFIG[anchor] with the
      // span hardcoded to 0.5, ignoring filters.angle. So a corner fan (span
      // 0.25) or any angle-driven fan was sampled against a sector it does not
      // occupy, and the on-gradient ink was picked against the wrong colour.
      const { from, px, py, span } = resolveFanConfig(filters.fanAnchor, filters.angle)
      const deg = ((Math.atan2(x - px, -(y - py)) * 180) / Math.PI + 360) % 360
      const t = ((deg - from + 360) % 360) / 360
      return sampleStops(fanSequence(orderedStops, span), t)
    }
  }
}
