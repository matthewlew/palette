import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import styles from './ScrollTicker.module.css'

const TICK_SPACING_PX = 14
const WINDOW = 10 // ticks rendered above and below the current index
const IDLE_FADE_MS = 1000

interface ScrollTickerProps {
  index: number
}

/** Decorative timeline on the right edge of the feed: tick marks scroll past
 * a fixed center marker as the user scrubs, making feed position obvious.
 * Appears while scrolling, fades out after 1s idle.
 *
 * Ticks live at fixed offsets inside a single translated strip so that only
 * one element animates per step — animating each tick individually restarts
 * 21 transitions per step, which reads as jank on mobile. */
export function ScrollTicker({ index }: ScrollTickerProps) {
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

  const tickIndices = Array.from({ length: WINDOW * 2 + 1 }, (_, i) => index - WINDOW + i).filter((t) => t >= 0)

  return (
    <div data-testid="scroll-ticker" aria-hidden="true" className={styles.ticker} style={{ opacity: visible ? 1 : 0 }}>
      <div className={styles.strip} style={{ transform: `translateY(${-index * TICK_SPACING_PX}px)` }}>
        {tickIndices.map((t) => {
          const isActive = t === index
          // Digital-crown feel: every tick's size is a continuous function of
          // its distance from the center marker, so marks swell as they
          // approach and shrink as they leave — no class swap, no flash. The
          // squared falloff keeps growth concentrated near the center.
          const distance = Math.abs(t - index)
          const proximity = Math.max(0, 1 - distance / WINDOW)
          const scaleX = 0.4 + 0.6 * proximity * proximity
          const scaleY = 1 + proximity * proximity
          return (
            <div
              key={t}
              data-testid={isActive ? 'ticker-tick-active' : 'ticker-tick'}
              className={styles.tick}
              style={{
                top: `${t * TICK_SPACING_PX}px`,
                opacity: 0.25 + 0.75 * proximity,
                transform: `scaleX(${scaleX}) scaleY(${scaleY})`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
