import type { GradientStop, GradientType, FanAnchor, GradientFilters } from './gradient'
import { resolveFanConfig, getRadialConfig, buildGradientCss, applyReversed, applyStopFilters, fanSequence, densifierFor } from './gradient'

/** The three crop shapes a gradient can render into. `undefined`/`'rectangle'`
 * on a saved Gradient means today's full-bleed behaviour — this stays optional
 * so every gradient saved before crop existed is unaffected. */
export type GradientCrop = 'rectangle' | 'circle' | 'oval'

/** Piet Hein's Sergels Torg superellipse exponent. Circle is the exact n=2
 * case of the same curve; oval fixes n at this value rather than exposing it
 * as a per-gradient control (see the crop design doc). */
export const SUPERELLIPSE_N = 2.5

export function superellipseN(crop: GradientCrop): number {
  return crop === 'circle' ? 2 : SUPERELLIPSE_N
}

/**
 * Exact superellipse radius formula: |x/a|^n + |y/b|^n = 1, solved for the
 * distance from centre along bearing `theta` (radians, measured from the
 * +x axis) relative to the half-axis in that direction. Returns 1.0 exactly
 * on both axes (theta = 0 or π/2) for every n, and > 1.0 off-axis, growing
 * toward the diagonal as n grows — see gradientCrop.test.ts.
 */
export function superellipseRadiusAt(theta: number, n: number): number {
  const c = Math.abs(Math.cos(theta))
  const s = Math.abs(Math.sin(theta))
  const sum = Math.pow(c, n) + Math.pow(s, n)
  if (sum === 0) return Infinity
  return 1 / Math.pow(sum, 1 / n)
}

/**
 * Radial extent for a crop, in normalized half-box units (0.5 = the crop's
 * own half-axis, i.e. a centred origin reaching the boundary exactly).
 *
 * The rectangle rule — reach the far edge independently on x and y — does not
 * transfer to a curved boundary: applied per axis to a circle with a top-centre
 * origin it yields rx=0.5, ry=1.0, a 2:1 ellipse instead of a circle. On a
 * curved crop the isolines must stay SIMILAR to the boundary curve, so there is
 * a single extent: the largest boundary-curve scale, measured about the origin,
 * that still swallows the whole crop. That is the distance (in the curve's own
 * metric) from the origin to the farthest point of the boundary, so the
 * outermost isoline is tangent to the far side of the crop from any origin.
 *
 * For a circle that has the closed form `hypot(origin - centre) + radius`; for
 * the oval it is a max over sampled boundary points, which reduces to the same
 * closed form at n=2.
 */
export function cropRadialExtent(crop: GradientCrop, px: number, py: number, steps = 180): number {
  if (crop === 'rectangle') return 0.5
  if (crop === 'circle') return Math.hypot(px - 0.5, py - 0.5) + 0.5
  const n = SUPERELLIPSE_N
  let max = 0
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI
    const r = superellipseRadiusAt(theta, n)
    // Boundary point in normalized 0-1 box coordinates, then its offset from
    // the origin measured in the superellipse's own norm.
    const dx = 0.5 + 0.5 * r * Math.cos(theta) - px
    const dy = 0.5 + 0.5 * r * Math.sin(theta) - py
    const norm = 0.5 * Math.pow(Math.pow(Math.abs(dx / 0.5), n) + Math.pow(Math.abs(dy / 0.5), n), 1 / n)
    if (norm > max) max = norm
  }
  return max
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

/** The inward-normal bearing (0 = up, clockwise, matching getFanConfig's
 * compass) of the crop boundary at the point directly out from centre toward
 * (px, py). Used for both circle and oval — n=2 reduces to the plain radial
 * bearing, verified against FAN_ANCHOR_CONFIG in gradientCrop.test.ts. */
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
 * normal there, and `span` is always 180° for both circle and oval — this
 * replaces the old span-0.25 corner-fan special case that assumed a square
 * boundary (a crop boundary has no corners to special-case). */
export function fanRefit(crop: GradientCrop, px: number, py: number, w = 1, h = 1): { from: number; span: number } {
  const n = superellipseN(crop)
  const bearing = boundaryInwardBearing(n, px, py, w, h)
  return { from: ((bearing - 90) % 360 + 360) % 360, span: 0.5 }
}

/** Radial re-fit for a crop, as {rx, ry} fractions of the bounding box (0.5 =
 * classic centred circle). rx always equals ry on a curved crop — see
 * cropRadialExtent. */
export function radialCropAxes(crop: GradientCrop, px: number, py: number): { rx: number; ry: number } {
  const r = cropRadialExtent(crop, px, py)
  return { rx: r, ry: r }
}

/** Points around the unit superellipse |x|^n + |y|^n = 1 (centred at 0,0,
 * half-extent 1 on each axis), for building a `clip-path: polygon(...)` or a
 * canvas Path2D. n=2 gives (a coarse approximation of) a circle — callers
 * that can express an exact circle should prefer `circle()`/canvas `arc()`
 * instead and reserve this for the oval (n != 2) case. */
export function superellipsePoints(n: number, steps = 96): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI
    const r = superellipseRadiusAt(theta, n)
    pts.push([r * Math.cos(theta), r * Math.sin(theta)])
  }
  return pts
}

/** CSS `clip-path` value for a crop shape over a box of the given aspect
 * (w:h). Circle always clips to `circle(50%)` (exact, cheap). Oval clips to a
 * polygon tracing the superellipse boundary, scaled to the box's own aspect
 * so the boundary is the "considered oval" the box's own proportions imply,
 * not a stretched circle. */
export function cropClipPath(crop: GradientCrop | undefined, w = 1, h = 1): string | undefined {
  if (!crop || crop === 'rectangle') return undefined
  if (crop === 'circle') return 'circle(50%)'
  const n = SUPERELLIPSE_N
  const points = superellipsePoints(n)
  const scaleX = w >= h ? 1 : w / h
  const scaleY = h >= w ? 1 : h / w
  const css = points
    .map(([x, y]) => `${(50 + x * 50 * scaleX).toFixed(2)}% ${(50 + y * 50 * scaleY).toFixed(2)}%`)
    .join(', ')
  return `polygon(${css})`
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
 * design; `square`/Turrell has its own crop-aware renderer, see
 * OvalCropLayers). `radial` for an oval crop also needs its own renderer
 * (a plain CSS radial-gradient can't emit a non-elliptical isoline) — this
 * only returns the circle-crop radial axes; callers must branch on that.
 */
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
  const { from, span } = fanRefit(crop, base.px, base.py)
  return { from, span, px: base.px, py: base.py }
}

function stopsToCss(stops: GradientStop[]): string {
  return stops.map((s) => `${s.hex} ${s.position}%`).join(', ')
}

/**
 * Crop-aware CSS background for a gradient. Handles every shape except
 * `radial` under an `oval` crop — a plain CSS radial-gradient can only emit
 * elliptical isolines (no per-angle radius), so inside a non-circular
 * superellipse boundary its ramp ends early on the diagonals and flat-fills
 * the rest. Returns `null` for that one case; render `OvalRadialLayers`
 * instead (see that component).
 */
export function buildCroppedGradientCss(
  type: GradientType,
  stops: GradientStop[],
  reversed: boolean,
  filters: GradientFilters,
  crop: GradientCrop | undefined,
): string | null {
  if (!crop || crop === 'rectangle') return buildGradientCss(type, stops, reversed, filters)

  const angle = filters.angle ?? 0
  // The same Smooth/Prism/Hard resolution buildGradientCss applies, so a
  // cropped geometry that builds its own CSS here densifies identically.
  const densify = densifierFor(filters, type)

  if (type === 'radial') {
    if (crop === 'oval') return null
    const orderedStops = applyStopFilters(type, applyReversed(stops, reversed), filters)
    const origin = getRadialConfig(filters.angle)
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
