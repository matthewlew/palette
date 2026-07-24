import type { FanAnchor, GradientType } from './gradient'
import { FAN_ANCHOR_CONFIG } from './gradient'

export type SpokeDir = 'up' | 'down' | 'left' | 'right'

export interface StopAnchorOpts {
  /** Which vertical/horizontal spoke the radial and square handles run along.
   * Cosmetic: those gradients are symmetric, so this only moves the dots. */
  spoke?: SpokeDir
  fanAnchor?: FanAnchor
  /** Repeat ×2 packs two cycles of the palette into the same area, so each
   * color's block is half-size. Map handles into the first cycle so they land
   * on the (smaller) blocks instead of spanning the whole area. */
  repeat?: boolean
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
  // Repeat packs the palette into the first half of the axis (a second cycle
  // fills the rest), so a repeated handle rides the first cycle at half offset.
  const cycle = opts.repeat ? 0.5 : 1
  const p = (positions[index] / 100) * cycle

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
      // Evenly spread by index to match buildAngularGradient (i/n around the
      // full circle). The pixel placement (a circle vs the canvas's aspect) is
      // handled by the caller; here we only fix the angle.
      const count = positions.length
      // Repeat squeezes the sweep into the first half-circle (the second cycle
      // fills the rest), so handles ride that first semicircle.
      const theta = (index / count) * 2 * Math.PI * cycle
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
