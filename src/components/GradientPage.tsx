import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useAppStore } from '../store/useAppStore'
import { namePalette } from '../lib/naming'
import { titleColorAt } from '../lib/titleColor'
import { describeGradient } from '../lib/gradientSummary'
import { TurrellSquare } from './TurrellSquare'
import { PaletteTitle } from './PaletteTitle'
import { LikeButton } from './LikeButton'
import { PlayButton } from './PlayButton'
import { LockedColors } from './LockedColors'
import { MEDIA_CHIP, MEDIA_ICON } from '../lib/mediaChrome'
import { publishPalette } from '../lib/publishPalette'
import { useStopDrift } from '../lib/useStopDrift'
import { canDrift } from '../lib/stopDrift'
import { NoiseOverlay } from './NoiseOverlay'
import type { Gradient } from '../store/types'
import { Icon } from '../icons'
import styles from './GradientPage.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 10

interface GradientPageProps {
  gradient: Gradient
  liked: boolean
  onToggleLike: () => void
  onEdit: () => void
  /** Leaves the full-screen feed for the gallery. Optional: the button only
   * renders where a caller wires it, so other GradientPage surfaces (which
   * have their own close chrome) don't grow a second one. */
  onBack?: () => void
  /** When false, the like button fades out for uninterrupted viewing. */
  chromeVisible?: boolean
}

export function GradientPage({ gradient, liked, onToggleLike, onEdit, onBack, chromeVisible = true }: GradientPageProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const motionEnabled = useAppStore((s) => s.motionEnabled)
  const toggleMotion = useAppStore((s) => s.toggleMotion)
  const lockedColors = useAppStore((s) => s.lockedColors)
  const clearColorLocks = useAppStore((s) => s.clearColorLocks)
  const lockedPositions = useAppStore((s) => s.lockedPositions)
  const clearPositionLocks = useAppStore((s) => s.clearPositionLocks)
  // Writes background-image straight to the element each frame, so the drift
  // never re-renders the tree (and never re-samples the title's ink).
  const driftRef = useStopDrift(gradient, motionEnabled)
  const driftable = canDrift(gradient.stops, gradient.type)
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)

  async function handleSave() {
    const wasSaved = liked
    onToggleLike()
    if (!wasSaved) {
      const hexes = gradient.stops.map(s => s.hex)
      const offsets = gradient.stops.map(s => s.position)
      try {
        const result = await publishPalette(hexes, gradient.type, gradient.angle, gradient.name, offsets)
        if (result?.displayName) {
          renameCurrentGradient(result.displayName)
        }
      } catch (err) {
        console.error("Failed to publish to Supabase:", err)
      }
    }
  }

  // The TITLE still samples the gradient where it sits — it is bare text with
  // nothing behind it, so it has to adapt or it disappears. The buttons no
  // longer do: they carry their own surface now (see .ghost-chip) and pinning
  // their ink is the whole point of that change.
  const titleColor = titleColorAt(gradient, 0.5, 0.06)

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
      ref={driftRef}
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
                fanAnchor: gradient.fanAnchor, angle: gradient.angle,
              }),
        touchAction: 'manipulation',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* A ✕, not a chevron. The gallery's full-screen viewer already closes
          with a ✕ in this exact spot, and these are the same kind of surface —
          a palette filling the screen, with the gallery behind it. A back
          arrow promised a step backwards through somewhere you'd been, which
          is not what it does: it leaves the full-screen view. */}
      {onBack && (
        <button
          type="button"
          data-testid="feed-back"
          aria-label="Close"
          className={[styles.backButton, MEDIA_ICON, !chromeVisible && styles.editHidden].filter(Boolean).join(' ')}
          onClick={onBack}
        >
          <Icon name="close" size="md" />
        </button>
      )}
      {gradient.type === 'square' && (
        <TurrellSquare
          stops={gradient.stops}
          reversed={gradient.reversed}
          repeatEnabled={gradient.repeatEnabled}
          blurPx={gradient.hardStops ? 0 : undefined}
          angle={gradient.angle}
        />
      )}
      <NoiseOverlay visible={noiseEnabled} />
      <LockedColors
        locked={lockedColors}
        lockedPositions={lockedPositions}
        onClear={() => {
          clearColorLocks()
          clearPositionLocks()
        }}
        hidden={!chromeVisible}
      />
      <PaletteTitle
        name={gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
        onRename={renameCurrentGradient}
        hidden={!chromeVisible}
        color={titleColor}
        subtitle={describeGradient(gradient)}
      />
      <PlayButton
        playing={motionEnabled}
        onToggle={toggleMotion}
        hidden={!chromeVisible}
        available={driftable}
      />
      <LikeButton liked={liked} onToggle={handleSave} hidden={!chromeVisible} gradient={gradient} />
      {/* Explicit, TikTok-style edit affordance, bottom LEFT. Tapping the
          gradient anywhere already opens the editor, but that's not
          discoverable — this labels the action. It sat mid-height on the right
          rail until that turned out to land entirely inside the scroll
          ticker's box; the left corner is empty and mirrors the grain/play/save
          cluster opposite. */}
      <button
        type="button"
        data-testid="edit-fab"
        aria-label="Edit gradient"
        className={[styles.editButton, MEDIA_CHIP, !chromeVisible && styles.editHidden].filter(Boolean).join(' ')}
        onClick={onEdit}
      >
        <Icon name="edit" size="md" />
        <span className={styles.editLabel}>Edit</span>
      </button>
    </div>
  )
}
