import { useEffect, useRef, useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useDoubleTap } from '../hooks/useDoubleTap'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

interface GradientPageProps {
  gradient: Gradient
  onSave: (gradient: Gradient) => void
  onEdit: () => void
}

export function GradientPage({ gradient, onSave, onEdit }: GradientPageProps) {
  const [showHeart, setShowHeart] = useState(false)
  const heartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (heartTimeoutRef.current) {
        clearTimeout(heartTimeoutRef.current)
      }
    }
  }, [])

  function handleDoubleTap() {
    onSave(gradient)
    setShowHeart(true)
    heartTimeoutRef.current = setTimeout(() => {
      setShowHeart(false)
      heartTimeoutRef.current = null
    }, 500)
  }

  const { onPointerUp } = useDoubleTap(handleDoubleTap, onEdit)

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerUp={onPointerUp}
    >
      {showHeart && (
        <svg data-testid="heart-flash" className={styles.heartFlash} viewBox="0 0 32 32">
          <polygon points="16,4 20,12 28,12 22,18 24,28 16,22 8,28 10,18 4,12 12,12" fill="white" />
        </svg>
      )}
    </div>
  )
}
