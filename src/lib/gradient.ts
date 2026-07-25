

import { blendOklchHex } from './oklch'

export type GradientType = 'linear' | 'radial' | 'angular' | 'square' | 'mirror' | 'repeat' | 'fan'

/** Every geometry the user can select or cycle through, in display order.
 * The keyboard's ←/→ steps this whole list and GeometryTabs renders it, so
 * they can never drift out of sync. 'repeat' is intentionally absent — it's a
 * legacy type replaced by the Repeat×2 filter, reachable only via old saves. */
export const SELECTABLE_GEOMETRY: GradientType[] = ['linear', 'radial', 'angular', 'square', 'mirror', 'fan']

export interface GradientStop {
  hex: string
  position: number // 0-100
  label?: string
}

/** Which edge the fan's 180° cone rises from. The pivot sits at the middle of
 * that edge and the visible semicircle faces inward. */
export type FanAnchor = 'bottom' | 'top' | 'left' | 'right'

export const FAN_ANCHORS: FanAnchor[] = ['bottom', 'top', 'left', 'right']

export function getFanConfig(angle: number) {
  // Map 0-360 degrees to one of 8 positions (steps of 45)
  const step = (Math.round(angle / 45) * 45) % 360
  switch (step) {
    case 0: return { at: '50% 100%', from: 270, span: 0.5, px: 0.5, py: 1 } // bottom
    case 45: return { at: '0% 100%', from: 0, span: 0.25, px: 0, py: 1 } // bottom-left
    case 90: return { at: '0% 50%', from: 0, span: 0.5, px: 0, py: 0.5 } // left
    case 135: return { at: '0% 0%', from: 90, span: 0.25, px: 0, py: 0 } // top-left
    case 180: return { at: '50% 0%', from: 90, span: 0.5, px: 0.5, py: 0 } // top
    case 225: return { at: '100% 0%', from: 180, span: 0.25, px: 1, py: 0 } // top-right
    case 270: return { at: '100% 50%', from: 180, span: 0.5, px: 1, py: 0.5 } // right
    case 315: return { at: '100% 100%', from: 270, span: 0.25, px: 1, py: 1 } // bottom-right
    default: return { at: '50% 100%', from: 270, span: 0.5, px: 0.5, py: 1 }
  }
}

export const FAN_ANCHOR_CONFIG: Record<FanAnchor, { at: string; from: number; span: number; px: number; py: number }> = {
  bottom: { at: '50% 100%', from: 270, span: 0.5, px: 0.5, py: 1 },
  top: { at: '50% 0%', from: 90, span: 0.5, px: 0.5, py: 0 },
  left: { at: '0% 50%', from: 0, span: 0.5, px: 0, py: 0.5 },
  right: { at: '100% 50%', from: 180, span: 0.5, px: 1, py: 0.5 },
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

function buildAngularGradient(stops: GradientStop[], hard = false, angle = 0): string {
  // Spread the colors evenly around the full circle by index (i/n). Every
  // wedge — including the seam — is 360/n wide, so N colors read as N equal
  // wedges instead of the uneven distribution a compress-to-leave-room-for-the-
  // seam scheme produces.
  const n = stops.length
  if (hard) {
    // Solid wedges, each color filling its 360/n slice with a crisp edge at the
    // boundary (a double stop). The last wedge cuts straight to the first.
    const segments = stops.map(
      (s, i) => `${s.hex} ${Math.round((i / n) * 100)}% ${Math.round(((i + 1) / n) * 100)}%`,
    )
    return `conic-gradient(from ${angle}deg, ${segments.join(', ')})`
  }
  const spread = stops.map((s, i) => ({ hex: s.hex, position: Math.round((i / n) * 100) }))
  const withSeam = [...spread, { hex: stops[0].hex, position: 100 }]
  return `conic-gradient(from ${angle}deg, ${stopsToCss(withSeam)})`
}

function buildFanGradient(stops: GradientStop[], anchor: FanAnchor = 'bottom', angle?: number): string {
  // A fan rising from an edge or corner. The palette is compressed into the visible
  // sector (180° for sides, 90° for corners) and the last color holds across the rest.
  const { at, from, span } = angle != null ? getFanConfig(angle) : FAN_ANCHOR_CONFIG[anchor]
  const compressed = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position * span) }))
  const withTail = [...compressed, { hex: stops[stops.length - 1].hex, position: 100 }]
  return `conic-gradient(from ${from}deg at ${at}, ${stopsToCss(withTail)})`
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

function buildMirrorGradient(stops: GradientStop[], angle = 0): string {
  const forward = stops.map((s) => s.hex)
  // A true palindrome: reflect back to the start without duplicating the
  // last color at the axis of symmetry: [A,B,C] -> [A,B,C,B,A].
  const mirrored = [...forward, ...forward.slice(0, -1).reverse()]
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(positionedStops(mirrored))})`
}

function buildRepeatGradient(stops: GradientStop[], angle = 0): string {
  // No synthetic midpoint at the seam: an OKLCH-blended seam color can land
  // on a hue that exists nowhere in the palette. Letting CSS interpolate the
  // last color straight into the first keeps the blend between real stops.
  const hexes = stops.map((s) => s.hex)
  const sequence = [...hexes, ...hexes]
  return `linear-gradient(${180 + angle}deg, ${stopsToCss(positionedStops(sequence))})`
}

/** Cycles the stop sequence twice across the gradient — a "2x repeat"
 * filter, applicable on top of any geometry type. The doubled hex sequence
 * is redistributed evenly across the full range so every step (including
 * the hand-off from the last color of cycle 1 into the first color of
 * cycle 2) is the same width and blends smoothly — naively halving each
 * cycle's positions instead lands two different colors at exactly 50 and
 * produces a hard seam plus uneven steps. */
export function repeatedStops(stops: GradientStop[]): GradientStop[] {
  const hexes = stops.map((s) => s.hex)
  return positionedStops([...hexes, ...hexes])
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

  const angle = filters.angle ?? 0
  switch (type) {
    case 'linear':
      return `linear-gradient(${180 + angle}deg, ${stopsToCss(orderedStops)})`
    case 'radial': {
      const { css } = getRadialConfig(filters.angle)
      return `radial-gradient(circle at ${css}, ${stopsToCss(orderedStops)})`
    }
    case 'angular':
      return buildAngularGradient(orderedStops, filters.hard, angle)
    case 'square':
      return buildSquareGradient(orderedStops)
    case 'mirror':
      return buildMirrorGradient(orderedStops, angle)
    case 'repeat':
      return buildRepeatGradient(orderedStops, angle)
    case 'fan':
      return buildFanGradient(orderedStops, filters?.fanAnchor, filters?.angle)
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
      // Angle from the top edge, clockwise, over the same evenly-spread
      // sequence (with the seam wrapping back to the first color) that
      // buildAngularGradient renders.
      const n = orderedStops.length
      const spread = orderedStops.map((s, i) => ({ hex: s.hex, position: Math.round((i / n) * 100) }))
      const withSeam = [...spread, { hex: orderedStops[0].hex, position: 100 }]
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
    case 'fan': {
      // Same compressed sequence buildFanGradient renders, sampled by the
      // angle (clockwise from straight up) about the anchor-edge pivot.
      const { from, px, py } = FAN_ANCHOR_CONFIG[filters.fanAnchor ?? 'bottom']
      const compressed = orderedStops.map((s) => ({ hex: s.hex, position: Math.round(s.position * 0.5) }))
      const withTail = [...compressed, { hex: orderedStops[orderedStops.length - 1].hex, position: 100 }]
      const deg = ((Math.atan2(x - px, -(y - py)) * 180) / Math.PI + 360) % 360
      const t = ((deg - from + 360) % 360) / 360
      return sampleStops(withTail, t)
    }
  }
}
