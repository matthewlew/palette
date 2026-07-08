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
          const isMajor = t % 5 === 0
          // Ticks fade toward the ends of the window so new marks ease in
          // instead of popping into existence at full strength.
          const distance = Math.abs(t - index)
          const fade = Math.max(0, 1 - distance / WINDOW)
          return (
            <div
              key={t}
              data-testid={isActive ? 'ticker-tick-active' : 'ticker-tick'}
              className={isActive ? styles.tickActive : isMajor ? styles.tickMajor : styles.tick}
              style={{ top: `${t * TICK_SPACING_PX}px`, opacity: isActive ? 1 : fade }}
            />
          )
        })}
      </div>
    </div>
  )
}
