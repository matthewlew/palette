import { useEffect, useState } from 'react'

/** The width at which the edit sheet stops being a bottom sheet and becomes a
 * fixed side panel. Must stay in step with the `min-width: 768px` queries in
 * EditMode.module.css and GeometryTabs.module.css. */
const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * Live answer to "is the sheet a side panel right now?".
 *
 * Several behaviours are only correct on one of the two layouts — ducking the
 * chrome during a canvas drag, for one: on the bottom sheet it clears the way,
 * but on the side panel it slides 340px of layout out and the preview grows to
 * fill it, so the handle you are dragging moves out from under the pointer.
 * Reading matchMedia once at mount was not enough, because a window resize (or
 * a rotation) crosses the breakpoint without remounting.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(DESKTOP_QUERY).matches
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setIsDesktop(query.matches)
    sync()
    // addListener is the Safari <14 spelling; jsdom's stub has neither, hence
    // the optional calls rather than a hard reference.
    query.addEventListener?.('change', sync)
    return () => query.removeEventListener?.('change', sync)
  }, [])

  return isDesktop
}
