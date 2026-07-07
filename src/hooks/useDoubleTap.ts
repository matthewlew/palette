import { useEffect, useRef } from 'react'

const DOUBLE_TAP_WINDOW_MS = 300

export function useDoubleTap(onDoubleTap: () => void, onSingleTap?: () => void) {
  // null means "no prior tap yet" — distinct from a real Date.now() timestamp,
  // which could theoretically be 0 only at the Unix epoch.
  const lastTapRef = useRef<number | null>(null)
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current)
      }
    }
  }, [])

  function onPointerUp() {
    const now = Date.now()
    const elapsed = lastTapRef.current === null ? Infinity : now - lastTapRef.current

    // elapsed >= 0 (not > 0) because two synchronous pointerup events can land
    // in the same millisecond under Date.now()'s resolution.
    if (elapsed >= 0 && elapsed < DOUBLE_TAP_WINDOW_MS) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current)
        singleTapTimeoutRef.current = null
      }
      lastTapRef.current = null
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
