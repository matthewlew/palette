const MOMENTUM_VELOCITY_THRESHOLD = 0.3 // px/ms
const DECAY_PER_60FPS_FRAME = 0.95
const REFERENCE_FRAME_MS = 16.67

/** Exponentially decays velocity, normalized so the decay rate is
 * independent of actual frame duration (frame drops don't change the
 * effective deceleration curve over wall-clock time). */
export function decayVelocity(v: number, frameDtMs: number): number {
  return v * Math.pow(DECAY_PER_60FPS_FRAME, frameDtMs / REFERENCE_FRAME_MS)
}

/** Whether a touchend velocity (px/ms) is fast enough to kick off a
 * momentum animation, using absolute magnitude (direction-agnostic). */
export function shouldStartMomentum(v: number): boolean {
  return Math.abs(v) > MOMENTUM_VELOCITY_THRESHOLD
}
