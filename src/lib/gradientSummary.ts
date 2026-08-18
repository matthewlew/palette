import { SHAPE_LABELS } from './gradient'
import type { Gradient } from '../store/types'

/**
 * One line describing what's actually on screen — shape, stop count, active
 * effects — shown as the Create feed's subtitle.
 *
 * It exists because the feed's shape/effect gestures (swipe to cycle shape,
 * the Effect chips in edit mode) change the picture with no on-screen label
 * confirming what changed or to what — a new user swiping through shapes has
 * no way to tell "Turrell" from "Angular" by name, or to confirm a swipe
 * landed rather than doing nothing. Updating this alongside the gradient is
 * what turns "the picture changed" into "it's now a Turrell".
 */
export function describeGradient(gradient: Gradient): string {
  const parts = [SHAPE_LABELS[gradient.type] ?? gradient.type]
  const n = gradient.stops.length
  parts.push(`${n} color${n === 1 ? '' : 's'}`)
  if (gradient.repeatEnabled) parts.push(`×${gradient.repeatCount ?? 2}`)
  // Mutually exclusive at the store level (toggling one clears the other),
  // so only ever one of these two shows up.
  if (gradient.hardStops) parts.push('Hard')
  else if (gradient.smoothEnabled) parts.push('Smooth')
  return parts.join(' · ')
}
