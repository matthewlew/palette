

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

/** Compresses the stop sequence into the first half of the 0-100 range and
 * duplicates it into the second half, so the whole gradient cycles through
 * its stops twice with a smooth hand-off between cycles — a "2x repeat"
 * filter, applicable on top of any geometry type. */
function repeatedStops(stops: GradientStop[]): GradientStop[] {
  const first = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position / 2) }))
  const second = stops.map((s) => ({ hex: s.hex, position: Math.round(50 + s.position / 2) }))
  return [...first, ...second]
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

export interface GradientFilters {
  /** Cycles the stop sequence twice across the gradient, like the old
   * dedicated "repeat" type but layered on top of any geometry. */
  repeat?: boolean
  /** Renders solid color bands with hard cuts instead of smooth blends. */
  hard?: boolean
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
    if (filters.hard) orderedStops = hardenStops(orderedStops)
    if (filters.repeat) orderedStops = repeatedStops(orderedStops)
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
