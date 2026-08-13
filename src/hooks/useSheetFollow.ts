import { useEffect, useRef, useState } from 'react'

/** How long to keep tracking after the finger lifts, so the preview follows
 * the drawer's own release animation home instead of cutting to the end. Base
 * UI's swipe release settles well inside this; the settle check below normally
 * ends tracking before it elapses. */
const RELEASE_TAIL_MS = 700

/** Two consecutive frames within this many pixels means the drawer has come to
 * rest, and there is nothing left to follow. */
const SETTLED_EPSILON_PX = 0.5

export interface SheetFollow {
  /** Pixels of the sheet currently covering the bottom of the viewport, or
   * null when nothing is being followed and the caller should use its own
   * measured height. */
  visible: number | null
  /** True while a drag (or its release animation) is in flight. */
  following: boolean
}

/**
 * Follows a bottom sheet's real on-screen coverage, frame by frame, while it
 * is being dragged.
 *
 * The preview above the sheet is sized from the sheet's measured height, and a
 * ResizeObserver keeps that honest — but a swipe does not resize the sheet, it
 * *translates* it. Nothing fires, the measured height stays put, and the only
 * signal is the drawer's open/closed state, which flips once at the end of the
 * gesture. So the gradient sat at its old size for the whole drag and then
 * jumped, instead of growing under the finger.
 *
 * Reading the rect each frame catches the translation the observer cannot see.
 * It runs only between pointerdown on the sheet and the moment the drawer
 * comes to rest afterwards — a layout read per frame is cheap, but not cheap
 * enough to leave running for the whole of edit mode.
 *
 * Coverage, not height: what the preview needs to know is how much of the
 * viewport's bottom the sheet is eating, which is the part of it still on
 * screen. A sheet dragged halfway off the bottom covers half its height.
 */
export function useSheetFollow(el: HTMLElement | null, enabled: boolean): SheetFollow {
  const [visible, setVisible] = useState<number | null>(null)
  const [following, setFollowing] = useState(false)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!el || !enabled) {
      setVisible(null)
      setFollowing(false)
      return
    }

    let pointerDown = false
    let releasedAt = 0
    let last = Number.NaN

    function coverage(node: HTMLElement): number {
      const rect = node.getBoundingClientRect()
      // Clamped to the sheet's own height: a sheet sitting fully on screen
      // covers its height and no more, however tall the viewport is.
      return Math.max(0, Math.min(rect.height, window.innerHeight - rect.top))
    }

    function stop() {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      setFollowing(false)
      // Hand sizing back to the measured height, which by now agrees with
      // where the drawer actually settled.
      setVisible(null)
    }

    function tick() {
      if (!el) return
      const now = coverage(el)
      setVisible(now)

      const settled = Math.abs(now - last) < SETTLED_EPSILON_PX
      last = now

      // Only a released drag can end: while the finger is down the sheet may
      // be held perfectly still and then moved again.
      if (!pointerDown && settled) {
        stop()
        return
      }
      if (!pointerDown && performance.now() - releasedAt > RELEASE_TAIL_MS) {
        stop()
        return
      }
      frameRef.current = requestAnimationFrame(tick)
    }

    function onPointerDown() {
      pointerDown = true
      last = Number.NaN
      setFollowing(true)
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick)
    }

    function onPointerUp() {
      if (!pointerDown) return
      pointerDown = false
      releasedAt = performance.now()
      // `last` is reset so the first post-release frame can never look settled
      // by comparing against a frame from before the finger lifted.
      last = Number.NaN
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [el, enabled])

  return { visible, following }
}
