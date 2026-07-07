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
 * Appears while scrolling, fades out after 1s idle. */
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
      {tickIndices.map((t) => {
        const isActive = t === index
        const isMajor = t % 5 === 0
        return (
          <div
            key={t}
            data-testid={isActive ? 'ticker-tick-active' : 'ticker-tick'}
            className={isActive ? styles.tickActive : isMajor ? styles.tickMajor : styles.tick}
            style={{ transform: `translateY(${(t - index) * TICK_SPACING_PX}px)` }}
          >
            {isMajor && <span className={styles.tickLabel}>{t + 1}</span>}
          </div>
        )
      })}
    </div>
  )
}
