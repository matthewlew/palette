

import { blendOklchHex } from './oklch'

export type GradientType = 'linear' | 'radial' | 'angular' | 'square' | 'mirror' | 'repeat'

export interface GradientStop {
  hex: string
  position: number // 0-100
}

function assertStops(stops: GradientStop[]): void {
  if (stops.length < 2) {
    throw new Error('A gradient requires at least 2 stops')
  }
}

function stopsToCss(stops: GradientStop[]): string {
  return stops.map((s) => `${s.hex} ${s.position}%`).join(', ')
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
  return `conic-gradient(from 0deg, ${segments.join(', ')})`
}

function buildAngularGradient(stops: GradientStop[]): string {
  // Compress existing positions to leave room for a final segment that
  // blends the last color back to the first, eliminating the hard seam at
  // 360deg/0deg that a plain conic-gradient produces.
  const scaleFactor = stops.length / (stops.length + 1)
  const compressed = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position * scaleFactor) }))
  const withSeam = [...compressed, { hex: stops[0].hex, position: 100 }]
  return `conic-gradient(${stopsToCss(withSeam)})`
}

function applyReversed(stops: GradientStop[], reversed: boolean): GradientStop[] {
  if (!reversed) return stops
  // Swap which color sits at each position, but keep positions themselves
  // fixed — CSS gradient rendering is driven by position, not array order,
  // so reversing whole {hex, position} stop objects together is a no-op.
  const reversedHexes = [...stops].reverse().map((s) => s.hex)
  return stops.map((s, i) => ({ hex: reversedHexes[i], position: s.position }))
}

function positionedStops(hexes: string[]): GradientStop[] {
  const count = hexes.length
  return hexes.map((hex, i) => ({
    hex,
    position: count === 1 ? 0 : Math.round((i / (count - 1)) * 100),
  }))
}

function buildMirrorGradient(stops: GradientStop[]): string {
  const forward = stops.map((s) => s.hex)
  // A true palindrome: reflect back to the start without duplicating the
  // last color at the axis of symmetry: [A,B,C] -> [A,B,C,B,A].
  const mirrored = [...forward, ...forward.slice(0, -1).reverse()]
  return `linear-gradient(180deg, ${stopsToCss(positionedStops(mirrored))})`
}

function buildRepeatGradient(stops: GradientStop[]): string {
  // No synthetic midpoint at the seam: an OKLCH-blended seam color can land
  // on a hue that exists nowhere in the palette. Letting CSS interpolate the
  // last color straight into the first keeps the blend between real stops.
  const hexes = stops.map((s) => s.hex)
  const sequence = [...hexes, ...hexes]
  return `linear-gradient(180deg, ${stopsToCss(positionedStops(sequence))})`
}

/** Cycles the stop sequence twice across the gradient — a "2x repeat"
 * filter, applicable on top of any geometry type. The doubled hex sequence
 * is redistributed evenly across the full range so every step (including
 * the hand-off from the last color of cycle 1 into the first color of
 * cycle 2) is the same width and blends smoothly — naively halving each
 * cycle's positions instead lands two different colors at exactly 50 and
 * produces a hard seam plus uneven steps. */
function repeatedStops(stops: GradientStop[]): GradientStop[] {
  const hexes = stops.map((s) => s.hex)
  return positionedStops([...hexes, ...hexes])
}

/** Converts smooth blend points into hard color bands: each stop fills out
 * to the midpoint between it and its neighbors, so colors cut instead of
 * interpolating. Implemented via CSS's double-stop trick (same color at two
 * adjacent positions). */
function hardenStops(stops: GradientStop[]): GradientStop[] {
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

/** Interior stops inserted between each adjacent pair when smoothing. */
const SMOOTH_SUBDIVISIONS = 7

/** Eases each segment between adjacent stops (the "easing linear gradients"
 * technique): original stops stay exactly where the user placed them, and
 * the inserted interior stops follow an ease-in-out curve blended in OKLCH,
 * removing the harsh linear-interpolation banding at every stop boundary. */
function smoothenStops(stops: GradientStop[]): GradientStop[] {
  if (stops.length < 2) return stops
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const result: GradientStop[] = [{ ...sorted[0] }]
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    for (let k = 1; k <= SMOOTH_SUBDIVISIONS; k++) {
      const t = k / (SMOOTH_SUBDIVISIONS + 1)
      result.push({
        hex: blendOklchHex(a.hex, b.hex, easeInOut(t)),
        position: Math.round((a.position + (b.position - a.position) * t) * 10) / 10,
      })
    }
    result.push({ ...b })
  }
  return result
}

export interface GradientFilters {
  /** Cycles the stop sequence twice across the gradient, like the old
   * dedicated "repeat" type but layered on top of any geometry. */
  repeat?: boolean
  /** Renders solid color bands with hard cuts instead of smooth blends. */
  hard?: boolean
  /** Smoothens the gradient transitions using an ease-in-out curve in OKLCH color space. */
  smooth?: boolean
}

export function buildGradientCss(
  type: GradientType,
  stops: GradientStop[],
  reversed = false,
  filters: GradientFilters = {}
): string {
  assertStops(stops)
  let orderedStops = applyReversed(stops, reversed)

  if (filters.smooth && !filters.hard && type !== 'square') {
    orderedStops = smoothenStops(orderedStops)
  }

  // Turrell squares are already solid, non-interpolated blocks, and mirror/
  // legacy-repeat build their own position sequence from raw hex order —
  // the repeat/hard filters only make sense for types that render a genuine
  // continuous blend from `orderedStops` as given.
  if (type !== 'square' && type !== 'mirror' && type !== 'repeat') {
    // Repeat first: it rebuilds an even position sequence from hex order, so
    // hardening must run on the already-repeated stops for bands to stay even.
    if (filters.repeat) orderedStops = repeatedStops(orderedStops)
    if (filters.hard) orderedStops = hardenStops(orderedStops)
  }

  switch (type) {
    case 'linear':
      return `linear-gradient(180deg, ${stopsToCss(orderedStops)})`
    case 'radial':
      return `radial-gradient(circle, ${stopsToCss(orderedStops)})`
    case 'angular':
      return buildAngularGradient(orderedStops)
    case 'square':
      return buildSquareGradient(orderedStops)
    case 'mirror':
      return buildMirrorGradient(orderedStops)
    case 'repeat':
      return buildRepeatGradient(orderedStops)
  }
}

/** Interpolates the color a stop sequence renders at normalized offset t
 * (0-1). Duplicate positions (hardened stops) resolve to piecewise-constant
 * bands, matching CSS. */
function sampleStops(stops: GradientStop[], t: number): string {
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
      // Angle from the top edge, clockwise, over the same compressed
      // sequence (with the seam blending back to the first color) that
      // buildAngularGradient renders.
      const scaleFactor = orderedStops.length / (orderedStops.length + 1)
      const compressed = orderedStops.map((s) => ({ hex: s.hex, position: Math.round(s.position * scaleFactor) }))
      const withSeam = [...compressed, { hex: orderedStops[0].hex, position: 100 }]
      const angle = (Math.atan2(x - 0.5, -(y - 0.5)) / (2 * Math.PI) + 1) % 1
      return sampleStops(withSeam, angle)
    }
    case 'square': {
      // TurrellSquare paints nested solid layers, later stops on top and
      // shrinking with position; the visible color at a point is the
      // innermost layer still covering it (Chebyshev distance from center).
      const d = Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) * 200
      let hex = orderedStops[0].hex
      for (let i = 1; i < orderedStops.length; i++) {
        const scale = 100 - (orderedStops[i].position / 100) * 80
        if (scale >= d) hex = orderedStops[i].hex
      }
      return hex
    }
    case 'mirror': {
      const forward = orderedStops.map((s) => s.hex)
      const mirrored = [...forward, ...forward.slice(0, -1).reverse()]
      return sampleStops(positionedStops(mirrored), y)
    }
    case 'repeat': {
      const hexes = orderedStops.map((s) => s.hex)
      return sampleStops(positionedStops([...hexes, ...hexes]), y)
    }
  }
}
