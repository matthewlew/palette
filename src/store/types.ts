import type { GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  type: GradientType
  stops: GradientStop[]
  // Which SEED_PALETTES entry generated this gradient's colors, used to
  // populate the Edit Mode swatch carousel. Optional because gradients
  // saved before this field existed won't have it — callers must fall
  // back to a default palette when absent.
  seedName?: string
  // Whether the stop order is flipped for CSS rendering. Optional/defaults
  // to false — does not mutate the underlying `stops` array order.
  reversed?: boolean
}

export type ViewMode = 'explore' | 'edit'
