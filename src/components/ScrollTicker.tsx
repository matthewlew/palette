import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import styles from './ScrollTicker.module.css'

const TICK_SPACING_PX = 14
const WINDOW = 10 // ticks rendered above and below the current index
const IDLE_FADE_MS = 1000

interface ScrollTickerProps {
  index: number
  /** Text shown beside the active tick instead of the 1-based position. The
   * Create feed leaves this off (its gradients are numbered); the Gallery
   * passes the palette's name, since a saved gradient reads by name, not by
   * its spot in the list. */
  label?: string
  /** Total number of items in a finite list (the Gallery). When set, ticks
   * are capped to `[0, total-1]` so the timeline reflects the real count
   * instead of a phantom ±WINDOW range. The Create feed is unbounded and
   * omits this. */
  total?: number
  hidden?: boolean
}

/** Decorative timeline on the right edge of the feed: tick marks scroll past
 * a fixed center marker as the user scrubs, making feed position obvious.
 * Appears while scrolling, fades out after 1s idle.
 *
 * Ticks live at fixed offsets inside a single translated strip so that only
 * one element animates per step — animating each tick individually restarts
 * 21 transitions per step, which reads as jank on mobile. */
export function ScrollTicker({ index, label, total, hidden }: ScrollTickerProps) {
  const [visible, setVisible] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setVisible(true)
    const timer = setTimeout(() => {
      flushSync(() => setVisible(false))
    }, IDLE_FADE_MS)
    return () => clearTimeout(timer)
  }, [index])

  const tickIndices = Array.from({ length: WINDOW * 2 + 1 }, (_, i) => index - WINDOW + i).filter(
    (t) => t >= 0 && (total === undefined || t < total),
  )

  return (
    <div data-testid="scroll-ticker" aria-hidden="true" className={styles.ticker} style={{ opacity: visible && !hidden ? 1 : 0 }}>
      <div className={styles.strip} style={{ transform: `translateY(${-index * TICK_SPACING_PX}px)` }}>
        {/* Lives inside the translated strip at the active tick's offset, so
            it scrolls with the marks and reads as a counter ticking up/down. */}
        <div data-testid="ticker-count" className={styles.count} style={{ top: `${index * TICK_SPACING_PX}px` }}>
          {label ?? index + 1}
        </div>
        {tickIndices.map((t) => {
          const isActive = t === index
          // Digital-crown feel: every tick's size is a continuous function of
          // its distance from the center marker, so marks swell as they
          // approach and shrink as they leave — no class swap, no flash. The
          // squared falloff keeps growth concentrated near the center.
          const distance = Math.abs(t - index)
          const proximity = Math.max(0, 1 - distance / WINDOW)
          // Ticks keep one uniform thickness (a real crown's marks don't
          // fatten); only width and opacity swell toward the center, with a
          // cubic falloff plus a discrete boost on the selected tick so it
          // reads as clearly "chosen", not just the peak of a subtle wave.
          const falloff = proximity * proximity * proximity
          const scaleX = isActive ? 1.7 : 0.35 + 0.55 * falloff
          return (
            <div
              key={t}
              data-testid={isActive ? 'ticker-tick-active' : 'ticker-tick'}
              className={styles.tick}
              style={{
                top: `${t * TICK_SPACING_PX}px`,
                opacity: isActive ? 1 : 0.2 + 0.55 * falloff,
                transform: `scaleX(${scaleX})`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
