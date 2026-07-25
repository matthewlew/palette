import { useEffect, useState } from 'react'

const SCROLL_EVENTS = ['wheel', 'touchmove', 'scroll'] as const

export function useScrolling(settleMs = 500): boolean {
  const [scrolling, setScrolling] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function bump(e: Event) {
      const target = e.target as HTMLElement | null
      if (target && typeof target.closest === 'function' && target.closest('[data-noscroll-hide]')) {
        return
      }

      setScrolling(true)
      clearTimeout(timer)
      timer = setTimeout(() => setScrolling(false), settleMs)
    }

    for (const event of SCROLL_EVENTS) {
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
