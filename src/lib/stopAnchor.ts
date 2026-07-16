import type { FanAnchor, GradientType } from './gradient'
import { FAN_ANCHOR_CONFIG } from './gradient'

export type SpokeDir = 'up' | 'down' | 'left' | 'right'
export type SquareCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface StopAnchorOpts {
  spoke?: SpokeDir
  corner?: SquareCorner
  fanAnchor?: FanAnchor
}

export interface AnchorPoint {
  x: number
  y: number
}

const SPOKE_VECTOR: Record<SpokeDir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -0.5 },
  down: { dx: 0, dy: 0.5 },
  left: { dx: -0.5, dy: 0 },
  right: { dx: 0.5, dy: 0 },
}

const CORNER_VECTOR: Record<SquareCorner, { dx: number; dy: number }> = {
  tl: { dx: -0.5, dy: -0.5 },
  tr: { dx: 0.5, dy: -0.5 },
  bl: { dx: -0.5, dy: 0.5 },
  br: { dx: 0.5, dy: 0.5 },
}

const ANGULAR_RADIUS = 0.32
const FAN_RADIUS = 0.35

/**
 * The "center of color volume" for a stop, as normalized canvas coords
 * (0..1) for the given geometry. Radial/square anchors pick a canonical
 * spoke/corner — cosmetic only, since those gradients render identically
 * regardless of direction. Angular/fan sample a canonical mid-radius, since
 * a ring/sector has no single center.
 */
export function stopAnchor(
  type: GradientType,
  positions: number[],
  index: number,
  opts: StopAnchorOpts = {},
): AnchorPoint {
  const p = positions[index] / 100

  switch (type) {
    case 'linear':
      return { x: 0.5, y: p }
    case 'mirror':
      return { x: 0.5, y: 0.5 * p }
    case 'radial': {
      const v = SPOKE_VECTOR[opts.spoke ?? 'up']
      return { x: 0.5 + v.dx * p, y: 0.5 + v.dy * p }
    }
    case 'square': {
      const v = CORNER_VECTOR[opts.corner ?? 'tl']
      return { x: 0.5 + v.dx * p, y: 0.5 + v.dy * p }
    }
    case 'angular': {
      const theta = p * 2 * Math.PI
      return {
        x: 0.5 + ANGULAR_RADIUS * Math.sin(theta),
        y: 0.5 - ANGULAR_RADIUS * Math.cos(theta),
      }
    }
    case 'fan': {
      const { from, px, py } = FAN_ANCHOR_CONFIG[opts.fanAnchor ?? 'bottom']
      const deg = from + p * 180
      const rad = (deg * Math.PI) / 180
      return {
        x: px + FAN_RADIUS * Math.sin(rad),
        y: py - FAN_RADIUS * Math.cos(rad),
      }
    }
    case 'repeat':
      return { x: 0.5, y: p }
  }
}
