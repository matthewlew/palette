import { useEffect, useState } from 'react'

const IDLE_EVENTS = ['pointerdown', 'pointermove', 'wheel', 'touchmove', 'keydown'] as const

/** Returns false after `timeoutMs` without user interaction, true again on
 * any interaction. Used to fade out chrome (drawer, like button) so the
 * palette can be viewed uninterrupted. */
export function useIdleFade(timeoutMs = 4000): boolean {
  const [active, setActive] = useState(true)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function arm() {
      setActive(true)
      clearTimeout(timer)
      timer = setTimeout(() => setActive(false), timeoutMs)
    }

    arm()
    for (const event of IDLE_EVENTS) {
      window.addEventListener(event, arm, { passive: true })
    }
    return () => {
      clearTimeout(timer)
      for (const event of IDLE_EVENTS) {
        window.removeEventListener(event, arm)
      }
    }
  }, [timeoutMs])

  return active
}
