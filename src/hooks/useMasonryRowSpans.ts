import { useLayoutEffect } from 'react'

// Height of one implicit grid row (must match grid-auto-rows in the CSS).
const ROW_UNIT_PX = 8

/**
 * Reading-order masonry with CSS Grid. The grid uses a small `grid-auto-rows`
 * unit; each child is measured (its natural height, via offsetHeight so CSS
 * transforms like the entry animation don't skew it) and told how many rows to
 * span. Re-measures on element resize and whenever `deps` change (layout,
 * filter, or order changes).
 *
 * Requires the grid to set `align-items: start` so children are content-height,
 * not stretched to their (tiny) grid area.
 */
export function useMasonryRowSpans(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const rowGapPx = parseFloat(getComputedStyle(container).rowGap) || 0
    const children = Array.from(container.children) as HTMLElement[]

    const apply = () => {
      for (const child of children) {
        const height = child.offsetHeight
        const span = Math.max(
          1,
          Math.round((height + rowGapPx) / (ROW_UNIT_PX + rowGapPx)),
        )
        child.style.gridRowEnd = `span ${span}`
      }
    }

    apply()
    // ResizeObserver is absent in some test environments (jsdom); the one-shot
    // apply() above still sets initial spans there.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(apply)
    children.forEach((child) => observer.observe(child))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
