import { useLayoutEffect, useRef } from 'react'

/**
 * FLIP animation for grid reflow after a reorder. Grid position changes are
 * layout-driven, which CSS transitions don't animate — so we record each
 * tile's position, and after the DOM updates we translate it back to its old
 * spot with no transition, then release to `translate(0)` with a transition so
 * it glides into place.
 *
 * Only animates a pure reorder (same set of ids): when tiles are added/removed
 * (e.g. a filter change) it just records positions, leaving the entry keyframe
 * to handle the appearance. Tiles must carry `data-tile-id`.
 */
export function useFlipReorder(
  containerRef: React.RefObject<HTMLElement | null>,
  orderKey: string,
  enabled: boolean,
) {
  const prevRects = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      prevRects.current = new Map()
      return
    }

    const tiles = Array.from(
      container.querySelectorAll<HTMLElement>('[data-tile-id]'),
    )
    const prev = prevRects.current
    const next = new Map<string, DOMRect>()
    for (const tile of tiles) {
      next.set(tile.dataset.tileId as string, tile.getBoundingClientRect())
    }

    const sameSet =
      prev.size === next.size &&
      [...next.keys()].every((id) => prev.has(id))

    if (enabled && prev.size > 0 && sameSet) {
      for (const tile of tiles) {
        const id = tile.dataset.tileId as string
        const oldRect = prev.get(id) as DOMRect
        const newRect = next.get(id) as DOMRect
        const dx = oldRect.left - newRect.left
        const dy = oldRect.top - newRect.top
        if (dx === 0 && dy === 0) continue
        tile.style.transition = 'none'
        tile.style.transform = `translate(${dx}px, ${dy}px)`
        requestAnimationFrame(() => {
          tile.style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)'
          tile.style.transform = ''
        })
      }
    }

    prevRects.current = next
  }, [orderKey, enabled, containerRef])
}
