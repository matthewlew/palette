import type { FanAnchor, GradientType } from './gradient'
import { FAN_ANCHOR_CONFIG } from './gradient'

export type SpokeDir = 'up' | 'down' | 'left' | 'right'

export interface StopAnchorOpts {
  /** Which vertical/horizontal spoke the radial and square handles run along.
   * Cosmetic: those gradients are symmetric, so this only moves the dots. */
  spoke?: SpokeDir
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
      // TurrellSquare nests by position: a stop at position p renders a
      // centered square of side (100 - 0.8p)%, so its edge sits at distance
      // half(p) = 0.5 - 0.4p from center. Each color is visible in the ring
      // between its own edge and the next (smaller) stop's edge; the innermost
      // stop fills to the center. Anchor each handle at the MIDDLE of its ring
      // along the chosen spoke, so the dots land on the color blocks (this is
      // most visible with hard stops, where the rings are crisp).
      const v = SPOKE_VECTOR[opts.spoke ?? 'up']
      const half = (pos: number) => 0.5 - 0.4 * (pos / 100)
      const outer = half(positions[index])
      const inner = index < positions.length - 1 ? half(positions[index + 1]) : 0
      const r = (outer + inner) / 2
      return { x: 0.5 + v.dx * 2 * r, y: 0.5 + v.dy * 2 * r }
    }
    case 'angular': {
      const count = positions.length
      const scale = count > 1 ? count / (count + 1) : 1
      const theta = p * scale * 2 * Math.PI
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
