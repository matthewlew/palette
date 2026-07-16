export interface PixelPoint {
  x: number
  y: number
}

function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Index of the anchor closest to `cursor`, in pixel space. Anchors list must
 * be non-empty. */
export function nearestAnchorIndex(anchors: PixelPoint[], cursor: PixelPoint): number {
  let best = 0
  let bestDist = Infinity
  anchors.forEach((a, i) => {
    const d = distance(a, cursor)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })
  return best
}

/** Index of the nearest anchor within `thresholdPx` of the cursor, or null if
 * none are that close (or the list is empty). Used for proximity reveal. */
export function anchorWithinThreshold(
  anchors: PixelPoint[],
  cursor: PixelPoint,
  thresholdPx: number,
): number | null {
  if (anchors.length === 0) return null
  const i = nearestAnchorIndex(anchors, cursor)
  return distance(anchors[i], cursor) <= thresholdPx ? i : null
}
