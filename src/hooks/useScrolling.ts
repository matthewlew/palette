import { useEffect, useState } from 'react'

// Wheel/touch/scroll all signal an in-progress scroll. The feed drives its
// rolodex with custom wheel/touch handlers (no native scroll event), so those
// are listened for directly alongside the Gallery's native scroll.
const SCROLL_EVENTS = ['wheel', 'touchmove', 'scroll'] as const

/** Returns true while the user is actively scrolling, flipping back to false
 * `settleMs` after the last scroll event. Used to duck the bottom tab bar out
 * of the way during a scroll and bring it back once motion settles. */
export function useScrolling(settleMs = 500): boolean {
  const [scrolling, setScrolling] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function bump() {
      setScrolling(true)
      clearTimeout(timer)
      timer = setTimeout(() => setScrolling(false), settleMs)
    }

    for (const event of SCROLL_EVENTS) {
      // Capture so it fires even when a child stops propagation, passive so it
      // never blocks the scroll it's observing.
      window.addEventListener(event, bump, { passive: true, capture: true })
    }
    return () => {
      clearTimeout(timer)
      for (const event of SCROLL_EVENTS) {
        window.removeEventListener(event, bump, { capture: true })
      }
    }
  }, [settleMs])

  return scrolling
}
