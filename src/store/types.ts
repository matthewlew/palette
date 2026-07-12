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
  /** Which edge a fan gradient rises from; defaults to 'bottom'. */
  fanAnchor?: FanAnchor
  createdAt?: number
  note?: string
}

// 'create' is the home surface (the rolodex feed); 'gallery' is your saved
// pins; 'edit' is reachable only from create.
export type ViewMode = 'create' | 'gallery' | 'edit'

/** Bias levers for Phase 2's variant generator; stored now so a collection
 * carries its recipe. 0–100, 50 = neutral. Unused by Phase 1 UI. */
export interface CollectionLevers {
  temp: number
  depth: number
  char: number
}

/** A labeled subset of `saved` — Pinterest-style board. Holds gradient ids
 * only (never copies), so "All" always contains everything and removing from
 * a collection never deletes the gradient. */
export interface Collection {
  id: string
  name: string
  createdAt: number
  gradientIds: string[]
  levers: CollectionLevers
}

export const NEUTRAL_LEVERS: CollectionLevers = { temp: 50, depth: 50, char: 50 }
