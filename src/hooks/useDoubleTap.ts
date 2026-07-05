import { useRef } from 'react'

const DOUBLE_TAP_WINDOW_MS = 300

export function useDoubleTap(onDoubleTap: () => void, onSingleTap?: () => void) {
  const lastTapRef = useRef<number>(0)
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onPointerUp() {
    const now = Date.now()
    const elapsed = now - lastTapRef.current

    if (lastTapRef.current !== 0 && elapsed >= 0 && elapsed < DOUBLE_TAP_WINDOW_MS) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current)
        singleTapTimeoutRef.current = null
      }
      lastTapRef.current = 0
      onDoubleTap()
      return
    }

    lastTapRef.current = now
    if (onSingleTap) {
      singleTapTimeoutRef.current = setTimeout(() => {
        onSingleTap()
        singleTapTimeoutRef.current = null
      }, DOUBLE_TAP_WINDOW_MS)
    }
  }

  return { onPointerUp }
}
