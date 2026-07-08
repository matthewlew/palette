import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { TurrellSquare } from './TurrellSquare'
import { LikeButton } from './LikeButton'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 10

interface GradientPageProps {
  gradient: Gradient
  liked: boolean
  onToggleLike: () => void
  onEdit: () => void
}

export function GradientPage({ gradient, liked, onToggleLike, onEdit }: GradientPageProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
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
        backgroundImage: gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <LikeButton liked={liked} onToggle={onToggleLike} />
    </div>
  )
}
