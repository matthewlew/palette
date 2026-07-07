import type { GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  type: GradientType
  stops: GradientStop[]
  // Whether the stop order is flipped for CSS rendering. Optional/defaults
  // to false — does not mutate the underlying `stops` array order.
  reversed?: boolean
}

export type ViewMode = 'explore' | 'edit'
