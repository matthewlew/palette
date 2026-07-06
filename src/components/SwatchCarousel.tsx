import { useEffect, useRef, useState } from 'react'
import { oklchToHex } from '../lib/oklch'
import { SEED_PALETTES } from '../lib/seedPalettes'
import styles from './SwatchCarousel.module.css'

const DRAG_START_DELAY_MS = 150

interface SwatchCarouselProps {
  seedName: string
  onDragAdd: (hex: string, point: { x: number; y: number }) => void
}

export function SwatchCarousel({ seedName, onDragAdd }: SwatchCarouselProps) {
  const seed = SEED_PALETTES.find((p) => p.name === seedName) ?? SEED_PALETTES[0]
  const draggingHexRef = useRef<string | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors draggingHexRef for rendering only — dims the swatch once the hold
  // has actually activated a drag, matching BlockStack/BlockWheel's
  // dim-while-dragging feedback pattern (otherwise a user has no way to tell
  // whether their press has "activated" versus still being a pending tap).
  const [draggingHex, setDraggingHex] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    function handleWindowPointerUp(e: PointerEvent) {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      const hex = draggingHexRef.current
      draggingHexRef.current = null
      setDraggingHex(null)
      if (hex) {
        onDragAdd(hex, { x: e.clientX, y: e.clientY })
      }
    }

    window.addEventListener('pointerup', handleWindowPointerUp)
    return () => window.removeEventListener('pointerup', handleWindowPointerUp)
  }, [onDragAdd])

  function handlePointerDown(hex: string) {
    startTimeoutRef.current = setTimeout(() => {
      draggingHexRef.current = hex
      setDraggingHex(hex)
    }, DRAG_START_DELAY_MS)
  }

  return (
    <div className={styles.carousel}>
      {seed.colors.map((color, i) => {
        const hex = oklchToHex(color)
        return (
          <button
            key={i}
            type="button"
            data-testid="swatch"
            aria-label={`Add ${hex}`}
            className={styles.swatch}
            style={{ backgroundColor: hex, opacity: draggingHex === hex ? 0.6 : 1 }}
            onPointerDown={() => handlePointerDown(hex)}
          />
        )
      })}
    </div>
  )
}
