import { useEffect, useRef } from 'react'
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
            style={{ backgroundColor: hex }}
            onPointerDown={() => handlePointerDown(hex)}
          />
        )
      })}
    </div>
  )
}
