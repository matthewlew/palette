import type { GradientStop } from './gradient'

export interface EditableStop {
  id: string
  hex: string
}

export function toEditableStops(stops: GradientStop[]): EditableStop[] {
  return stops.map((stop) => ({ id: crypto.randomUUID(), hex: stop.hex }))
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

export function addStop(stops: EditableStop[], hex: string): EditableStop[] {
  return [...stops, { id: crypto.randomUUID(), hex }]
}
