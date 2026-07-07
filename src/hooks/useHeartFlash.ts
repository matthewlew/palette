import { useEffect, useRef, useState } from 'react'

const FLASH_DURATION_MS = 500

export function useHeartFlash() {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  function flash() {
    setVisible(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
      timeoutRef.current = null
    }, FLASH_DURATION_MS)
  }

  return { visible, flash }
}
