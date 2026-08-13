import type { GradientStop, GradientType, FanAnchor, GradientFilters } from './gradient'
import { resolveFanConfig, getRadialConfig, buildGradientCss, applyReversed, applyStopFilters, fanSequence, densifierFor } from './gradient'

/** The three crop shapes a gradient can render into. `undefined`/`'rectangle'`
 * on a saved Gradient means today's full-bleed behaviour — this stays optional
 * so every gradient saved before crop existed is unaffected. */
export type GradientCrop = 'rectangle' | 'circle' | 'oval'

/**
 * Radial extent for a crop, in normalized half-box units (0.5 = the crop's
 * own half-axis, i.e. a centred origin reaching the boundary exactly).
 *
 * The rectangle rule — reach the far edge independently on x and y — does not
 * transfer to a curved boundary: applied per axis to a circle with a top-centre
 * origin it yields rx=0.5, ry=1.0, a 2:1 ellipse instead of a circle. On a
 * curved crop the isolines must stay SIMILAR to the boundary curve, so there is
 * a single extent: the distance from the origin to the farthest point of the
 * boundary, measured in the curve's own metric, so the outermost isoline is
 * tangent to the far side of the crop from any origin.
 *
 * One closed form covers both shapes. In normalized 0-1 box coordinates the
 * ellipse inscribed in the box IS the unit circle — the box's aspect is
 * already divided out — so circle and oval differ only in the layout box they
 * are given, never in this arithmetic.
 */
export function cropRadialExtent(crop: GradientCrop, px: number, py: number): number {
  if (crop === 'rectangle') return 0.5
  return Math.hypot(px - 0.5, py - 0.5) + 0.5
}

/** Linear/mirror stop-compression factor `k` for the circle crop at a given
 * gradient angle (degrees). */
export function linearCompressionCircle(angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180
  return Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad))
}

/** Linear/mirror stop-compression factor `k` for the general oval crop
 * (w, h = the crop's aspect box). Collapses to `linearCompressionCircle`
 * when w === h. */
export function linearCompressionOval(angleDeg: number, w: number, h: number): number {
  const rad = (angleDeg * Math.PI) / 180
  const s = Math.abs(Math.sin(rad))
  const c = Math.abs(Math.cos(rad))
  const denom = Math.sqrt(w * w * s * s + h * h * c * c)
  if (denom === 0) return 1
  return (w * s + h * c) / denom
}

export function linearCompressionFactor(crop: GradientCrop, angleDeg: number, w = 1, h = 1): number {
  if (crop === 'rectangle') return 1
  if (crop === 'circle') return linearCompressionCircle(angleDeg)
  return linearCompressionOval(angleDeg, w, h)
}

/** Compresses stop positions toward the 50% midpoint by `k`, per the crop
 * design's `p -> 50 + (p-50)/k`. Non-destructive: this is applied at render
 * time only, never written back onto the gradient's saved stops. */
export function compressStopsForCrop(
  stops: GradientStop[],
  crop: GradientCrop | undefined,
  angleDeg: number,
  w = 1,
  h = 1,
): GradientStop[] {
  if (!crop || crop === 'rectangle') return stops
  const k = linearCompressionFactor(crop, angleDeg, w, h)
  if (!isFinite(k) || k <= 0) return stops
  return stops.map((s) => ({ ...s, position: 50 + (s.position - 50) / k }))
}

/** Both crops are conics: |x/a|^2 + |y/b|^2 = 1, the circle being the a=b
 * case. Oval was a Lamé curve at n=2.5 — a squircle, with the flattened sides
 * that implies. It reads as a rounded rectangle rather than an oval next to a
 * true circle, so it is a plain ellipse now. `boundaryInwardBearing` keeps `n`
 * as a parameter because its derivation is general and the exponent is the
 * only thing that would change if a squircle ever came back. */
const ELLIPSE_N = 2

/** The inward-normal bearing (0 = up, clockwise, matching getFanConfig's
 * compass) of the crop boundary at the point directly out from centre toward
 * (px, py). Verified against FAN_ANCHOR_CONFIG in gradientCrop.test.ts. */
export function boundaryInwardBearing(n: number, px: number, py: number, w = 1, h = 1): number {
  const a = w / Math.max(w, h)
  const b = h / Math.max(w, h)
  const dxc = px - 0.5
  const dyc = py - 0.5
  if (dxc === 0 && dyc === 0) return 0
  // The implicit boundary function G(x,y) = |x/a|^n + |y/b|^n is homogeneous
  // of degree n in a uniform scale of (x,y), so the ray from centre through
  // (dxc, dyc) crosses G=1 at t = G(dxc,dyc)^(-1/n).
  const g = Math.pow(Math.abs(dxc / a), n) + Math.pow(Math.abs(dyc / b), n)
  const t = g === 0 ? 0 : Math.pow(g, -1 / n)
  const x0 = t * dxc
  const y0 = t * dyc
  const gradX = x0 === 0 ? 0 : (n * Math.sign(x0) * Math.pow(Math.abs(x0) / a, n - 1)) / a
  const gradY = y0 === 0 ? 0 : (n * Math.sign(y0) * Math.pow(Math.abs(y0) / b, n - 1)) / b
  // Inward = -gradient (gradient points outward, toward increasing G).
  const bearing = (Math.atan2(-gradX, gradY) * 180) / Math.PI
  return ((bearing % 360) + 360) % 360
}

/** Fan re-fit: pivot stays on the boundary curve, `from` follows the inward
 * normal there, and `span` is always 180° — this replaces the old span-0.25
 * corner-fan special case that assumed a square boundary (a crop boundary has
 * no corners to special-case). Takes no crop: circle and oval are the same
 * curve in normalized coordinates, and the caller has already ruled out
 * rectangle. */
export function fanRefit(px: number, py: number, w = 1, h = 1): { from: number; span: number } {
  const bearing = boundaryInwardBearing(ELLIPSE_N, px, py, w, h)
  return { from: ((bearing - 90) % 360 + 360) % 360, span: 0.5 }
}

/** Radial re-fit for a crop, as {rx, ry} fractions of the bounding box (0.5 =
 * classic centred circle). rx always equals ry on a curved crop — see
 * cropRadialExtent. */
export function radialCropAxes(crop: GradientCrop, px: number, py: number): { rx: number; ry: number } {
  const r = cropRadialExtent(crop, px, py)
  return { rx: r, ry: r }
}

/** CSS `clip-path` for a crop shape. Both are exact native basic shapes, so
 * neither needs the 96-point `polygon()` the squircle did: `circle(50%)` in
 * the square box a circle is laid out in, and `ellipse(50% 50%)`, whose two
 * percentages resolve against the box's own width and height — the oval takes
 * its proportions from whatever box it is given, with no aspect term here. */
export function cropClipPath(crop: GradientCrop | undefined): string | undefined {
  if (!crop || crop === 'rectangle') return undefined
  return crop === 'circle' ? 'circle(50%)' : 'ellipse(50% 50%)'
}

/**
 * Box sizing for a crop's render surface, given the height available to it.
 *
 * A circle MUST be laid out in a square box: `cropClipPath` emits
 * `circle(50%)`, and per the CSS spec a percentage circle radius resolves
 * against the box's diagonal (sqrt(w²+h²)/√2), which on a portrait box is
 * larger than half the width — so the "circle" spills past the left and right
 * edges and is cut off by the viewport instead of being cropped. Sizing the
 * box to min(available width, available height) keeps the whole circle on
 * screen at 1:1. `availableHeight` must be a length CSS can resolve on its
 * own (e.g. `100dvh`), not a percentage of the parent.
 *
 * Oval and rectangle take the full available box.
 */
export function cropSurfaceSize(
  crop: GradientCrop | undefined,
  availableHeight: string,
): { width: string; height: string; aspectRatio?: string } {
  if (crop === 'circle') {
    return { width: `min(100%, ${availableHeight})`, height: 'auto', aspectRatio: '1 / 1' }
  }
  return { width: '100%', height: '100%' }
}

interface RefitCssArgs {
  type: GradientType
  stops: GradientStop[]
  crop: GradientCrop | undefined
  angle?: number
  fanAnchor?: FanAnchor
  aspectW?: number
  aspectH?: number
}

/**
 * Re-fits the angle/fan/stop inputs `buildGradientCss` needs so the geometry
 * belongs to the crop boundary instead of being clipped out of a rectangle.
 * Returns adjustments to layer on top of the existing filters — never a
 * mutation of the caller's stops. `angular`/`square` are untouched (angular
 * is angle-parameterized and indifferent to the boundary curve per the crop
 * design; `square`/Turrell has its own crop-aware renderer). */
export function refitStopsForCrop({ type, stops, crop, angle = 0 }: RefitCssArgs): GradientStop[] {
  if (!crop || crop === 'rectangle') return stops
  if (type === 'linear' || type === 'mirror') {
    return compressStopsForCrop(stops, crop, angle)
  }
  return stops
}

/** Fan's crop-refit `{from, span}`, resolved the same way `resolveFanConfig`
 * resolves the rectangle case (anchor legacy fallback included), so callers
 * only branch on crop once. */
export function refitFanForCrop(
  crop: GradientCrop | undefined,
  fanAnchor: FanAnchor | undefined,
  angle: number | undefined,
): { from: number; span: number; px: number; py: number } {
  const base = resolveFanConfig(fanAnchor, angle)
  if (!crop || crop === 'rectangle') return base
  const { from, span } = fanRefit(base.px, base.py)
  return { from, span, px: base.px, py: base.py }
}

function stopsToCss(stops: GradientStop[]): string {
  return stops.map((s) => `${s.hex} ${s.position}%`).join(', ')
}

/**
 * Crop-aware CSS background for a gradient — every geometry and every crop.
 *
 * It used to return `null` for `radial` inside an `oval`, because a CSS
 * radial-gradient can only emit elliptical isolines and the boundary was a
 * squircle, whose diagonals a nest of ellipses can't follow. With the boundary
 * an actual ellipse, an ellipse-isoline gradient is exactly the right shape,
 * and the layered fallback that case needed is gone.
 */
export function buildCroppedGradientCss(
  type: GradientType,
  stops: GradientStop[],
  reversed: boolean,
  filters: GradientFilters,
  crop: GradientCrop | undefined,
): string {
  if (!crop || crop === 'rectangle') return buildGradientCss(type, stops, reversed, filters)

  const angle = filters.angle ?? 0
  // The same Smooth/Prism/Hard resolution buildGradientCss applies, so a
  // cropped geometry that builds its own CSS here densifies identically.
  const densify = densifierFor(filters, type)

  if (type === 'radial') {
    const orderedStops = applyStopFilters(type, applyReversed(stops, reversed), filters)
    const origin = getRadialConfig(filters.angle)
    // rx === ry as fractions of the box, so on a non-square box the two
    // percentages resolve to different lengths and the isolines come out as
    // ellipses similar to the crop — which is what the oval wants.
    const { rx, ry } = radialCropAxes(crop, origin.px, origin.py)
    const finalStops = densify(orderedStops)
    return `radial-gradient(${(rx * 100).toFixed(2)}% ${(ry * 100).toFixed(2)}% at ${origin.px * 100}% ${origin.py * 100}%, ${stopsToCss(finalStops)})`
  }

  if (type === 'linear' || type === 'mirror') {
    // Repeat runs BEFORE the refit. It rebuilds an even position sequence from
    // hex order, so letting buildGradientCss apply it downstream would
    // overwrite the very positions the refit just computed and throw the crop
    // compression away. Hard is left to buildGradientCss: it derives band edges
    // from the positions it is given, so it wants the refit ones — and it still
    // has to reach densifierFor there to suppress Smooth/Prism.
    const repeated = applyStopFilters(type, applyReversed(stops, reversed), { repeat: filters.repeat })
    const refit = refitStopsForCrop({ type, stops: repeated, crop, angle })
    // The refit stops are already reversed and repeated — hand buildGradientCss
    // a passthrough order and clear `repeat` so it applies neither again.
    return buildGradientCss(type, refit, false, { ...filters, repeat: false })
  }

  if (type === 'fan') {
    const orderedStops = applyStopFilters(type, applyReversed(stops, reversed), filters)
    const { from, span } = refitFanForCrop(crop, filters.fanAnchor, filters.angle)
    const sequence = fanSequence(orderedStops, span)
    const finalStops = densify(sequence)
    const { px, py } = resolveFanConfig(filters.fanAnchor, filters.angle)
    return `conic-gradient(from ${from}deg at ${px * 100}% ${py * 100}%, ${stopsToCss(finalStops)})`
  }

  // angular and square are angle-parameterized/self-contained and unaffected
  // by the boundary curve — they only need the external clip-path.
  return buildGradientCss(type, stops, reversed, filters)
}
