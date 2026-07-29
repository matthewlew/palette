import type { Gradient } from '../store/types'

/**
 * The "it went somewhere" channel for saving.
 *
 * Saving used to be announced only by the Save pill swapping its label to
 * "✓ Saved" — a state change on the control you just pressed, which reads as
 * the button acknowledging your tap rather than as the palette being filed
 * away. Nothing connected the action to the Gallery tab it actually landed in.
 *
 * So a copy of the gradient physically travels: it pops out of the Save pill,
 * arcs across, and shrinks into the tab bar's thumbnail stack, which then
 * bumps. Three components have to cooperate for that (the button that fires
 * it, the layer that draws it, the tab bar that receives it) and none of them
 * are on the same branch of the tree, so this is a plain module-level emitter
 * rather than another slice of app state — it is transient animation traffic,
 * nothing here belongs in the store or in a URL.
 */

export interface SaveFlight {
  id: number
  gradient: Gradient
  /** Viewport rect of the control the flight leaves from. */
  from: DOMRect
}

type FlightListener = (flight: SaveFlight) => void
type ArrivalListener = () => void

const flightListeners = new Set<FlightListener>()
const arrivalListeners = new Set<ArrivalListener>()
let nextId = 1

export function onSaveFlight(listener: FlightListener): () => void {
  flightListeners.add(listener)
  return () => flightListeners.delete(listener)
}

/** Fired when a flight reaches the tab thumbnail, so the target can react at
 * the moment of contact instead of guessing the duration. */
export function onSaveFlightArrival(listener: ArrivalListener): () => void {
  arrivalListeners.add(listener)
  return () => arrivalListeners.delete(listener)
}

export function launchSaveFlight(gradient: Gradient, fromElement: Element | null) {
  if (!fromElement) return
  const from = fromElement.getBoundingClientRect()
  // A zero-size rect means the element isn't laid out (jsdom, or chrome that
  // was removed between the tap and this call) — there is nothing to fly from.
  if (from.width === 0 || from.height === 0) return
  const flight: SaveFlight = { id: nextId++, gradient, from }
  flightListeners.forEach((listener) => listener(flight))
}

/**
 * The Save pill currently on screen, so a save fired from the keyboard flies
 * from exactly where a click would have launched it.
 *
 * Pressing S used to call the store directly and skip the flight entirely, so
 * the two ways of doing the same thing gave completely different feedback —
 * the mouse got a gradient sailing into the Gallery, the keyboard got a label
 * quietly changing to "Saved".
 *
 * A DOM query rather than a registered ref: three surfaces render a Save pill
 * (the feed, the editor, the gallery viewer) and only ever one at a time, so
 * there is nothing to disambiguate and nothing to keep in sync.
 */
export function saveFlightOrigin(): Element | null {
  if (typeof document === 'undefined') return null
  return document.querySelector('[data-testid="like-button"]')
}

export function announceSaveFlightArrival() {
  arrivalListeners.forEach((listener) => listener())
}

/** Honoured by the flight layer AND by the tab bar's landing bump, so the
 * whole effect degrades to an instant state change rather than half of it. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
