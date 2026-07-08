import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useAppStore } from '../store/useAppStore'
import { TurrellSquare } from './TurrellSquare'
import { LikeButton } from './LikeButton'
import { GrainButton } from './GrainButton'
import { NoiseOverlay } from './NoiseOverlay'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 10

interface GradientPageProps {
  gradient: Gradient
  liked: boolean
  onToggleLike: () => void
  onEdit: () => void
  /** When false, the like button fades out for uninterrupted viewing. */
  chromeVisible?: boolean
}

export function GradientPage({ gradient, liked, onToggleLike, onEdit, chromeVisible = true }: GradientPageProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const toggleNoise = useAppStore((s) => s.toggleNoise)

  function handlePointerDown(e: React.PointerEvent) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    // Taps on buttons (like, grain) must never double as "enter edit mode" —
    // child stopPropagation alone is unreliable across iOS pointer/touch
    // event synthesis, so guard by target here too.
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > TAP_MOVEMENT_THRESHOLD_PX) {
        return
      }
    }
    onEdit()
  }

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage:
          gradient.type === 'square'
            ? undefined
            : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                repeat: gradient.repeatEnabled,
                hard: gradient.hardStops,
              }),
        touchAction: 'manipulation',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <NoiseOverlay visible={noiseEnabled} />
      <GrainButton enabled={noiseEnabled} onToggle={toggleNoise} hidden={!chromeVisible} />
      <LikeButton liked={liked} onToggle={onToggleLike} hidden={!chromeVisible} />
    </div>
  )
}
