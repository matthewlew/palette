import { useCallback, useRef, useState } from 'react'

const FEEDBACK_DURATION_MS = 1500

/** Copies text to the clipboard and exposes a transient `copied` flag for
 * ~1.5s afterward, so a button can swap its icon to a checkmark without
 * every call site re-implementing its own timeout. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS)
  }, [])

  return { copied, copy }
}
