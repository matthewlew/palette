import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { useAppStore } from '../store/useAppStore'
import { namePalette } from '../lib/naming'
import { titleColorAt } from '../lib/titleColor'
import { TurrellSquare } from './TurrellSquare'
import { PaletteTitle } from './PaletteTitle'
import { LikeButton } from './LikeButton'
import { GrainButton } from './GrainButton'
import { PlayButton } from './PlayButton'
import { publishPalette } from '../lib/publishPalette'
import { useStopDrift } from '../lib/useStopDrift'
import { canDrift } from '../lib/stopDrift'
import { NoiseOverlay } from './NoiseOverlay'
import type { Gradient } from '../store/types'
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
  const toggleNoise = useAppStore((s) => s.toggleNoise)
  const motionEnabled = useAppStore((s) => s.motionEnabled)
  const toggleMotion = useAppStore((s) => s.toggleMotion)
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

  // Each glass element samples the gradient where it actually sits, so e.g.
  // the title can stay light while the corner buttons flip dark. Coordinates
  // are rough normalized anchors — tone only needs the right neighborhood.
  const titleColor = titleColorAt(gradient, 0.5, 0.06)
  const cornerColor = titleColorAt(gradient, 0.93, 0.85)
  // Sampled where each control ACTUALLY sits. editColor was (0.94, 0.5) — the
  // right edge at mid-height, where the Edit button lived before it moved to
  // the bottom-left corner. Sampling the old spot picks the ink against a part
  // of the gradient the button is nowhere near, which is how it ended up
  // washed out on gradients whose two sides differ.
  const editColor = titleColorAt(gradient, 0.06, 0.85)
  const backColor = titleColorAt(gradient, 0.06, 0.05)

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
          className={[styles.backButton, 'ghost-chip', !chromeVisible && styles.editHidden].filter(Boolean).join(' ')}
          style={{ color: backColor }}
          onClick={onBack}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
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
      <PaletteTitle
        name={gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
        onRename={renameCurrentGradient}
        hidden={!chromeVisible}
        color={titleColor}
      />
      <GrainButton enabled={noiseEnabled} onToggle={toggleNoise} hidden={!chromeVisible} color={cornerColor} />
      <PlayButton
        playing={motionEnabled}
        onToggle={toggleMotion}
        hidden={!chromeVisible}
        color={cornerColor}
        available={driftable}
      />
      <LikeButton liked={liked} onToggle={handleSave} hidden={!chromeVisible} color={cornerColor} />
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
        className={[styles.editButton, 'ghost-chip', !chromeVisible && styles.editHidden].filter(Boolean).join(' ')}
        style={{ color: editColor }}
        onClick={onEdit}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <span className={styles.editLabel}>Edit</span>
      </button>
    </div>
  )
}
