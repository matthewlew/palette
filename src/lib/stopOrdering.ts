import type { GradientStop } from './gradient'

export interface EditableStop {
  id: string
  hex: string
  position: number // 0-100
}

export function toEditableStops(stops: GradientStop[]): EditableStop[] {
  return stops.map((stop) => ({ id: crypto.randomUUID(), hex: stop.hex, position: stop.position }))
}

export function equalizePositions(stops: EditableStop[]): GradientStop[] {
  const count = stops.length
  return stops.map((stop, i) => ({
    hex: stop.hex,
    position: count === 1 ? 0 : Math.round((i / (count - 1)) * 100),
  }))
}

export function removeStopAt(stops: EditableStop[], id: string): EditableStop[] {
  return stops.filter((stop) => stop.id !== id)
}

function largestGapMidpoint(stops: EditableStop[]): number {
  if (stops.length === 0) return 50
  if (stops.length === 1) return stops[0].position >= 50 ? stops[0].position / 2 : (stops[0].position + 100) / 2
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  let bestGap = -1
  let bestMidpoint = 50
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].position - sorted[i].position
    if (gap > bestGap) {
      bestGap = gap
      bestMidpoint = (sorted[i].position + sorted[i + 1].position) / 2
    }
  }
  return Math.round(bestMidpoint)
}

export function addStop(stops: EditableStop[], hex: string): EditableStop[] {
  const position = largestGapMidpoint(stops)
  return [...stops, { id: crypto.randomUUID(), hex, position }]
}

export function removeLastByHex(stops: EditableStop[], hex: string): EditableStop[] {
  const lastIndex = stops.map((s) => s.hex).lastIndexOf(hex)
  if (lastIndex === -1) return stops
  return [...stops.slice(0, lastIndex), ...stops.slice(lastIndex + 1)]
}

/** Clamps position to [0,100], updates the matching stop, and returns all
 * stops re-sorted by position (stable for ties). */
export function moveStop(stops: EditableStop[], id: string, position: number): EditableStop[] {
  const clamped = Math.min(100, Math.max(0, position))
  const updated = stops.map((s) => (s.id === id ? { ...s, position: clamped } : s))
  return updated
    .map((s, i) => ({ s, i })) // stabilize sort using original index as tiebreaker
    .sort((a, b) => a.s.position - b.s.position || a.i - b.i)
    .map(({ s }) => s)
}

/** Maps {hex, position} straight through, sorted by position. */
export function toGradientStops(stops: EditableStop[]): GradientStop[] {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ hex: s.hex, position: s.position }))
}
