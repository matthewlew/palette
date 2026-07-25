import { useEffect, useRef, useState } from 'react'

const DRAG_START_DELAY_MS = 150
const SWAP_THRESHOLD_PX = 48

function vibrateStep() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accumulatedDeltaRef = useRef(0)
  const lastPointerYRef = useRef<number | null>(null)
  // Mirrors the latest `items` into a ref on every render so pointer-move
  // handlers (which fire between renders) always see the current list. Safe
  // to assign during render: nothing reads it synchronously in this same
  // render, only later from event-handler closures after commit.
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
      }
    }
  }, [])

  function handlePointerDown(index: number, clientY: number) {
    lastPointerYRef.current = clientY
    startTimeoutRef.current = setTimeout(() => {
      draggingIndexRef.current = index
      setDraggingIndex(index)
    }, DRAG_START_DELAY_MS)
  }

  function trySwap(direction: 1 | -1): boolean {
    const from = draggingIndexRef.current
    if (from === null) return false
    const to = from + direction
    if (to < 0 || to >= itemsRef.current.length) return false
    const next = moveItem(itemsRef.current, from, to)
    onReorder(next)
    draggingIndexRef.current = to
    setDraggingIndex(to)
    vibrateStep()
    return true
  }

  function handlePointerMove(clientY: number) {
    if (draggingIndexRef.current === null) return
    if (lastPointerYRef.current === null) {
      lastPointerYRef.current = clientY
      return
    }
    // Dragging down moves the item to a later index — the natural,
    // non-inverted mapping for reordering a list. This is the opposite sign
    // convention from Feed.tsx's scroll handling, which deliberately inverts
    // "drag up" to mean "scroll forward"; the two aren't the same operation.
    accumulatedDeltaRef.current += clientY - lastPointerYRef.current
    lastPointerYRef.current = clientY

    while (accumulatedDeltaRef.current >= SWAP_THRESHOLD_PX) {
      accumulatedDeltaRef.current -= SWAP_THRESHOLD_PX
      if (!trySwap(1)) {
        accumulatedDeltaRef.current = 0
        break
      }
    }
    while (accumulatedDeltaRef.current <= -SWAP_THRESHOLD_PX) {
      accumulatedDeltaRef.current += SWAP_THRESHOLD_PX
      if (!trySwap(-1)) {
        accumulatedDeltaRef.current = 0
        break
      }
    }
  }

  function handlePointerUp() {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }
    draggingIndexRef.current = null
    setDraggingIndex(null)
    accumulatedDeltaRef.current = 0
    lastPointerYRef.current = null
  }

  return { draggingIndex, handlePointerDown, handlePointerMove, handlePointerUp }
}
