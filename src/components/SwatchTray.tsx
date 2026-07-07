import { useEffect, useRef, useState } from 'react'
import { oklchToHex } from '../lib/oklch'
import type { ColorSet } from '../lib/colorSets'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './SwatchTray.module.css'

const DRAG_START_DELAY_MS = 150

interface SwatchTrayProps {
  colorSet: ColorSet
  stops: EditableStop[]
  onTapAdd: (hex: string) => void
  onTapRemove: (hex: string) => void
  onDragAdd: (hex: string, point: { x: number; y: number }) => void
  onDragMove?: (point: { x: number; y: number }) => void
}

export function SwatchTray({ colorSet, stops, onTapAdd, onTapRemove, onDragAdd, onDragMove }: SwatchTrayProps) {
  // Set once a 150ms hold has elapsed without a pointerup: distinguishes a
  // press-and-drag from a plain tap, same threshold as BlockStack/BlockWheel
  // reordering.
  const draggingHexRef = useRef<string | null>(null)
  // Set immediately on pointerdown, cleared on pointerup regardless of
  // whether the hold elapsed — lets pointerup tell a tap from a drag.
  const pendingHexRef = useRef<string | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draggingHex, setDraggingHex] = useState<string | null>(null)
  const stopsRef = useRef(stops)
  stopsRef.current = stops

  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    function handleWindowPointerMove(e: PointerEvent) {
      if (draggingHexRef.current && onDragMove) {
        onDragMove({ x: e.clientX, y: e.clientY })
      }
    }

    function handleWindowPointerUp(e: PointerEvent) {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      const dragHex = draggingHexRef.current
      const tapHex = pendingHexRef.current
      draggingHexRef.current = null
      pendingHexRef.current = null
      setDraggingHex(null)

      if (dragHex) {
        onDragAdd(dragHex, { x: e.clientX, y: e.clientY })
        return
      }
      if (tapHex) {
        const isSelected = stopsRef.current.some((s) => s.hex === tapHex)
        if (isSelected) {
          onTapRemove(tapHex)
        } else {
          onTapAdd(tapHex)
        }
      }
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
    }
  }, [onDragAdd, onDragMove, onTapAdd, onTapRemove])

  function handlePointerDown(hex: string) {
    pendingHexRef.current = hex
    startTimeoutRef.current = setTimeout(() => {
      draggingHexRef.current = hex
      setDraggingHex(hex)
    }, DRAG_START_DELAY_MS)
  }

  return (
    <div className={styles.tray}>
      {colorSet.colors.map((color) => {
        const hex = oklchToHex(color.value)
        const selected = stops.some((s) => s.hex === hex)
        return (
          <button
            key={color.name}
            type="button"
            data-testid="swatch"
            aria-label={color.name}
            className={selected ? styles.swatchSelected : styles.swatch}
            style={{ opacity: draggingHex === hex ? 0.6 : 1 }}
            onPointerDown={() => handlePointerDown(hex)}
          >
            <span className={styles.swatchColor} style={{ backgroundColor: hex }}>
              {selected && (
                <svg data-testid="swatch-checkmark" className={styles.checkmark} viewBox="0 0 16 16">
                  <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" fill="none" />
                </svg>
              )}
            </span>
            <span className={styles.label}>{color.name}</span>
          </button>
        )
      })}
    </div>
  )
}
