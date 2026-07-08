

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

export function buildGradientCss(type: GradientType, stops: GradientStop[], reversed = false): string {
  assertStops(stops)
  const orderedStops = applyReversed(stops, reversed)

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
