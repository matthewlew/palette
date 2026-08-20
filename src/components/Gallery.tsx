import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { buildGradientCss } from '../lib/gradient'
import { tileBackground } from '../lib/tileBackground'
import type { GradientType } from '../lib/gradient'
import { useCommunityGradients, type CommunityOrder } from '../hooks/useCommunityGradients'
import { useHint } from '../hooks/useHint'
import { useMasonryRowSpans } from '../hooks/useMasonryRowSpans'
import { useFlipReorder } from '../hooks/useFlipReorder'
import { useAppStore, pickedCarouselGradients, gradientSignature } from '../store/useAppStore'
import type { GalleryLayout } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { likePalette, unlikePalette } from '../lib/likes'
import { Icon, type IconName } from '../icons'
import { HeartButton, LikeCountBadge } from './HeartButton'
import { TileBoundary } from './TileBoundary'
import { namePalette } from '../lib/naming'
import { titleColorAt, paletteInkOn } from '../lib/titleColor'
import { TurrellSquare } from './TurrellSquare'
import { cropClipPath, cropSurfaceSize } from '../lib/gradientCrop'
import { BoardShare } from './BoardShare'
import { PaletteTitle } from './PaletteTitle'
import { NoiseOverlay } from './NoiseOverlay'
import { ScrollTicker } from './ScrollTicker'
import { SearchBar, type SearchResults } from './SearchBar'
import { CarouselStudio } from './CarouselStudio'
import { CarouselDock } from './CarouselDock'
import { Hint } from './Hint'
import { LoadingBar } from './LoadingBar'
import { AuthNav } from './AuthNav'
import { VoteOverlay } from './VoteOverlay'
import JSZip from 'jszip'
import { renderVignetteToCanvas } from '../lib/vignette'
import { MEDIA_CHIP, MEDIA_ICON, MEDIA_ON } from '../lib/mediaChrome'
import { withViewTransition } from '../lib/viewTransition'
import styles from './Gallery.module.css'

// Shape filters. Labels are explicit rather than derived from the type string so
// 'square' reads as "Turrell" here the same way it does in EditMode and the
// onboarding row. 'repeat' is deliberately absent: it is a legacy type that the
// editor now expresses as the "Repeat ×2" modifier, not a shape of its own.
const TYPE_CHIPS: { type: GradientType; label: string }[] = [
  { type: 'linear', label: 'Linear' },
  { type: 'radial', label: 'Radial' },
  { type: 'angular', label: 'Angular' },
  { type: 'square', label: 'Turrell' },
  { type: 'mirror', label: 'Mirror' },
  { type: 'fan', label: 'Fan' },
]

// The dark app surface the tile captions sit on (matches --surface in
// index.css); tile ink is chosen to read against it.
const GALLERY_SURFACE = '#101014'

/** The grid that holds the tiles, and the tile inside it, for each layout. */
function gridClass(layout: GalleryLayout): string {
  if (layout === 'masonry') return styles.masonryGrid
  if (layout === 'dense') return styles.denseGrid
  return styles.grid
}

function tileClass(layout: GalleryLayout): string {
  if (layout === 'masonry') return styles.masonryTile
  if (layout === 'dense') return styles.denseTile
  return styles.tile
}

/**
 * Everything a tile or the viewer needs to show and change a like.
 *
 * Passed as one object rather than four props because likes are all-or-nothing
 * per palette: `canLike` is false for your own saves, which have no row in the
 * shared table for a like to attach to, and the rest is then moot.
 */
interface LikeApi {
  canLike: (gradient: Gradient) => boolean
  isLiked: (id: string) => boolean
  countFor: (gradient: Gradient) => number
  toggle: (gradient: Gradient) => void
}

function formatDate(timestamp?: number): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** One titled half of the search results, with its OWN grid ref.
 *
 * Masonry row spans are measured per grid element, and Gallery has a single
 * gridRef — pointing it at one group left the other with no spans, so its tiles
 * kept the default 8px row and piled on top of each other. A group that owns
 * its ref scales to however many groups there are. */
function SearchGroup({
  testId, heading, gradients, galleryLayout, onOpen, onRiff, likes, heroId, viewerOpen,
}: {
  testId: string
  heading: string
  gradients: Gradient[]
  galleryLayout: GalleryLayout
  onOpen: (g: Gradient) => void
  onRiff: (g: Gradient) => void
  likes?: LikeApi
  heroId?: string | null
  viewerOpen?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useMasonryRowSpans(ref, galleryLayout === 'masonry', [
    galleryLayout,
    gradients.map((g) => g.id).join(','),
  ])
  if (gradients.length === 0) return null
  return (
    <section data-testid={testId}>
      <h2 className={styles.searchGroupHeading}>{heading}</h2>
      <div ref={ref} className={gridClass(galleryLayout)}>
        {gradients.map((g, i) => (
          <TileBoundary key={g.id} label={g.id}>
            <Tile
              gradient={g}
              index={i}
              onOpen={onOpen}
              galleryLayout={galleryLayout}
              onRiff={onRiff}
              likes={likes}
              isHero={heroId === g.id}
              viewerOpen={viewerOpen}
            />
          </TileBoundary>
        ))}
      </div>
    </section>
  )
}

function matchesFilters(gradient: Gradient, type: GradientType | null): boolean {
  if (type && gradient.type !== type) return false
  return true
}

const Tile = memo(function Tile({
  gradient,
  index,
  onOpen,
  galleryLayout,
  onRiff,
  onDelete,
  draggable,
  isDragging,
  isDragOver,
  onDragStartTile,
  onDragEnterTile,
  onDropTile,
  onDragEndTile,
  likes,
  isHero = false,
  viewerOpen = false,
  pick,
  rank,
}: {
  gradient: Gradient
  index: number
  onOpen: (gradient: Gradient) => void
  /** Carousel pick mode. When present, a tap adds this gradient to the
   * carousel (or removes it) instead of opening the viewer — picking is a
   * repeated action over many tiles, and routing it through the viewer would
   * make assembling nine gradients eighteen taps. `order` is the 1-based slide
   * number, or null when unpicked. */
  pick?: { order: number | null; onToggle: (gradient: Gradient) => void }
  /** 1-based position in the Elo-ranked ('elo' CommunityOrder) list. Shown
   * as a badge in the same top-left slot as the carousel pick badge — the
   * two are mutually exclusive in practice (ranking and carousel-building
   * are different flows), so `rank` is simply skipped whenever `pick` is
   * also present rather than trying to share the corner. */
  rank?: number
  galleryLayout: GalleryLayout
  onRiff: (gradient: Gradient) => void
  onDelete?: (id: string) => void
  /** Absent on your own saves — see LikeApi. */
  likes?: LikeApi
  // Drag-to-reorder within the "All" grid. Optional so board-detail and
  // feed tiles can render without it. dragStart also sets the gradient id on
  // the dataTransfer, which is what a collection cover reads on drop, so
  // drag-to-board rides on the same gesture.
  draggable?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStartTile?: (id: string) => void
  onDragEnterTile?: (id: string) => void
  onDropTile?: (id: string) => void
  onDragEndTile?: () => void
  /** This is the tile the full-screen viewer opens from / returns to. */
  isHero?: boolean
  /** The viewer is mounted, so it — not the tile — owns the shared
   * `palette-card` name. Two elements carrying one view-transition-name makes
   * the browser skip the transition outright. */
  viewerOpen?: boolean
}) {
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)

  // Deterministic standard ratio per gradient (from its id) so the masonry
  // mixes squares, portraits, and landscapes instead of all-portrait tiles.
  const RATIOS = ['1 / 1', '4 / 5', '3 / 4', '2 / 3', '4 / 3', '3 / 2']
  const charCodeSum = gradient.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const aspectRatio = RATIOS[charCodeSum % RATIOS.length]

  // Caption ink echoes the gradient's own color, kept legible on the dark
  // surface (see paletteInkOn), instead of a flat white for every tile.
  const tileInk = paletteInkOn(gradient, GALLERY_SURFACE)

  const likeable = likes?.canLike(gradient) ?? false
  const likeCount = likeable ? likes!.countFor(gradient) : 0
  const displayName = gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
  // Three tiles across a phone leaves no room for a second tap target that
  // isn't in the way of the one that opens the palette, so dense shows the
  // count and keeps the heart in the viewer, one tap away.
  const showHeart = likeable && galleryLayout !== 'dense'

  return (
    // A div with button semantics, not a real <button>: the hover overlay's
    // Edit action is a button, and buttons can't nest inside buttons.
    <div
      role="button"
      tabIndex={0}
      data-testid="gallery-tile"
      data-tile-id={gradient.id}
      className={[
        tileClass(galleryLayout),
        draggable ? styles.tileDraggable : '',
        isDragging ? styles.tileDragging : '',
        isDragOver ? styles.tileDragOver : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: `${index * 35}ms` }}
      // The dense badge is decorative (aria-hidden), so the count rides on the
      // tile's own name — otherwise the one layout with no caption would also
      // be the one with no like count for a screen reader.
      aria-label={
        `${displayName}, ${gradient.type} gradient` +
        (likeable && likeCount > 0 ? `, ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : '') +
        (pick ? (pick.order !== null ? `, carousel slide ${pick.order}` : ', not in carousel') : '')
      }
      draggable={draggable}
      onDragStart={(e) => {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move'
          // Firefox requires data to be set for a drag to start. This id is
          // also what a collection cover reads on drop (drag-to-board).
          e.dataTransfer.setData('text/plain', gradient.id)
        }
        onDragStartTile?.(gradient.id)
      }}
      onDragEnter={() => onDragEnterTile?.(gradient.id)}
      onDragOver={(e) => {
        if (!draggable) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDropTile?.(gradient.id)
      }}
      onDragEnd={onDragEndTile}
      onClick={() => (pick ? pick.onToggle(gradient) : onOpen(gradient))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (pick) pick.onToggle(gradient)
          else onOpen(gradient)
        }
      }}
      aria-pressed={pick ? pick.order !== null : undefined}
    >
      <div
        className={styles.tilePreview}
        style={{
          backgroundColor: gradient.crop && gradient.crop !== 'rectangle' ? 'var(--crop-backdrop, Canvas)' : undefined,
          // Circle crops are always 1:1 — sizing the tile itself to a square
          // (rather than clipping a circle inside a taller/wider rect) is
          // what keeps a circle tile from leaving dead rectangular space
          // around a circular thumbnail.
          aspectRatio:
            gradient.crop === 'circle'
              ? '1 / 1'
              : galleryLayout === 'masonry' ? aspectRatio : galleryLayout === 'dense' ? '1 / 1' : '4 / 5',
          // The hero tile borrows the SHARED `palette-card` name, the same one
          // the full-screen viewer carries, so opening morphs the thumbnail
          // into the full-screen view (and closing morphs it back) instead of
          // cross-fading two unrelated pictures — the Photos-app zoom. It hands
          // the name over while the viewer is mounted, because a duplicate name
          // makes the browser skip the transition outright.
          //
          // Every OTHER tile must stay nameless. Naming them gave each its own
          // ::view-transition-group, and groups paint in tree order — so every
          // tile after the hero painted ON TOP of the card as it grew, and the
          // zoom came apart for every tile but the last one in the grid.
          // Unnamed, they stay inside the root snapshot, which paints below.
          viewTransitionName: isHero && !viewerOpen ? 'palette-card' : 'none',
        }}
      >
        {/* The crop clips this inner surface only — on .tilePreview it would
            also cut the tile's chrome (Edit/Delete, heart, badges). */}
        <div
          className={styles.tileSurface}
          data-testid="tile-surface"
          style={{ backgroundImage: tileBackground(gradient), clipPath: cropClipPath(gradient.crop) }}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} blurPx={6} angle={gradient.angle} crop={gradient.crop} />}
          <NoiseOverlay visible={noiseEnabled} />
        </div>
        {/* PRD §5.3's proposed mitigation for silent round-trip data loss: a
            Drum gradient looks identical to a plain one once rendered (hex is
            always the ground truth for display), so without this there is no
            way to tell browsing the grid that one was authored in coverage,
            not RGB — the cue is gone by the time it's just a saved tile. */}
        {gradient.riso && (
          <span className={styles.drumBadge} data-testid="tile-drum-badge" aria-hidden="true">
            Drum
          </span>
        )}
        {/* The slide number this pick will occupy. Shown on the tile rather
            than only in the studio so the order is legible while you build it,
            which is the whole reason picking is ordered. */}
        {pick && (
          <span
            className={pick.order !== null ? styles.pickBadgeOn : styles.pickBadge}
            data-testid="pick-badge"
            aria-hidden="true"
          >
            {pick.order ?? ''}
          </span>
        )}
        {!pick && rank != null && (
          <span className={styles.pickBadgeOn} data-testid="rank-badge" aria-hidden="true">
            {rank}
          </span>
        )}
        {/* Clicks anywhere except the Edit button bubble to the tile and
            open the viewer. Suppressed while picking: Edit/Delete would sit
            on top of the tap target that adds to the carousel. */}
        {onDelete && !pick && (
          <div className={styles.tileHoverOverlay}>
            <button
              type="button"
              className={styles.tileHoverBtnActive}
              onClick={(e) => {
                e.stopPropagation()
                onRiff(gradient)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              aria-label={`Delete ${gradient.name ?? namePalette(gradient.stops.map(s => s.hex))}`}
              className={styles.tileHoverBtn}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(gradient.id)
              }}
            >
              Delete
            </button>
          </div>
        )}
        {showHeart && (
          <HeartButton
            liked={likes!.isLiked(gradient.id)}
            count={likeCount}
            label={displayName}
            onToggle={() => likes!.toggle(gradient)}
          />
        )}
        {likeable && galleryLayout === 'dense' && <LikeCountBadge count={likeCount} />}
      </div>
      <div className={styles.tileMeta}>
        <span className={styles.tileName} style={{ color: tileInk }}>
          {gradient.name ?? namePalette(gradient.stops.map(s => s.hex))}
        </span>
        {gradient.note && <span className={styles.tileDesc}>{gradient.note}</span>}
        {/* Byline and date share one line rather than adding a third row to
            the caption — the tile is already name + date, and an author is a
            detail of the same provenance. Unattributed rows (legacy, or an
            author who deleted their account) just show the date, which is
            honest: nobody signed them. */}
        {(gradient.author || gradient.createdAt) && (
          <span className={styles.tileDate} style={{ color: tileInk, opacity: 0.6 }}>
            {gradient.author && `@${gradient.author.username}`}
            {gradient.author && gradient.createdAt && ' · '}
            {gradient.createdAt && formatDate(gradient.createdAt)}
          </span>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  for (const key in prev) {
    if (key === 'likes' || key === 'pick') continue
    if ((prev as any)[key] !== (next as any)[key]) return false
  }
  if (prev.pick?.order !== next.pick?.order) return false
  if (prev.likes?.isLiked(prev.gradient.id) !== next.likes?.isLiked(next.gradient.id)) return false
  if (prev.likes?.countFor(prev.gradient) !== next.likes?.countFor(next.gradient)) return false
  return true
})

interface ViewerProps {
  gradient: Gradient
  /** The ordered gradients the viewer scrolls through — the currently
   * filtered gallery list, so navigation respects the active filters. */
  items: Gradient[]
  onNavigate: (gradient: Gradient) => void
  onClose: () => void
  onRiff: (gradient: Gradient) => void
  onImport: (jsonText: string) => void
  /** Absent on your own saves — see LikeApi. */
  likes?: LikeApi
}

// Scroll/swipe past this to step to the neighbouring gradient. Wheel deltas
// accumulate so a trackpad flick steps once, not a dozen times.
const WHEEL_STEP_THRESHOLD = 90
const TOUCH_STEP_PX = 60

function Viewer({ gradient, items, onNavigate, onClose, onRiff, onImport, likes }: ViewerProps) {
  const saved = useAppStore((s) => s.saved)
  const renameSavedGradient = useAppStore((s) => s.renameSavedGradient)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const removeSavedGradientById = useAppStore((s) => s.removeSavedGradientById)
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const isSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const setPendingViewerGradient = useAppStore((s) => s.setPendingViewerGradient)
  /** Riffing from inside the viewer (as opposed to the flat-grid tile's own
   * hover-edit) should return HERE on exit, not to the grid — see
   * pendingViewerGradient. */
  function handleEditFromViewer(target: Gradient) {
    setPendingViewerGradient(target)
    onRiff(target)
  }
  const touchStartYRef = useRef<number | null>(null)
  const wheelAccumRef = useRef(0)
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The whole backdrop closes the viewer, which is the fastest way out and the
  // least visible — nothing about a full-bleed gradient says "tappable", so on
  // a phone the only discoverable exit was a 44px ✕ in the corner. Shown once,
  // then never again (the key persists), like every other first-run hint.
  const closeHint = useHint('viewer-close')

  // Index within the list the viewer is scrolling through. Falls back to 0 if
  // the open gradient was filtered out from under the viewer.
  const index = Math.max(0, items.findIndex((g) => g.id === gradient.id))

  // Step to a neighbour, clamped to the ends (no wrap — the list has a top and
  // a bottom, like the Create feed). Down/next = +1, matching wheel direction.
  //
  // Clamped, not rejected outright: a fast multi-item scroll that overshoots
  // the list should land on the last item, the same way it would have if the
  // list were longer, rather than silently doing nothing because the exact
  // step count ran past the end.
  function step(delta: number) {
    const next = Math.max(0, Math.min(items.length - 1, index + delta))
    if (next === index) return
    onNavigate(items[next])
  }

  useEffect(() => {
    return () => {
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
    }
  }, [])

  // Same 5s life as the edit-mode hint: long enough to read, short enough that
  // it isn't sitting on the palette you opened the viewer to look at.
  useEffect(() => {
    if (!closeHint.visible) return
    const timer = setTimeout(() => closeHint.dismiss(), 5000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleWheel(e: React.WheelEvent) {
    // A direction flip abandons the in-progress accumulation.
    if (Math.sign(e.deltaY) !== Math.sign(wheelAccumRef.current)) wheelAccumRef.current = 0
    wheelAccumRef.current += e.deltaY
    if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
    // Consume every threshold's worth in the delta, not just one — a single
    // fast fling used to advance exactly one item no matter how hard you
    // scrolled, since a step reset the whole accumulator. The Create feed's
    // rolodex already lets one gesture cross several, so this did too.
    //
    // Summed into ONE step() call, not one per threshold crossed: step()
    // closes over `index`, which is derived from the `gradient` prop and
    // does not change until this component re-renders with a new one —
    // calling step(1) three times in the same handler would look up
    // items[index + 1] three times, not items[index + 3].
    let steps = 0
    while (wheelAccumRef.current >= WHEEL_STEP_THRESHOLD) {
      wheelAccumRef.current -= WHEEL_STEP_THRESHOLD
      steps += 1
    }
    while (wheelAccumRef.current <= -WHEEL_STEP_THRESHOLD) {
      wheelAccumRef.current += WHEEL_STEP_THRESHOLD
      steps -= 1
    }
    if (steps !== 0) step(steps)
    // A pause abandons a partial scroll so it doesn't carry into the next one.
    wheelResetTimerRef.current = setTimeout(() => {
      wheelAccumRef.current = 0
    }, 250)
  }

  // The `gradient` prop is the snapshot captured when the tile was tapped;
  // renames land in `saved`, so read the live copy for display.
  const live = saved.find((g) => g.id === gradient.id) ?? gradient
  // Only the title samples the palette now — it is bare text over the
  // gradient. The buttons carry their own surface (.ghost-chip) and keep a
  // fixed ink, so the viewer's close / share / action row matches the tab bar
  // and the create-feed chrome instead of restyling itself per gradient.
  const titleColor = titleColorAt(live, 0.5, 0.06)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inInput = target?.tagName === 'INPUT'
      const onButton = target?.tagName === 'BUTTON'
      const modified = e.metaKey || e.ctrlKey || e.altKey
      // Escape closes no matter what was last clicked — only the rename
      // input owns it (its handler cancels editing and stops propagation).
      if (e.key === 'Escape' && !inInput) onClose()
      if (inInput || modified) return
      // Enter/E jump into edit mode; changes there stay unsaved until the
      // explicit Save, so closing/Escape never silently commits edits.
      // Enter must not fire while a button has focus, where it already
      // means "activate".
      if ((e.key === 'Enter' && !onButton) || e.key === 'e' || e.key === 'E') {
        handleEditFromViewer(gradient)
      }
      // Delete removes the open palette (undoable via the toast / ⌘Z).
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeSavedGradientById(gradient.id)
        onClose()
      }
      // Arrows scroll between gradients, same as the wheel/swipe.
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onRiff, gradient, items, index])

  return (
    <div
      data-testid="gallery-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={live.name ?? 'Gradient'}
      className={styles.viewer}
      style={{
        backgroundColor: live.crop && live.crop !== 'rectangle' ? 'var(--crop-backdrop, Canvas)' : undefined,
      }}
      onClick={() => {
        // Doing it is learning it — once they've tapped out, the hint has
        // served its purpose and never returns.
        closeHint.dismiss()
        onClose()
      }}
      onWheel={handleWheel}
      onTouchStart={(e) => {
        touchStartYRef.current = e.touches[0]?.clientY ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartYRef.current
        touchStartYRef.current = null
        const end = e.changedTouches[0]?.clientY
        if (start == null || end == null) return
        // Swipe up → next, swipe down → previous, mirroring the wheel. Close
        // is the ✕ / Escape, not a gesture, so it can't fight navigation.
        //
        // One step per TOUCH_STEP_PX of travel, not a flat ±1 — a fast,
        // long swipe used to land on the very next item, same as a short
        // flick, which is what read as "stuck" next to the Create feed's
        // rolodex.
        const dy = start - end
        const steps = Math.trunc(dy / TOUCH_STEP_PX)
        if (steps !== 0) step(steps)
      }}
    >
      {/* The gradient paints on its own surface so a circle/oval crop clips
          only the picture, never the ✕, the ticker or the share menu over it.
          Turrell paints as an absolute layer inside it — in normal flow its
          100% height would fill the flex column and push the panel below
          the fold, unlike the other shapes' background-image. */}
      <div
        data-testid="viewer-surface"
        className={styles.viewerSurface}
        style={{
          backgroundImage: tileBackground(live),
          clipPath: cropClipPath(live.crop),
          ...cropSurfaceSize(live.crop, '100dvh'),
        }}
      >
        {gradient.type === 'square' && (
          <TurrellSquare stops={live.stops} reversed={live.reversed} angle={live.angle} crop={live.crop} />
        )}
        <NoiseOverlay visible={noiseEnabled} />
      </div>
      <button
        type="button"
        className={`${styles.viewerClose} ${MEDIA_ICON}`}
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); closeHint.dismiss(); onClose(); }}
      >
        ✕
      </button>
      {closeHint.visible && (
        <Hint text="Tap anywhere to go back to your gallery" visible placement="raised" />
      )}
      {/* Same scroll ticker as the Create feed, but labelled with the
          palette's name instead of a position number — the marks track where
          you are as you scroll between saved gradients. */}
      <ScrollTicker index={index} label={live.name ?? namePalette(live.stops.map(s => s.hex))} total={items.length} />
      {/* Wrapper stops the trigger/menu clicks from bubbling to the
          close-on-tap backdrop, which would otherwise dismiss the viewer
          before the share menu could act. */}
      <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
        <BoardShare
          saved={saved}
          current={live}
          onImport={onImport}
          position="viewer"
        />
      </div>
      {/* Same chrome as the create flow: the palette-colored title at the
          top center is itself the rename affordance (tap to edit), so
          there's no separate Rename button. display:contents keeps the
          title's own absolute positioning while stopping clicks from
          bubbling to the close-on-tap backdrop. */}
      <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
        <PaletteTitle
          name={live.name ?? namePalette(live.stops.map(s => s.hex))}
          color={titleColor}
          onRename={(name) => renameSavedGradient(gradient.id, name)}
        />
      </div>
      {(live.author || live.createdAt) && (
        <span className={styles.viewerDate} style={{ color: titleColor }}>
          {live.author && `@${live.author.username}`}
          {live.author && live.createdAt && ' · '}
          {live.createdAt && `Saved on ${formatDate(live.createdAt)}`}
        </span>
      )}
      {/* See the tile badge above for why this exists — same PRD §5.3 cue,
          repeated here since the viewer is the other place this gradient is
          ever just looked at rather than edited. */}
      {live.riso && (
        <span className={styles.viewerDrumBadge} data-testid="viewer-drum-badge" style={{ color: titleColor }}>
          Made in Drum
        </span>
      )}
      {(live.note || live.stops.some((s) => s.label)) && (
        <div className={styles.viewerDetailsCard} onClick={(e) => e.stopPropagation()}>
          {live.note && <p className={styles.viewerDetailsNote}>{live.note}</p>}
          {live.stops.some((s) => s.label) && (
            <div className={styles.viewerDetailsStops}>
              <h4 className={styles.viewerDetailsStopsTitle}>Color Stop Moods</h4>
              <div className={styles.viewerStopsList}>
                {live.stops.map((stop, i) => (
                  <div key={i} className={styles.viewerStopItem}>
                    <span
                      className={styles.viewerStopDot}
                      style={{ backgroundColor: stop.hex }}
                    />
                    <span className={styles.viewerStopHex}>{stop.hex.toUpperCase()}</span>
                    {stop.label && <span className={styles.viewerStopLabel}>{stop.label}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className={styles.viewerActionsBar} onClick={(e) => e.stopPropagation()}>
        {/* First in the bar, and the only place the heart appears in the dense
            layout — the tiles there are too small to carry one. */}
        {likes?.canLike(live) && (
          <HeartButton
            variant="viewer"
            liked={likes.isLiked(live.id)}
            count={likes.countFor(live)}
            label={live.name ?? namePalette(live.stops.map((s) => s.hex))}
            onToggle={() => likes.toggle(live)}
          />
        )}
        {!isSaved ? (
          <button
            type="button"
            className={`${MEDIA_CHIP} ${MEDIA_ON}`}
            onClick={() => toggleSaveGradient(live)}
          >
            Save to Gallery
          </button>
        ) : (
          <span className={`${MEDIA_CHIP} ${styles.viewerSavedNote}`}>✓ Saved</span>
        )}
        {isSaved && (
          <button
            type="button"
            className={MEDIA_CHIP}
            onClick={() => {
              removeSavedGradientById(gradient.id)
              onClose()
            }}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className={MEDIA_CHIP}
          onClick={() => handleEditFromViewer(live)}
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// First-run onboarding: instead of dead filters, offer the shapes so a user
// with an empty Gallery gets straight into the create flow by picking a type.
// A fixed, appealing preview palette for the onboarding shape swatches.
const ONBOARDING_STOPS = [
  { hex: '#ff7a59', position: 0 },
  { hex: '#7c5cff', position: 50 },
  { hex: '#3ad0ff', position: 100 },
]

/**
 * The shapes as a row of tappable swatches — the one way into creating from
 * the Gallery.
 *
 * Shared by the empty-Yours onboarding and the compact Community strip rather
 * than written twice, so both offer the same shapes in the same order at two
 * sizes. Two copies would drift the moment a shape is added.
 */
function ShapeChoices({
  onStartType,
  compact = false,
}: {
  onStartType?: (type: GradientType) => void
  compact?: boolean
}) {
  return (
    <div className={compact ? styles.starterChoices : styles.onboardingChoices}>
      {ONBOARDING_TYPES.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          data-testid={`start-${type}`}
          className={styles.onboardingChoice}
          onClick={() => onStartType?.(type)}
        >
          <span
            className={styles.onboardingSwatch}
            aria-hidden="true"
            style={{
              backgroundImage: buildGradientCss(
                type === 'square' ? 'linear' : type,
                ONBOARDING_STOPS,
                false,
                { angle: 90 }
              ),
            }}
          />
          {label}
        </button>
      ))}
    </div>
  )
}

const ONBOARDING_TYPES: { type: GradientType; label: string }[] = [
  { type: 'linear', label: 'Linear' },
  { type: 'radial', label: 'Radial' },
  { type: 'angular', label: 'Angular' },
  { type: 'square', label: 'Turrell' },
  { type: 'fan', label: 'Fan' },
]

/** How the Yours tab is ordered. See the state declaration for why 'recent'
 * is the default. */
type SavesOrder = 'custom' | 'recent'

const SAVES_ORDERS: { id: SavesOrder; label: string; hint: string }[] = [
  { id: 'custom', label: 'Custom', hint: 'Your own order — drag tiles to rearrange' },
  { id: 'recent', label: 'Recent', hint: 'Newest saves first' },
]

/** The community feed's orders. Unlike the Yours sort, which rearranges a list
 * already in hand, these are queries — see useCommunityGradients. */
const COMMUNITY_ORDERS: { id: CommunityOrder; label: string; hint: string }[] = [
  { id: 'recent', label: 'Recent', hint: 'Newest palettes first' },
  { id: 'popular', label: 'Popular', hint: 'Most liked first' },
  { id: 'elo', label: 'Ranked', hint: 'Top palettes by vote' },
]

/** The three grid densities, in the order they appear everywhere they appear:
 * as an icon segmented control on desktop and as a labelled row inside the
 * mobile overflow menu. One list so the two forms cannot drift apart. */
const LAYOUTS: { id: GalleryLayout; icon: IconName; label: string }[] = [
  { id: 'grid', icon: 'grid', label: 'Grid' },
  { id: 'masonry', icon: 'grid-masonry', label: 'Masonry' },
  { id: 'dense', icon: 'grid-dense', label: 'Dense' },
]

/**
 * Newest first. Saves from before createdAt was recorded sort last rather than
 * first: an absent timestamp is unknown, not old, and floating a pile of
 * undated palettes above this morning's work would make the control look
 * broken. Ties keep their existing (hand-arranged) order, since sort is stable.
 */
function byMostRecent(gradients: Gradient[]): Gradient[] {
  // -1, not -Infinity: two undated palettes would subtract to NaN, and a
  // comparator that returns NaN sorts arbitrarily. Every real timestamp is a
  // positive epoch, so -1 is below all of them and equal to itself.
  const stamp = (g: Gradient) => g.createdAt ?? -1
  return [...gradients].sort((a, b) => stamp(b) - stamp(a))
}

interface GalleryProps {
  onRiff: (gradient: Gradient) => void
  onImport?: (jsonText: string) => void
  onStartType?: (type: GradientType) => void
  /** Entry point into DrumEditMode — there's no real "new drum gradient"
   * creation flow yet (ink-count selection etc. is unresolved scope), so
   * this seeds a starter gradient and jumps straight to editing it. Shown
   * both in the empty-Yours onboarding and as a standing header button once
   * there are saves (see the header button below), since the onboarding
   * spot disappears for good after the first save. */
  onStartDrum?: () => void
  /** Fired when the full-screen viewer opens/closes so the shell can hide the
   * global ＋ Create nav (the viewer has its own Delete/Edit actions). */
  onViewerOpenChange?: (open: boolean) => void
  /** Fired when the selection dock or Multiselect studio opens/closes, so the
   * shell can duck the global nav out from under them — both already render
   * their own actions and previously sat on top of the tab bar unhidden. */
  onSelectionActiveChange?: (active: boolean) => void
}

export function Gallery({ onRiff, onImport, onStartType, onStartDrum, onViewerOpenChange, onSelectionActiveChange }: GalleryProps) {
  const saved = useAppStore((s) => s.saved)
  const removeSavedGradientById = useAppStore((s) => s.removeSavedGradientById)
  const lastDeleted = useAppStore((s) => s.lastDeleted)
  const lastDeletedBatch = useAppStore((s) => s.lastDeletedBatch)
  const undoDelete = useAppStore((s) => s.undoDelete)
  const setViewerGradient = useAppStore((s) => s.setViewerGradient)
  const redoDelete = useAppStore((s) => s.redoDelete)
  const setMode = useAppStore((s) => s.setMode)
  const galleryLayout = useAppStore((s) => s.galleryLayout)
  const setGalleryLayout = useAppStore((s) => s.setGalleryLayout)
  const [typeFilter, setTypeFilter] = useState<GradientType | null>(null)
  const [activeTab, setActiveTab] = useState<'saves' | 'community'>(
    useAppStore.getState().saved.length === 0 ? 'community' : 'saves'
  )
  // Server-side, so it restarts paging — see useCommunityGradients. 'recent'
  // stays the default: a feed people return to should lead with what is new,
  // and an all-time popular list is the same handful of palettes every visit.
  const [communityOrder, setCommunityOrder] = useState<CommunityOrder>('recent')
  // The Ranked sort tab is also the entry point into voting — see the CTA
  // banner below and VoteOverlay.tsx.
  const [showVote, setShowVote] = useState(false)
  // Mobile overflow: layout, sort, shape filter and Select, which on desktop
  // are four separate controls strung along the bar.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const {
    gradients: communityGradients,
    loading: communityLoading,
    loadingMore: communityLoadingMore,
    hasMore: communityHasMore,
    loadMore: loadMoreCommunity,
    deleteGradient: deleteCommunityGradient,
  } = useCommunityGradients(communityOrder)
  // 'recent' by default — the question people actually ask when they open
  // their own saves is "what did I just make?", not "where did I leave this?".
  // 'custom' is the hand-arranged order the drag-reorder writes, still there
  // whenever a gallery you've deliberately arranged should stay arranged.
  const [savesOrder, setSavesOrder] = useState<SavesOrder>('recent')
  const isAdmin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === 'true'
  const setPendingViewerGradient = useAppStore((s) => s.setPendingViewerGradient)
  // Reopens the viewer on the gradient edit was riffed from, when edit was
  // entered from inside the viewer itself (not the flat-grid tile's own
  // hover-edit), or on any Drum edit exit — see pendingViewerGradient. Read
  // once via getState (not the hook) so this mount is the only consumer; a
  // live subscription would reopen the viewer on every future gallery mount,
  // not just this one. Prefer the `saved` copy when one exists (it carries
  // the canonical id), but the pending gradient itself still works when it
  // was never saved — the viewer can render any gradient, not just saved ones.
  const [open, setOpen] = useState<Gradient | null>(() => {
    const pending = useAppStore.getState().pendingViewerGradient
    if (!pending) return null
    return useAppStore.getState().saved.find((g) => g.id === pending.id) ?? pending
  })
  // Which tile the viewer flew out of. Held separately from `open` because the
  // two must disagree for exactly one frame at each end of the transition: the
  // tile has to already be wearing the shared `palette-card` name when the OLD
  // state is captured, and must have handed it to the viewer by the time the
  // NEW state is. findSavedGradientId (not open?.id) because a gradient saved
  // mid-edit got a fresh id from saveGradient — `open`'s own id may not match
  // any tile at all, in which case there's simply no hero tile to fly from.
  const [heroId, setHeroId] = useState<string | null>(() =>
    open ? useAppStore.getState().findSavedGradientId(open) : null
  )
  // One-shot: consume the pending gradient so it doesn't reopen the viewer
  // again on some later, unrelated gallery mount.
  useEffect(() => {
    if (useAppStore.getState().pendingViewerGradient) setPendingViewerGradient(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Open the full-screen viewer as a zoom out of the tapped thumbnail.
   *
   * The flushSync is load-bearing: it paints the shared name onto the tile
   * BEFORE startViewTransition captures the old state. Setting both in one
   * update would capture an old state where no element owned the name, and the
   * viewer would fade in from nothing instead of growing out of the tile. */
  const openViewer = useCallback((gradient: Gradient) => {
    flushSync(() => setHeroId(gradient.id))
    withViewTransition(() => setOpen(gradient))
  }, [])

  /** Shrink back into the tile it came from. The tile reclaims the name as the
   * viewer unmounts, so this is the same morph played backwards. */
  const closeViewer = useCallback(() => {
    withViewTransition(() => setOpen(null))
  }, [])

  /** Scrolling to a neighbour inside the viewer moves the landing tile with
   * it, so closing returns to the palette you are actually looking at. */
  const navigateViewer = useCallback((gradient: Gradient) => {
    setHeroId(gradient.id)
    setOpen(gradient)
  }, [])
  const [exporting, setExporting] = useState(false)
  const reorderSaved = useAppStore((s) => s.reorderSaved)
  const dragIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const likedPaletteIds = useAppStore((s) => s.likedPaletteIds)
  const toggleLikedPalette = useAppStore((s) => s.toggleLikedPalette)
  // Optimistic ±1s against the counts that came back with the rows, held here
  // rather than inside the feed hook because search results are separate state
  // with their own copy of the same palette — one map covers both, and a like
  // made in one place is visible in the other.
  const [likeDeltas, setLikeDeltas] = useState<Record<string, number>>({})
  // Mobile only: a live query takes over the screen (see .searching below).
  const [searchOpen, setSearchOpen] = useState(false)

  // Carousel assembly. Pick mode repurposes a tile tap into "add to carousel",
  // so it is explicitly entered rather than always-on — the default tap has to
  // stay "open this palette".
  const [pickMode, setPickMode] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const carouselPicks = useAppStore((s) => s.carouselPicks)
  const toggleCarouselPick = useAppStore((s) => s.toggleCarouselPick)
  const reorderCarouselPick = useAppStore((s) => s.reorderCarouselPick)
  const clearCarouselPicks = useAppStore((s) => s.clearCarouselPicks)
  const saveGradient = useAppStore((s) => s.saveGradient)

  // Tied to pick mode: turning Select off is "I'm done deciding", and a tray
  // that stays up after that reads as stuck chrome, not a saved-for-later
  // draft. The picks themselves are untouched — turning Select back on
  // (Yours or Community) brings the same tray right back.
  const selectionVisible = pickMode && carouselPicks.length > 0

  /** Leaves the whole selection: empties the deck and drops out of pick mode.
   *
   * One action for both because they are one intention. Separate "clear picks"
   * and "stop selecting" buttons let you end up in pick mode with nothing
   * picked, or with a deck you can no longer add to, neither of which is a
   * state anyone asks for. */
  function handleClearSelection() {
    clearCarouselPicks()
    setPickMode(false)
  }

  // The carousel renders from the local `saved` array by id, and a community
  // palette has no entry there — so picking one saves it first (silently,
  // like the viewer's "Save to Gallery"), then picks the saved copy. Matched
  // by signature rather than id: a community palette you'd already saved
  // shouldn't get a second copy just because you picked it from the other tab.
  const pickApi =
    pickMode
      ? (gradient: Gradient) => {
          const isLocal = activeTab === 'saves'
          const match = isLocal ? gradient : saved.find((g) => gradientSignature(g) === gradientSignature(gradient))
          const order = match ? carouselPicks.indexOf(match.id) : -1
          return {
            order: order === -1 ? null : order + 1,
            onToggle: (g: Gradient) => {
              if (isLocal) {
                toggleCarouselPick(g.id)
                return
              }
              const existing = saved.find((sv) => gradientSignature(sv) === gradientSignature(g))
              if (existing) {
                toggleCarouselPick(existing.id)
                return
              }
              saveGradient(g)
              const created = useAppStore
                .getState()
                .saved.find((sv) => gradientSignature(sv) === gradientSignature(g))
              if (created) toggleCarouselPick(created.id)
            },
          }
        }
      : null

  async function handleExportAll() {
    if (exporting || saved.length === 0) return
    setExporting(true)
    try {
      const zip = new JSZip()
      for (const gradient of saved) {
        const canvas = document.createElement('canvas')
        await renderVignetteToCanvas(canvas, gradient, 1080, 1350, 'post')
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) {
          const slug = (gradient.name ?? 'gradient').toLowerCase().replace(/\s+/g, '-')
          const filename = `${slug}-post.png`
          zip.file(filename, blob)
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const dataUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'palettes-ig-posts.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
    } catch (e) {
      console.error('Batch export failed', e)
    } finally {
      setExporting(false)
    }
  }

  // Publish the open viewer gradient so the app-level Cmd+C copies it. Resolve
  // the live copy from `saved` (the viewer reads `live` for the same reason) so
  // a rename made in the viewer is reflected in what gets copied.
  useEffect(() => {
    const liveOpen = open ? saved.find((g) => g.id === open.id) ?? open : null
    setViewerGradient(liveOpen)
    return () => setViewerGradient(null)
  }, [open, saved, setViewerGradient])
  const [undoVisible, setUndoVisible] = useState(false)
  const galleryHint = useHint('gallery')

  // Every delete surfaces an Undo toast for a few seconds. The deleted
  // gradient stays recoverable in the store either way; the timer only
  // hides the affordance.
  useEffect(() => {
    if (!lastDeleted && !lastDeletedBatch) {
      setUndoVisible(false)
      return
    }
    setUndoVisible(true)
    const timer = setTimeout(() => setUndoVisible(false), 6000)
    return () => clearTimeout(timer)
  }, [lastDeleted, lastDeletedBatch])

  // Platform-standard undo/redo for deletions: ⌘Z / ⌘⇧Z (Ctrl on Windows).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) {
          redoDelete()
        } else {
          undoDelete()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoDelete, redoDelete])

  // Dismiss the overflow menu on an outside press, and on Escape. Pointerdown
  // rather than click so a press that lands on a tile closes the menu before
  // the tile acts on it — otherwise the first tap outside is spent closing.
  useEffect(() => {
    if (!moreOpen) return
    function onDown(e: PointerEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // Visiting the Gallery answers the "Saved to your Gallery" hint forever.
  useEffect(() => {
    galleryHint.dismiss()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Let the shell duck the global ＋ Create nav out while the viewer is open,
  // so it never overlaps the viewer's own Delete/Edit actions.
  useEffect(() => {
    onViewerOpenChange?.(open !== null)
  }, [open, onViewerOpenChange])

  useEffect(() => {
    onSelectionActiveChange?.(selectionVisible || studioOpen)
  }, [selectionVisible, studioOpen, onSelectionActiveChange])

  const filteredSaves = saved.filter((gradient) => matchesFilters(gradient, typeFilter))
  const filtered = savesOrder === 'recent' ? byMostRecent(filteredSaves) : filteredSaves
  const filteredCommunity = communityGradients.filter((gradient) => matchesFilters(gradient, typeFilter))
  const hasFilters = typeFilter !== null
  // Dragging writes into the hand-arranged order, so it can only mean anything
  // while that order is what's on screen. Under Recent a drop would either be
  // discarded or silently reshuffle a list the user can't see the effect of.
  const canReorder = !hasFilters && activeTab === 'saves' && savesOrder === 'custom'

  // Counts for the filter UI. Shapes with nothing to show are dropped rather
  // than rendered as a dead "0" option — but the CURRENTLY selected shape is
  // always kept, or selecting it would make it vanish from the control that
  // selects it.
  const filterPool = activeTab === 'community' ? communityGradients : saved
  const totalCount = filterPool.length
  const availableTypeChips = TYPE_CHIPS
    .map(({ type, label }) => ({ type, label, count: filterPool.filter((g) => g.type === type).length }))
    .filter(({ type, count }) => count > 0 || typeFilter === type)

  // Search results are rendered in their own grouped branch below; this is the
  // browse list. Flattening the groups here would lose the Yours/Community
  // split the results are meant to show.
  const searchFlat = searchResults ? [...searchResults.mine, ...searchResults.community] : null
  const currentViewGradients = searchFlat
    ?? (activeTab === 'community' ? filteredCommunity : filtered)

  // A like needs a row in the shared table to attach to, so only palettes that
  // came from it can carry one. Your own saves have local ids and no row —
  // "liking" one would be a heart nobody else could ever see.
  const communityIds = new Set([
    ...communityGradients.map((g) => g.id),
    ...(searchResults?.community.map((g) => g.id) ?? []),
  ])

  const likes: LikeApi = {
    canLike: (gradient) => communityIds.has(gradient.id),
    isLiked: (id) => likedPaletteIds.includes(id),
    countFor: (gradient) => Math.max(0, (gradient.likeCount ?? 0) + (likeDeltas[gradient.id] ?? 0)),
    toggle: async (gradient) => {
      const id = gradient.id
      const nowLiked = toggleLikedPalette(id)
      const delta = nowLiked ? 1 : -1
      setLikeDeltas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + delta }))

      const ok = nowLiked ? await likePalette(id) : await unlikePalette(id)
      if (ok) return
      // A like is a shared signal. Leaving the heart filled after the write
      // failed would tell the user something untrue about what everyone else
      // can see, so it goes back — including when the table doesn't exist yet
      // because migration 0002 hasn't been applied.
      toggleLikedPalette(id)
      setLikeDeltas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) - delta }))
    },
  }



  const gridRef = useRef<HTMLDivElement>(null)

  // Masonry uses measured row spans; grid layout is a plain uniform grid.
  useMasonryRowSpans(gridRef, galleryLayout === 'masonry', [
    galleryLayout,
    currentViewGradients.map((g) => g.id).join(','),
    activeTab,
  ])

  // Glide tiles to their new spots after a drag reorder (FLIP). Disabled under
  // reduced-motion. Keyed on the current order so it runs only on reorder.
  const orderKey = `${currentViewGradients.map((g) => g.id).join(',')}-${activeTab}`
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useFlipReorder(gridRef, orderKey, !prefersReducedMotion)

  const clearDrag = useCallback(() => {
    dragIdRef.current = null
    setDraggingId(null)
    setDragOverId(null)
  }, [])
  const handleDragStartTile = useCallback((id: string) => {
    dragIdRef.current = id
    setDraggingId(id)
  }, [])
  const handleDragEnterTile = useCallback((id: string) => {
    if (!dragIdRef.current || id === dragIdRef.current) return
    // While selecting, only another PICKED tile is a valid target — an
    // unpicked one holds no slide number for the dragged tile to take, so
    // highlighting it would promise a drop that does nothing.
    if (pickMode && !carouselPicks.includes(id)) return
    setDragOverId(id)
  }, [pickMode, carouselPicks])
  const handleDropTile = useCallback((id: string) => {
    const from = dragIdRef.current
    if (from && from !== id) {
      // One gesture, two meanings, disambiguated by mode. Selecting: the drag
      // rearranges the CAROUSEL, so the badge numbers move and the gallery's
      // own arrangement is left alone. Otherwise it rearranges the gallery,
      // which is what it has always done.
      if (pickMode) reorderCarouselPick(from, id)
      else reorderSaved(from, id)
    }
    clearDrag()
  }, [pickMode, reorderCarouselPick, reorderSaved, clearDrag])

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const active = document.activeElement as HTMLElement
    if (!active || !gridRef.current || !gridRef.current.contains(active)) return

    // By testid, not styles.tile: masonry tiles carry the composed
    // masonryTile class, so a class query misses them.
    const tiles = Array.from(gridRef.current.querySelectorAll('[data-testid="gallery-tile"]')) as HTMLElement[]
    const currentIndex = tiles.indexOf(active)
    if (currentIndex === -1) return

    // Calculate columns
    let cols = 1
    if (tiles.length > 1) {
      const firstTop = tiles[0].getBoundingClientRect().top
      for (let i = 1; i < tiles.length; i++) {
        if (Math.abs(tiles[i].getBoundingClientRect().top - firstTop) < 2) {
          cols++
        } else {
          break
        }
      }
    }

    let nextIndex = currentIndex
    switch (e.key) {
      case 'ArrowLeft':
        nextIndex = currentIndex - 1
        break
      case 'ArrowRight':
        nextIndex = currentIndex + 1
        break
      case 'ArrowUp':
        nextIndex = currentIndex - cols
        break
      case 'ArrowDown':
        nextIndex = currentIndex + cols
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = tiles.length - 1
        break
      default:
        return // Let other keys propagate
    }

    if (nextIndex >= 0 && nextIndex < tiles.length) {
      e.preventDefault()
      tiles[nextIndex].focus()
    }
  }

  return (
    <div
      data-testid="gallery"
      className={[
        styles.container,
        searchOpen && styles.searching,
        selectionVisible && !studioOpen && styles.withDock,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* SELECT MODE takes the whole bar rather than adding a control to it.
       *
       * The mode changes what a tap on a tile MEANS — open becomes pick — so
       * the bar has to answer "what am I in" before it answers anything else.
       * Leaving the browse row up and marking one button "Cancel" made the
       * mode a detail of a control instead of the state of the screen, and on
       * mobile that button was below the fold of a two-row bar.
       *
       * The count lives here; the picks themselves live in the dock at the
       * bottom, which owns Clear and Next. This bar is the mode indicator and
       * the way out of it, nothing more — two places for one state is only
       * confusing if they say the same thing. */}
      <div className={pickMode ? styles.headerSelecting : styles.header} data-lds-nav="">
        {pickMode ? (
          <>
            <span className={styles.selectingCount} data-testid="select-mode-count" aria-live="polite">
              {carouselPicks.length === 0
                ? 'Tap palettes to select'
                : `${carouselPicks.length} selected`}
            </span>
            <button
              type="button"
              data-testid="carousel-pick-toggle"
              className={styles.selectBtnActive}
              onClick={() => setPickMode(false)}
              aria-pressed
            >
              Cancel
            </button>
          </>
        ) : (
          <>
        {/* The wordmark stays at every width — including mobile, where the bar
            used to lead with the screen's name ("Gallery") instead. The tabs
            directly below already say which half of the gallery you are in, so
            a screen title spent the one always-visible slot restating the row
            under it, and left nothing on the page saying what the app IS. The
            product name is the thing a phone has no room to say twice, so it
            gets the slot. */}
        <span className={`lds-nav__logo ${styles.wordmark}`}>
          {/* public/favicon.svg — the mark the browser tab already shows, so
              the app is identified by the same thing in both places. Decorative
              here: the word beside it is the accessible name.
              BASE_URL, not a leading slash: the app is served from /palette/,
              where a root-relative path 404s. */}
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className={styles.logoMark}
            width="18"
            height="17"
          />
          <span className={styles.logoWord}>Palette</span>
        </span>
        <div className={styles.titleArea}>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={activeTab === 'saves' ? styles.toggleBtnActiveTab : styles.toggleBtnTab}
              onClick={() => setActiveTab('saves')}
            >
              Yours <span className={styles.titleCount}>{saved.length}</span>
            </button>
            <button
              type="button"
              className={activeTab === 'community' ? styles.toggleBtnActiveTab : styles.toggleBtnTab}
              onClick={() => setActiveTab('community')}
            >
              {/* Only once the first page has actually landed. Rendering "0"
                  during the initial query reads as "the community is empty",
                  which is the opposite of what the tab is advertising. */}
              Community
              {communityGradients.length > 0 && (
                <span className={styles.titleCount}>{communityGradients.length}</span>
              )}
            </button>
          </div>
        </div>
        <div className={styles.headerActions}>
          <SearchBar
            onResults={setSearchResults}
            saved={saved}
            onActiveChange={setSearchOpen}
            onCancel={() => setSearchOpen(false)}
          />
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={galleryLayout === 'grid' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setGalleryLayout('grid')}
              aria-label="Show grid layout"
              title="Grid layout"
            >
              <Icon name="grid" size="sm" />
            </button>
            <button
              type="button"
              className={galleryLayout === 'masonry' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setGalleryLayout('masonry')}
              aria-label="Show Pinterest masonry layout"
              title="Pinterest masonry layout"
            >
              <Icon name="grid-masonry" size="sm" />
            </button>
            <button
              type="button"
              data-testid="layout-dense"
              className={galleryLayout === 'dense' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setGalleryLayout('dense')}
              aria-label="Show dense grid layout"
              title="Dense layout — more gradients, no captions"
            >
              {/* Nine cells to the grid icon's four: the icon says how much
                  more fits on screen, which is the only reason to pick it. Nine
                  OUTLINED cells would close their counters at this stroke, so
                  the dense grid is solid marks — see grid_dense in the set. */}
              <Icon name="grid-dense" size="sm" />
            </button>
          </div>
          {/* Drum's only entry point used to be the empty-Yours onboarding
              screen, which vanishes for good on the first save — after that,
              starting a new drum gradient was impossible without already
              having one to riff from. Desktop has the header width to spare
              for a permanent action; mobile's header is already tight below
              640px (see the wrap comment above), so this stays desktop-only
              until Drum gets a real creation flow that fits the ＋ Create nav.
              Gated on saved.length > 0: below that the onboarding screen
              (rendered further down) already offers its own "+ Drum" button —
              without this check both were showing at once on an empty Yours. */}
          {activeTab === 'saves' && saved.length > 0 && onStartDrum && (
            <button
              type="button"
              data-testid="drum-start-button"
              className={styles.drumStartButton}
              onClick={onStartDrum}
              title="Start a new Riso drum gradient"
            >
              + Drum
            </button>
          )}
          <BoardShare
            saved={saved}
            onImport={onImport ?? (() => {})}
            position="inline"
            onExportAll={handleExportAll}
            exportingAll={exporting}
          />
          {/* Last in the row, and the only text action among the icons: Select
              switches the whole grid into a different mode, so it reads as the
              row's terminal commitment rather than one more toggle. */}
          <div className={styles.soloGroup}>
            <button
              type="button"
              data-testid="carousel-pick-toggle"
              className={styles.selectBtn}
              onClick={() => setPickMode(true)}
              aria-pressed={false}
              title="Select gradients in order"
            >
              Select
            </button>
          </div>

          <AuthNav />

          {/* MOBILE OVERFLOW.
           *
           * Everything above renders on both breakpoints and the CSS hides the
           * wide half below 768px; this button and its menu are the reverse. It
           * is the same trick the shape filter already used — one control as a
           * chip row on desktop and a native select on mobile — because the
           * alternative is a JS breakpoint, and a JS breakpoint means the two
           * forms can disagree about state.
           *
           * What it absorbs is a whole row of the bar plus the filter/sort row
           * beneath it: three stacked bands of navigation above the first
           * palette on a 390px screen, none of which was the palettes. */}
          <div className={styles.moreWrap} ref={moreRef}>
            <button
              type="button"
              data-testid="gallery-more"
              className={moreOpen ? styles.moreBtnOpen : styles.moreBtn}
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="View and filter options"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              <Icon name="more-horizontal" size="sm" />
            </button>

            {moreOpen && (
              <div className={styles.moreMenu} data-testid="gallery-more-menu" role="menu">
                <p className={styles.moreLabel}>Layout</p>
                <div className={styles.moreRow}>
                  {LAYOUTS.map(({ id, icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={galleryLayout === id}
                      className={galleryLayout === id ? styles.moreChipOn : styles.moreChip}
                      onClick={() => setGalleryLayout(id)}
                    >
                      <Icon name={icon} size="sm" />
                      {label}
                    </button>
                  ))}
                </div>

                <p className={styles.moreLabel}>Sort</p>
                <div className={styles.moreRow}>
                  {(activeTab === 'saves' ? SAVES_ORDERS : COMMUNITY_ORDERS).map(({ id, label }) => {
                    const on = activeTab === 'saves' ? savesOrder === id : communityOrder === id
                    return (
                      <button
                        key={id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={on}
                        data-testid={`more-order-${id}`}
                        className={on ? styles.moreChipOn : styles.moreChip}
                        onClick={() =>
                          activeTab === 'saves'
                            ? setSavesOrder(id as SavesOrder)
                            : setCommunityOrder(id as CommunityOrder)
                        }
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {availableTypeChips.length > 0 && (
                  <>
                    <p className={styles.moreLabel}>Shape</p>
                    <div className={styles.moreRow}>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={!hasFilters}
                        className={!hasFilters ? styles.moreChipOn : styles.moreChip}
                        onClick={() => setTypeFilter(null)}
                      >
                        All <span className={styles.chipCount}>{totalCount}</span>
                      </button>
                      {availableTypeChips.map(({ type, label, count }) => (
                        <button
                          key={type}
                          type="button"
                          role="menuitemradio"
                          aria-checked={typeFilter === type}
                          className={typeFilter === type ? styles.moreChipOn : styles.moreChip}
                          onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                        >
                          {label} <span className={styles.chipCount}>{count}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Closes the menu on the way in: Select changes what the whole
                    grid does, and leaving a panel open over the tiles you are
                    now meant to be tapping would fight the mode it just set. */}
                <button
                  type="button"
                  role="menuitem"
                  data-testid="more-select"
                  className={styles.moreAction}
                  onClick={() => { setMoreOpen(false); setPickMode(true) }}
                >
                  Select palettes
                </button>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {searchResults ? (
        <div data-testid="search-results">
          {searchResults.mine.length === 0 && searchResults.community.length === 0 ? (
            <div className={styles.onboarding}>
              <p className={styles.onboardingSub}>No palettes found for that name.</p>
            </div>
          ) : (
            <>
              {/* Yours first, and they arrive on the first keystroke rather than
                  after the network — the community query is debounced 400ms, so
                  leading with the remote result meant staring at nothing. */}
              <SearchGroup
                testId="search-group-mine"
                heading="Yours"
                gradients={searchResults.mine}
                galleryLayout={galleryLayout}
                onOpen={openViewer}
                onRiff={onRiff}
                heroId={heroId}
                viewerOpen={open !== null}
              />
              <SearchGroup
                testId="search-group-community"
                heading="Community"
                gradients={searchResults.community}
                galleryLayout={galleryLayout}
                onOpen={openViewer}
                onRiff={onRiff}
                likes={likes}
                heroId={heroId}
                viewerOpen={open !== null}
              />
            </>
          )}
        </div>
      ) : activeTab === 'saves' && saved.length === 0 ? (
        <div className={styles.onboarding}>
          <p className={styles.onboardingTitle}>Create a gradient</p>
          <p className={styles.onboardingSub}>Pick a shape to start — your saves land here.</p>
          <ShapeChoices onStartType={onStartType} />
          {onStartDrum && (
            <button type="button" data-testid="drum-dev-start" className={styles.emptyAction} onClick={onStartDrum}>
              + Drum
            </button>
          )}
        </div>
      ) : (
        <>
          {/* One row: what's in the list (filter) and what order it's in
              (sort). The filter half renders twice and only one is ever
              visible (CSS media query, not JS): a native <select> on mobile
              and the chip row on desktop. The chips cost 90px over three rows
              at 375px and seven of the fifteen read "0" — a select is one 36px
              row, uses the OS picker, and cannot overflow. Zero-count options
              are omitted, so every choice leads somewhere.

              The sort half does NOT need that treatment — two options fit any
              width — so it's one segmented control on both breakpoints. */}
          {/* First-run entry point, on the tab a new user actually lands on.
              Community is the sensible default — an empty Yours is a blank
              room — but it left the only way into creating as a dim "Create"
              in the bottom bar, next to a highlighted "Gallery". This offers
              the same shape picker the empty Yours tab does, in one row.

              Gone for good on the first save: it is scaffolding, and a
              returning user's screen should be their palettes. */}
          {activeTab === 'community' && !searchFlat && saved.length === 0 && (
            <div className={styles.starter} data-testid="community-starter">
              <p className={styles.starterTitle}>
                Make your own <span className={styles.starterSub}>— pick a shape</span>
              </p>
              <ShapeChoices onStartType={onStartType} compact />
            </div>
          )}

          {/* The Ranked sort tab IS the voting entry point — ranking and
              voting are one feature, not a hidden page and a separate list. */}
          {activeTab === 'community' && !searchFlat && communityOrder === 'elo' && (
            <div className={styles.voteBanner} data-testid="vote-banner">
              <p className={styles.voteBannerText}>Vote to help rank these gradients</p>
              <button type="button" className={styles.voteBannerButton} onClick={() => setShowVote(true)}>
                Vote
              </button>
            </div>
          )}

          <div className={styles.filterBar}>
            <div className={styles.filterSelectWrap}>
              <select
                data-testid="filter-select"
                aria-label="Filter by gradient shape"
                className={styles.filterSelect}
                value={typeFilter ?? 'all'}
                onChange={(e) => setTypeFilter(e.target.value === 'all' ? null : e.target.value as GradientType)}
              >
                <option value="all">All shapes ({totalCount})</option>
                {availableTypeChips.map(({ type, label, count }) => (
                  <option key={type} value={type}>{label} ({count})</option>
                ))}
              </select>
            </div>

            <div className={styles.chips}>
              <button
                type="button"
                className={!hasFilters ? styles.chipOn : styles.chip}
                onClick={() => setTypeFilter(null)}
              >
                All <span className={styles.chipCount}>{totalCount}</span>
              </button>
              {availableTypeChips.map(({ type, label, count }) => (
                <button
                  key={type}
                  type="button"
                  className={typeFilter === type ? styles.chipOn : styles.chip}
                  onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                >
                  {label} <span className={styles.chipCount}>{count}</span>
                </button>
              ))}
            </div>

            {/* Both tabs sort, through the same control in the same place, so
                "how is this ordered" is one idea rather than two. What differs
                is underneath: Yours rearranges a list already in hand, while
                Community re-queries and restarts paging. */}
            {activeTab === 'saves' ? (
              <div
                className={styles.sortGroup}
                role="group"
                aria-label="Sort your palettes"
                data-testid="saves-order"
              >
                {SAVES_ORDERS.map(({ id, label, hint }) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`saves-order-${id}`}
                    aria-pressed={savesOrder === id}
                    title={hint}
                    className={savesOrder === id ? styles.toggleBtnActiveTab : styles.toggleBtnTab}
                    onClick={() => setSavesOrder(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className={styles.sortGroup}
                role="group"
                aria-label="Sort community palettes"
                data-testid="community-order"
              >
                {COMMUNITY_ORDERS.map(({ id, label, hint }) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`community-order-${id}`}
                    aria-pressed={communityOrder === id}
                    title={hint}
                    className={communityOrder === id ? styles.toggleBtnActiveTab : styles.toggleBtnTab}
                    onClick={() => setCommunityOrder(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {currentViewGradients.length === 0 ? (
            <div className={styles.empty}>
              {activeTab === 'community' && communityLoading ? (
                <LoadingBar label="Loading community gradients" />
              ) : hasFilters && (activeTab === 'community' ? communityGradients.length > 0 : saved.length > 0) ? (
                <>
                  <p className={styles.emptyText}>No matches here.</p>
                  <button
                    type="button"
                    className={styles.emptyAction}
                    onClick={() => setTypeFilter(null)}
                  >
                    Clear filters
                  </button>
                </>
              ) : activeTab === 'saves' ? (
                <>
                  <p className={styles.emptyText}>Make something — your pins land here.</p>
                  <button type="button" className={styles.emptyAction} onClick={() => setMode('create')}>
                    Create
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div
              ref={gridRef}
              key={`${typeFilter ?? 'all'}-${activeTab}`}
              onKeyDown={handleGridKeyDown}
              className={gridClass(galleryLayout)}
            >
              {currentViewGradients.map((gradient, index) => (
                <TileBoundary key={gradient.id} label={gradient.id}>
                  <Tile
                    gradient={gradient}
                    index={index}
                    onOpen={openViewer}
                    galleryLayout={galleryLayout}
                    onRiff={onRiff}
                    onDelete={activeTab === 'saves' ? removeSavedGradientById : (isAdmin ? deleteCommunityGradient : undefined)}
                    draggable={pickMode ? carouselPicks.includes(gradient.id) : canReorder}
                    isDragging={draggingId === gradient.id}
                    isDragOver={dragOverId === gradient.id}
                    onDragStartTile={handleDragStartTile}
                    onDragEnterTile={handleDragEnterTile}
                    onDropTile={handleDropTile}
                    onDragEndTile={clearDrag}
                    likes={likes}
                    isHero={heroId === gradient.id}
                    viewerOpen={open !== null}
                    pick={pickApi ? pickApi(gradient) : undefined}
                    rank={activeTab === 'community' && communityOrder === 'elo' ? index + 1 : undefined}
                  />
                </TileBoundary>
              ))}
            </div>
          )}

          {/* Community only, and never over search results — those are their
              own query against the whole table, not a window onto this list.
              Rendered outside the empty/grid branch so a filter that matches
              nothing on the pages loaded so far can still be answered by
              fetching more, instead of dead-ending on "No matches here". */}
          {activeTab === 'community' && !searchFlat && communityHasMore && (
            <div className={styles.loadMoreRow}>
              <button
                type="button"
                data-testid="community-load-more"
                className={styles.loadMoreButton}
                disabled={communityLoadingMore}
                onClick={loadMoreCommunity}
              >
                {communityLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {undoVisible && (lastDeleted || lastDeletedBatch) && (
        <div
          data-testid="undo-toast"
          // Raised over the viewer, where a row of actions (heart, Save,
          // Edit, Delete) already occupies the strip above the tab bar and
          // the toast landed straight on top of it.
          className={[styles.undoToast, open && styles.undoToastRaised].filter(Boolean).join(' ')}
          role="status"
        >
          <span className={styles.undoText}>
            {lastDeletedBatch
              ? `Deleted ${lastDeletedBatch.length} palettes`
              : `Deleted “${lastDeleted!.gradient.name ?? namePalette(lastDeleted!.gradient.stops.map((s) => s.hex))}”`}
          </span>
          <button
            type="button"
            data-testid="undo-delete"
            className={styles.undoButton}
            onClick={undoDelete}
          >
            Undo
          </button>
        </div>
      )}

      {open && (
        <Viewer
          gradient={open}
          items={currentViewGradients}
          onNavigate={navigateViewer}
          onClose={closeViewer}
          onRiff={onRiff}
          onImport={onImport ?? (() => {})}
          likes={likes}
        />
      )}

      {selectionVisible && !studioOpen && (
        <CarouselDock
          gradients={pickedCarouselGradients(saved, carouselPicks)}
          onNext={() => setStudioOpen(true)}
          onClear={handleClearSelection}
        />
      )}

      {studioOpen && (
        <CarouselStudio
          onClose={() => setStudioOpen(false)}
          onAddMore={() => {
            // Back to the grid with picking still armed — the studio's "+" is a
            // detour to collect more, not an exit from the carousel.
            setStudioOpen(false)
            setPickMode(true)
          }}
        />
      )}

      {showVote && <VoteOverlay onClose={() => setShowVote(false)} />}
    </div>
  )
}
