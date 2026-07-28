import type { FanAnchor, GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  /** Deterministic, human-facing name derived from this gradient's colors
   * (see src/lib/naming.ts). Present on saved/shared gradients; absent on
   * freshly generated feed gradients until saved. */
  name?: string
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
  /** Densify the blend with Oklab-eased interior stops for seamless
   * transitions. Mutually exclusive with hardStops. */
  smoothEnabled?: boolean
  fanAnchor?: FanAnchor
  /** Rotation angle in degrees (0-360) */
  angle?: number
  createdAt?: number
  note?: string
  /** How many people have liked this in the community feed. Only meaningful on
   * gradients read from the shared table — a local save has no row to count. */
  likeCount?: number
}

// 'create' is the home surface (the rolodex feed); 'gallery' is your saved
// pins; 'edit' is reachable only from create.
export type ViewMode = 'create' | 'gallery' | 'edit'

