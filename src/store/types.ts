import type { GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  type: GradientType
  stops: GradientStop[]
  // Whether the stop order is flipped for CSS rendering. Optional/defaults
  // to false — does not mutate the underlying `stops` array order.
  reversed?: boolean
  // Filters layered on top of any geometry type (see lib/gradient.ts
  // GradientFilters) — cycle the stop sequence twice, or render hard color
  // bands instead of a smooth blend.
  repeatEnabled?: boolean
  hardStops?: boolean
}

export type ViewMode = 'explore' | 'edit'
