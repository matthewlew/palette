import type { GradientStop, GradientType } from '../lib/gradient'

export interface Gradient {
  id: string
  type: GradientType
  stops: GradientStop[]
}

export type ViewMode = 'explore' | 'edit'
