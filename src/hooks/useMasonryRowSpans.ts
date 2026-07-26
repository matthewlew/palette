import { useLayoutEffect } from 'react'

// Height of one implicit grid row (must match grid-auto-rows in the CSS).
const ROW_UNIT_PX = 8

/** span for a measured height, in whole grid rows. */
function spanFor(height: number, rowGapPx: number): number {
  return Math.max(1, Math.ceil((height + rowGapPx) / (ROW_UNIT_PX + rowGapPx)))
}

/**
 * Reading-order masonry with CSS Grid. The grid uses a small `grid-auto-rows`
 * unit; each child is measured (its natural height, via offsetHeight so CSS
 * transforms like the entry animation don't skew it) and told how many rows to
 * span. Re-measures on element resize and whenever `deps` change (layout,
 * filter, or order changes).
 *
 * Requires the grid to set `align-items: start` so children are content-height,
 * not stretched to their (tiny) grid area.
 *
 * THREE THINGS THIS HAS TO GET RIGHT, all of which it previously did not — the
 * symptom was the grid flashing and jittering on mobile when returning from
 * create to gallery, from the first row down:
 *
 *  1. Read and write are separate phases. Reading `offsetHeight` right after
 *     writing a style forces a synchronous layout, so measuring and assigning
 *     in one loop cost one forced reflow PER CHILD. Now every height is read,
 *     then every span written.
 *
 *  2. Observer callbacks are coalesced into a single frame. Every child is
 *     observed and every one of them re-ran the whole pass, so a resize that
 *     touched n children cost n passes over n children — 144 forced reflows for
 *     a 12-tile grid. A view transition (which create -> gallery runs) animates
 *     tile sizes, so that storm repeated every frame of the animation. Desktop
 *     absorbs it; a phone drops frames, which is the jitter.
 *
 *  3. Writes that change nothing are skipped. Assigning a span resizes the
 *     child, which re-fires the observer that assigned it. Only writing on a
 *     real change lets that settle instead of feeding itself.
 *
 * The first pass stays synchronous, inside the layout effect, so tiles are
 * never painted at their default 8px slot.
 */
export function useMasonryRowSpans(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (!enabled) {
      for (const child of Array.from(container.children) as HTMLElement[]) {
        child.style.removeProperty('grid-row-end')
      }
      return
    }

    const apply = () => {
      const children = Array.from(container.children) as HTMLElement[]
      const rowGapPx = parseFloat(getComputedStyle(container).rowGap) || 0
      // READ everything first...
      const spans = children.map((child) => spanFor(child.offsetHeight, rowGapPx))
      // ...then WRITE, and only where it differs.
      children.forEach((child, i) => {
        const next = `span ${spans[i]}`
        if (child.style.gridRowEnd !== next) child.style.gridRowEnd = next
      })
    }

    apply()

    // ResizeObserver is absent in some test environments (jsdom); the one-shot
    // apply() above still sets initial spans there.
    if (typeof ResizeObserver === 'undefined') return

    let frame = 0
    let scheduled = false
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      frame = requestAnimationFrame(() => {
        scheduled = false
        apply()
      })
    }

    const observer = new ResizeObserver(schedule)
    for (const child of Array.from(container.children)) observer.observe(child)
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])
}
