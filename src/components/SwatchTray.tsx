import { useEffect, useMemo, useRef, useState } from 'react'
import { oklchToHex } from '../lib/oklch'
import { selectedSwatchHexes } from '../lib/swatchMatch'
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
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
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
      // A mostly-horizontal move before the hold elapses is the user
      // scrolling the tray, not tapping or dragging a swatch — cancel both
      // so the scroll doesn't accidentally select a color.
      if (!draggingHexRef.current && pendingHexRef.current && startPointRef.current) {
        const dx = e.clientX - startPointRef.current.x
        const dy = e.clientY - startPointRef.current.y
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current)
            startTimeoutRef.current = null
          }
          pendingHexRef.current = null
          startPointRef.current = null
        }
      }
      if (draggingHexRef.current && onDragMove) {
        onDragMove({ x: e.clientX, y: e.clientY })
      }
    }

    function handleWindowPointerCancel() {
      // Native horizontal pan took over (touch-action: pan-x) — abandon any
      // pending tap or drag.
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      draggingHexRef.current = null
      pendingHexRef.current = null
      startPointRef.current = null
      setDraggingHex(null)
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
      startPointRef.current = null
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
    window.addEventListener('pointercancel', handleWindowPointerCancel)
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerCancel)
    }
  }, [onDragAdd, onDragMove, onTapAdd, onTapRemove])

  function handlePointerDown(hex: string, e: React.PointerEvent) {
    pendingHexRef.current = hex
    startPointRef.current = { x: e.clientX, y: e.clientY }
    startTimeoutRef.current = setTimeout(() => {
      draggingHexRef.current = hex
      setDraggingHex(hex)
    }, DRAG_START_DELAY_MS)
  }

  const selectedHexes = useMemo(
    () => selectedSwatchHexes(stops.map((s) => s.hex), colorSet),
    [stops, colorSet]
  )

  const trayRef = useRef<HTMLDivElement>(null)

  function handleWheel(e: React.WheelEvent) {
    const el = trayRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }

  return (
    <div ref={trayRef} className={styles.tray} onWheel={handleWheel}>
      {colorSet.colors.map((color) => {
        const hex = oklchToHex(color.value)
        const selected = selectedHexes.has(hex)
        return (
          <button
            key={color.name}
            type="button"
            data-testid="swatch"
            aria-label={color.name}
            title={color.name}
            className={selected ? styles.swatchSelected : styles.swatch}
            style={{ opacity: draggingHex === hex ? 0.6 : 1 }}
            onPointerDown={(e) => handlePointerDown(hex, e)}
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
