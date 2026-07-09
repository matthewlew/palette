import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useAppStore } from '../store/useAppStore'
import { namePalette } from '../lib/naming'
import { glassToneAt } from '../lib/glassTone'
import { TurrellSquare } from './TurrellSquare'
import { PaletteTitle } from './PaletteTitle'
import { FlutedOverlay } from './FlutedOverlay'
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
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)

  // Each glass element samples the gradient where it actually sits, so e.g.
  // the title can stay light while the corner buttons flip dark. Coordinates
  // are rough normalized anchors — tone only needs the right neighborhood.
  const titleTone = glassToneAt(gradient, 0.5, 0.06)
  const cornerTone = glassToneAt(gradient, 0.93, 0.85)

  function handlePointerDown(e: React.PointerEvent) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    // Taps on buttons (like, grain) must never double as "enter edit mode" —
    // child stopPropagation alone is unreliable across iOS pointer/touch
    // event synthesis, so guard by target here too.
    // The title's rename input isn't a <button>, so guard the whole title
    // container as well.
    if ((e.target as HTMLElement).closest('button, [data-testid="palette-title"]')) {
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
                smooth: gradient.smoothEnabled,
              }),
        touchAction: 'manipulation',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <FlutedOverlay visible={!!gradient.flutedEnabled} />
      <NoiseOverlay visible={noiseEnabled} />
      <PaletteTitle
        name={gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
        onRename={renameCurrentGradient}
        hidden={!chromeVisible}
        tone={titleTone}
      />
      <GrainButton enabled={noiseEnabled} onToggle={toggleNoise} hidden={!chromeVisible} tone={cornerTone} />
      <LikeButton liked={liked} onToggle={onToggleLike} hidden={!chromeVisible} tone={cornerTone} />
    </div>
  )
}
