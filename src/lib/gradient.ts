export type GradientType = 'linear' | 'radial' | 'angular' | 'square'

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

export function buildGradientCss(type: GradientType, stops: GradientStop[]): string {
  assertStops(stops)

  switch (type) {
    case 'linear':
      return `linear-gradient(180deg, ${stopsToCss(stops)})`
    case 'radial':
      return `radial-gradient(circle, ${stopsToCss(stops)})`
    case 'angular':
      return `conic-gradient(${stopsToCss(stops)})`
    case 'square':
      return buildSquareGradient(stops)
  }
}
