import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { generateGradientStops } from '../lib/palette'
import { GradientPage } from './GradientPage'
import type { GradientType } from '../lib/gradient'
import type { Gradient } from '../store/types'
import styles from './Feed.module.css'

const GEOMETRY_TYPES: GradientType[] = ['linear', 'radial', 'angular', 'square']

function pickRandomType(): GradientType {
  return GEOMETRY_TYPES[Math.floor(Math.random() * GEOMETRY_TYPES.length)]
}

function makeGradient(): Gradient {
  return {
    id: crypto.randomUUID(),
    type: pickRandomType(),
    stops: generateGradientStops(),
  }
}

const SCROLL_BOUNDARY_PX = 100

export function Feed() {
  const current = useAppStore((s) => s.current)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const enterEditMode = useAppStore((s) => s.enterEditMode)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!current) {
      setCurrentGradient(makeGradient())
    }
  }, [current, setCurrentGradient])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < SCROLL_BOUNDARY_PX) {
      setCurrentGradient(makeGradient())
    }
  }

  if (!current) return null

  return (
    <div
      data-testid="feed-container"
      ref={containerRef}
      className={styles.container}
      onScroll={handleScroll}
    >
      <GradientPage gradient={current} onSave={saveGradient} onEdit={enterEditMode} />
    </div>
  )
}
