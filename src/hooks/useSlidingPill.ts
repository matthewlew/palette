import { useEffect, useRef } from 'react'

/**
 * Drives a pill that slides beneath whichever item in a 2+-way toggle is
 * currently active — the shared mechanics behind TabBar's Gallery/Create
 * switch, Gallery's Yours/Community tabs, and GeometryTabs' Shape/Effect
 * tabs. Position and width are measured off the active item's own real box
 * and written to the pill as inline styles, so the CSS transition tweens
 * between the previous and next actual layout instead of a guessed one.
 *
 * `registerItem(key)` returns a ref callback — pass it to each item's `ref`
 * prop, keyed by the same value passed as `activeKey`. `pillRef` goes on a
 * `position: absolute` sibling positioned by its host's own CSS (see
 * TabBar.module.css's `.pill` for the shape of that rule).
 */
export function useSlidingPill(activeKey: string) {
  const pillRef = useRef<HTMLSpanElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  function registerItem(key: string) {
    return (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(key, el)
      else itemRefs.current.delete(key)
    }
  }

  function movePill(animate: boolean) {
    const item = itemRefs.current.get(activeKey)
    const pill = pillRef.current
    if (!item || !pill) return
    const left = item.offsetLeft
    const width = item.offsetWidth
    if (!animate) {
      const prevTransition = pill.style.transition
      pill.style.transition = 'none'
      pill.style.transform = `translateX(${left}px)`
      pill.style.width = `${width}px`
      void pill.offsetWidth
      pill.style.transition = prevTransition
    } else {
      pill.style.transform = `translateX(${left}px)`
      pill.style.width = `${width}px`
    }
  }

  useEffect(() => {
    movePill(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => movePill(false))
    const onResize = () => movePill(false)
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(id)
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { pillRef, registerItem }
}
