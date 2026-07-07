import { useState } from 'react'

function storageKey(key: string): string {
  return `palette-hint-${key}`
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(storageKey(key)) !== null
  } catch {
    return false
  }
}

export function useHint(key: string): { visible: boolean; dismiss: () => void } {
  const [dismissed, setDismissed] = useState(() => readDismissed(key))

  function dismiss() {
    try {
      localStorage.setItem(storageKey(key), '1')
    } catch {
      // private mode / storage unavailable — still hide for this session
    }
    setDismissed(true)
  }

  return { visible: !dismissed, dismiss }
}
