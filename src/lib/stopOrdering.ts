import type { GradientStop } from './gradient'

export interface EditableStop {
  id: string
  hex: string
  position: number // 0-100
}

export function toEditableStops(stops: GradientStop[]): EditableStop[] {
  return stops.map((stop) => ({ id: crypto.randomUUID(), hex: stop.hex, position: stop.position }))
}

/** Spreads stops evenly across 0-100 by array order, keeping their ids.
 *
 * `locked` (index → percentage) is routed around rather than overwritten: a
 * pinned stop keeps exactly where it was put and the rest take the even ladder
 * position for their index. That can leave an unlocked stop sitting past a
 * locked one, which is fine — the gradient is rendered position-sorted — and
 * it is the predictable reading of "reset the spacing, except the ones I
 * nailed down". */
export function equalizeEditableStops(
  stops: EditableStop[],
  locked: Record<number, number> = {}
): EditableStop[] {
  const count = stops.length
  return stops.map((stop, i) => ({
    ...stop,
    position: locked[i] ?? (count === 1 ? 0 : Math.round((i / (count - 1)) * 100)),
  }))
}

export function equalizePositions(stops: EditableStop[]): GradientStop[] {
  return equalizeEditableStops(stops).map((stop) => ({ hex: stop.hex, position: stop.position }))
}

/** True when the stops still sit on the default even ladder — i.e. nobody has
 * dragged one. The whole re-spread rule hangs off this: once the answer is
 * false, the spacing IS the thing being edited and the app must stop
 * rewriting it.
 *
 * Compared against the SORTED positions, not array order, because a reorder
 * re-pairs colours to the same ladder and must not read as customized. The 1
 * point tolerance is not slack — equalize rounds, so a 7-stop even spread is
 * 0/17/33/50/67/83/100 and half of those are already a point off the exact
 * fraction. */
export function isEvenlyDistributed(stops: EditableStop[]): boolean {
  const count = stops.length
  if (count <= 1) return true
  const sorted = [...stops].map((s) => s.position).sort((a, b) => a - b)
  return sorted.every((position, i) => Math.abs(position - (i / (count - 1)) * 100) <= 1)
}

/** Keeps the current distribution and re-pairs colours to it in array order:
 * the sorted ladder of positions is unchanged, and stop i takes the i-th step.
 *
 * This is what a REORDER means once spacing is custom. Re-equalizing would
 * throw the spacing away; leaving positions attached to their stops would make
 * the reorder a no-op, since the gradient is rendered position-sorted. */
export function reassignPositions(stops: EditableStop[]): EditableStop[] {
  const ladder = stops.map((s) => s.position).sort((a, b) => a - b)
  return stops.map((stop, i) => ({ ...stop, position: ladder[i] }))
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
