/**
 * Given a pointer's Y coordinate and the vertical midpoints of each existing
 * block (in the same coordinate space), returns the index at which a new
 * block should be inserted.
 */
export function verticalInsertionIndex(pointerY: number, blockMidpoints: number[]): number {
  for (let i = 0; i < blockMidpoints.length; i++) {
    if (pointerY < blockMidpoints[i]) return i
  }
  return blockMidpoints.length
}

/**
 * Given a pointer angle in degrees (0-360, measured from the same origin the
 * wheel wedges use) and the current wedge count, returns the index of the
 * nearest wedge boundary to insert at.
 */
export function wheelInsertionIndex(pointerAngleDeg: number, wedgeCount: number): number {
  const normalized = ((pointerAngleDeg % 360) + 360) % 360
  const wedgeDegrees = 360 / wedgeCount
  return Math.round(normalized / wedgeDegrees) % wedgeCount
}
