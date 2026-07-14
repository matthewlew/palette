import { useEffect, useRef, useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import type { GradientType } from '../lib/gradient'
import { gradientHueFamily, HUE_FAMILIES } from '../lib/hueFilter'
import { useHint } from '../hooks/useHint'
import { useMasonryRowSpans } from '../hooks/useMasonryRowSpans'
import { useFlipReorder } from '../hooks/useFlipReorder'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { titleColorAt, paletteInkOn } from '../lib/titleColor'
import { TurrellSquare } from './TurrellSquare'
import { BoardShare } from './BoardShare'
import { PaletteTitle } from './PaletteTitle'
import { ScrollTicker } from './ScrollTicker'
import { CollectionsRow } from './CollectionsRow'
import { DropAuthor } from './DropAuthor'
import { THEMED_FEEDS } from '../lib/themedFeed'
import styles from './Gallery.module.css'

const TYPE_CHIPS: GradientType[] = ['linear', 'radial', 'angular', 'square', 'fan']

// The dark app surface the tile captions sit on (matches --surface in
// index.css); tile ink is chosen to read against it.
const GALLERY_SURFACE = '#101014'

function formatDate(timestamp?: number): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function matchesFilters(gradient: Gradient, type: GradientType | null, hue: string | null): boolean {
  if (type && gradient.type !== type) return false
  if (hue && gradientHueFamily(gradient.stops) !== hue) return false
  return true
}

function tileBackground(gradient: Gradient): string | undefined {
  return gradient.type === 'square'
    ? undefined
    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
        fanAnchor: gradient.fanAnchor,
      })
}

function Tile({
  gradient,
  onOpen,
  galleryLayout,
  onRiff,
  onDelete,
  enterDelayMs,
  draggable,
  isDragging,
  isDragOver,
  onDragStartTile,
  onDragEnterTile,
  onDropTile,
  onDragEndTile,
}: {
  gradient: Gradient
  onOpen: (gradient: Gradient) => void
  galleryLayout: 'grid' | 'masonry'
  onRiff: (gradient: Gradient) => void
  onDelete?: (id: string) => void
  enterDelayMs?: number
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
}) {
  // Deterministic standard ratio per gradient (from its id) so the masonry
  // mixes squares, portraits, and landscapes instead of all-portrait tiles.
  const RATIOS = ['1 / 1', '4 / 5', '3 / 4', '2 / 3', '4 / 3', '3 / 2']
  const charCodeSum = gradient.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const aspectRatio = RATIOS[charCodeSum % RATIOS.length]

  // Caption ink echoes the gradient's own color, kept legible on the dark
  // surface (see paletteInkOn), instead of a flat white for every tile.
  const tileInk = paletteInkOn(gradient, GALLERY_SURFACE)

  return (
    // A div with button semantics, not a real <button>: the hover overlay's
    // Edit action is a button, and buttons can't nest inside buttons.
    <div
      role="button"
      tabIndex={0}
      data-testid="gallery-tile"
      data-tile-id={gradient.id}
      className={[
        galleryLayout === 'masonry' ? styles.masonryTile : styles.tile,
        draggable ? styles.tileDraggable : '',
        isDragging ? styles.tileDragging : '',
        isDragOver ? styles.tileDragOver : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: `${enterDelayMs ?? 0}ms` }}
      aria-label={`${gradient.name ?? 'Untitled'}, ${gradient.type} gradient`}
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
      onClick={() => onOpen(gradient)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(gradient)
        }
      }}
    >
      <div
        className={styles.tilePreview}
        style={{
          backgroundImage: tileBackground(gradient),
          aspectRatio: galleryLayout === 'masonry' ? aspectRatio : '4 / 5',
          viewTransitionName: `palette-card-${gradient.id}`,
        }}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={6} />}
        {/* Clicks anywhere except the Edit button bubble to the tile and
            open the viewer. */}
        {onDelete && (
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
              aria-label={`Delete ${gradient.name ?? 'Untitled'}`}
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
      </div>
      <div className={styles.tileMeta}>
        <span className={styles.tileName} style={{ color: tileInk }}>
          {gradient.name ?? 'Untitled'}
        </span>
        {gradient.note && <span className={styles.tileDesc}>{gradient.note}</span>}
        {gradient.createdAt && (
          <span className={styles.tileDate} style={{ color: tileInk, opacity: 0.6 }}>
            {formatDate(gradient.createdAt)}
          </span>
        )}
      </div>
    </div>
  )
}

interface ViewerProps {
  gradient: Gradient
  /** The ordered gradients the viewer scrolls through — the currently
   * filtered gallery list, so navigation respects the active filters. */
  items: Gradient[]
  onNavigate: (gradient: Gradient) => void
  onClose: () => void
  onRiff: (gradient: Gradient) => void
  onImport: (jsonText: string) => void
}

// Scroll/swipe past this to step to the neighbouring gradient. Wheel deltas
// accumulate so a trackpad flick steps once, not a dozen times.
const WHEEL_STEP_THRESHOLD = 90
const TOUCH_STEP_PX = 60

function Viewer({ gradient, items, onNavigate, onClose, onRiff, onImport }: ViewerProps) {
  const saved = useAppStore((s) => s.saved)
  const renameSavedGradient = useAppStore((s) => s.renameSavedGradient)
  const removeSavedGradientById = useAppStore((s) => s.removeSavedGradientById)
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const isSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const touchStartYRef = useRef<number | null>(null)
  const wheelAccumRef = useRef(0)
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Index within the list the viewer is scrolling through. Falls back to 0 if
  // the open gradient was filtered out from under the viewer.
  const index = Math.max(0, items.findIndex((g) => g.id === gradient.id))

  // Step to a neighbour, clamped to the ends (no wrap — the list has a top and
  // a bottom, like the Create feed). Down/next = +1, matching wheel direction.
  function step(delta: number) {
    const next = index + delta
    if (next < 0 || next >= items.length) return
    onNavigate(items[next])
  }

  useEffect(() => {
    return () => {
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
    }
  }, [])

  function handleWheel(e: React.WheelEvent) {
    // A direction flip abandons the in-progress accumulation.
    if (Math.sign(e.deltaY) !== Math.sign(wheelAccumRef.current)) wheelAccumRef.current = 0
    wheelAccumRef.current += e.deltaY
    if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
    if (Math.abs(wheelAccumRef.current) >= WHEEL_STEP_THRESHOLD) {
      step(wheelAccumRef.current > 0 ? 1 : -1)
      wheelAccumRef.current = 0
      return
    }
    // A pause abandons a partial scroll so it doesn't carry into the next one.
    wheelResetTimerRef.current = setTimeout(() => {
      wheelAccumRef.current = 0
    }, 250)
  }

  // The `gradient` prop is the snapshot captured when the tile was tapped;
  // renames land in `saved`, so read the live copy for display.
  const live = saved.find((g) => g.id === gradient.id) ?? gradient
  const titleColor = titleColorAt(live, 0.5, 0.06)
  // Per-corner palette foregrounds, same strategy as the title.
  const closeColor = titleColorAt(live, 0.06, 0.06)
  const shareColor = titleColorAt(live, 0.94, 0.06)
  const actionColor = titleColorAt(live, 0.9, 0.92)

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
        onRiff(gradient)
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
      style={{ backgroundImage: tileBackground(live) }}
      onClick={onClose}
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
        const dy = start - end
        if (Math.abs(dy) > TOUCH_STEP_PX) step(dy > 0 ? 1 : -1)
      }}
    >
      {/* Turrell paints as an absolute backdrop layer — in normal flow its
          100% height would fill the flex column and push the panel below
          the fold, unlike the other shapes' background-image. */}
      {gradient.type === 'square' && (
        <div className={styles.viewerSquare}>
          <TurrellSquare stops={live.stops} reversed={live.reversed} />
        </div>
      )}
      <button
        type="button"
        className={`${styles.viewerClose} ghost-chip`}
        style={{ color: closeColor }}
        aria-label="Close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ✕
      </button>
      {/* Same scroll ticker as the Create feed, but labelled with the
          palette's name instead of a position number — the marks track where
          you are as you scroll between saved gradients. */}
      <ScrollTicker index={index} label={live.name ?? 'Untitled'} total={items.length} />
      {/* Wrapper stops the trigger/menu clicks from bubbling to the
          close-on-tap backdrop, which would otherwise dismiss the viewer
          before the share menu could act. */}
      <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
        <BoardShare
          saved={saved}
          current={live}
          onImport={onImport}
          position="viewer"
          color={shareColor}
        />
      </div>
      {/* Same chrome as the create flow: the palette-colored title at the
          top center is itself the rename affordance (tap to edit), so
          there's no separate Rename button. display:contents keeps the
          title's own absolute positioning while stopping clicks from
          bubbling to the close-on-tap backdrop. */}
      <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
        <PaletteTitle
          name={live.name ?? 'Untitled'}
          color={titleColor}
          onRename={(name) => renameSavedGradient(gradient.id, name)}
        />
      </div>
      {live.createdAt && (
        <span className={styles.viewerDate} style={{ color: titleColor }}>
          Saved on {formatDate(live.createdAt)}
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
        {!isSaved ? (
          <button
            type="button"
            className="ghost-chip ghost-pill ghost-chip-active"
            style={{ color: '#fff', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            onClick={() => toggleSaveGradient(live)}
          >
            Save to Gallery
          </button>
        ) : (
          <span
            className="ghost-chip ghost-pill"
            style={{ color: 'rgba(255, 255, 255, 0.5)' }}
          >
            ✓ Saved
          </span>
        )}
        {isSaved && (
          <button
            type="button"
            className="ghost-chip ghost-pill"
            style={{ color: actionColor }}
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
          className="ghost-chip ghost-pill"
          style={{ color: actionColor }}
          onClick={() => onRiff(live)}
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

const ONBOARDING_TYPES: { type: GradientType; label: string }[] = [
  { type: 'linear', label: 'Linear' },
  { type: 'radial', label: 'Radial' },
  { type: 'angular', label: 'Angular' },
  { type: 'square', label: 'Turrell' },
  { type: 'fan', label: 'Fan' },
]

interface GalleryProps {
  onRiff: (gradient: Gradient) => void
  onImport?: (jsonText: string) => void
  onStartType?: (type: GradientType) => void
  /** Fired when the full-screen viewer opens/closes so the shell can hide the
   * global ＋ Create nav (the viewer has its own Delete/Edit actions). */
  onViewerOpenChange?: (open: boolean) => void
}

export function Gallery({ onRiff, onImport, onStartType, onViewerOpenChange }: GalleryProps) {
  const saved = useAppStore((s) => s.saved)
  const removeSavedGradientById = useAppStore((s) => s.removeSavedGradientById)
  const lastDeleted = useAppStore((s) => s.lastDeleted)
  const undoDelete = useAppStore((s) => s.undoDelete)
  const setViewerGradient = useAppStore((s) => s.setViewerGradient)
  const redoDelete = useAppStore((s) => s.redoDelete)
  const setMode = useAppStore((s) => s.setMode)
  const galleryLayout = useAppStore((s) => s.galleryLayout)
  const setGalleryLayout = useAppStore((s) => s.setGalleryLayout)
  const collections = useAppStore((s) => s.collections)
  const createCollection = useAppStore((s) => s.createCollection)
  const setActiveCollection = useAppStore((s) => s.setActiveCollection)
  const addToCollection = useAppStore((s) => s.addToCollection)
  const removeFromCollection = useAppStore((s) => s.removeFromCollection)
  const [typeFilter, setTypeFilter] = useState<GradientType | null>(null)
  const [hueFilter, setHueFilter] = useState<string | null>(null)
  const [collectionView, setCollectionView] = useState<string | null>(null)
  const [open, setOpen] = useState<Gradient | null>(null)
  const reorderSaved = useAppStore((s) => s.reorderSaved)
  const dragIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Publish the open viewer gradient so the app-level Cmd+C copies it. Resolve
  // the live copy from `saved` (the viewer reads `live` for the same reason) so
  // a rename made in the viewer is reflected in what gets copied.
  useEffect(() => {
    const liveOpen = open ? saved.find((g) => g.id === open.id) ?? open : null
    setViewerGradient(liveOpen)
    return () => setViewerGradient(null)
  }, [open, saved, setViewerGradient])
  const [undoVisible, setUndoVisible] = useState(false)
  const [segment, setSegment] = useState<'yours' | 'feed'>('yours')
  const [activeThemeId, setActiveThemeId] = useState<string>('banff')
  const [authoring, setAuthoring] = useState(false)
  const curatedDrops = useAppStore((s) => s.curatedDrops)
  const galleryHint = useHint('gallery')

  // Every delete surfaces an Undo toast for a few seconds. The deleted
  // gradient stays recoverable in the store either way; the timer only
  // hides the affordance.
  useEffect(() => {
    if (!lastDeleted) {
      setUndoVisible(false)
      return
    }
    setUndoVisible(true)
    const timer = setTimeout(() => setUndoVisible(false), 6000)
    return () => clearTimeout(timer)
  }, [lastDeleted])

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

  const filtered = saved.filter((gradient) => matchesFilters(gradient, typeFilter, hueFilter))
  const hasFilters = typeFilter !== null || hueFilter !== null

  // Lookup + active-collection membership for the collections layer.
  const gradientsById = Object.fromEntries(saved.map((g) => [g.id, g])) as Record<string, Gradient>
  const activeCol = collectionView ? collections.find((c) => c.id === collectionView) ?? null : null
  const members = activeCol
    ? activeCol.gradientIds.map((id) => gradientsById[id]).filter(Boolean) as Gradient[]
    : []

  // Entering the Gallery loads tiles in reading order: each tile's delay is
  // its index in the rendered list, so the grid arrives top-left → bottom-right
  // like it's loading in. Tiny steps, capped, so it reads as a ripple.
  const ENTER_STEP_MS = 35
  const ENTER_DELAY_CAP_MS = 400
  const enterDelayFor = (index: number) => Math.min(index * ENTER_STEP_MS, ENTER_DELAY_CAP_MS)

  const gridRef = useRef<HTMLDivElement>(null)
  const activeTheme = THEMED_FEEDS.find((t) => t.id === activeThemeId) ?? THEMED_FEEDS[0]

  // Masonry uses measured row spans; grid layout is a plain uniform grid.
  // `segment` and `collectionView` are included because the grid unmounts and
  // remounts when you switch Yours <-> Daily Drops or enter/leave a board — and
  // the freshly-mounted tiles need re-measuring, or they keep their default 8px
  // grid slot and pile up (a "solitaire stack" of overlapping tiles).
  useMasonryRowSpans(gridRef, galleryLayout === 'masonry', [
    galleryLayout,
    filtered.map((g) => g.id).join(','),
    segment,
    collectionView,
  ])

  // Glide tiles to their new spots after a drag reorder (FLIP). Disabled under
  // reduced-motion. Keyed on the current order so it runs only on reorder.
  const orderKey = filtered.map((g) => g.id).join(',')
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useFlipReorder(gridRef, orderKey, !prefersReducedMotion)

  function clearDrag() {
    dragIdRef.current = null
    setDraggingId(null)
    setDragOverId(null)
  }
  function handleDragStartTile(id: string) {
    dragIdRef.current = id
    setDraggingId(id)
  }
  function handleDragEnterTile(id: string) {
    if (dragIdRef.current && id !== dragIdRef.current) setDragOverId(id)
  }
  function handleDropTile(id: string) {
    const from = dragIdRef.current
    if (from && from !== id) reorderSaved(from, id)
    clearDrag()
  }

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
    <div data-testid="gallery" className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Gallery</h2>
          <div className={styles.segmentControl}>
            <button
              type="button"
              className={segment === 'yours' ? styles.segmentBtnActive : styles.segmentBtn}
              onClick={() => {
                setSegment('yours')
                setCollectionView(null)
              }}
            >
              Yours ({saved.length})
            </button>
            <button
              type="button"
              className={segment === 'feed' ? styles.segmentBtnActive : styles.segmentBtn}
              onClick={() => setSegment('feed')}
            >
              Daily Drops
            </button>
          </div>
        </div>
        <div className={styles.headerActions}>
          {segment === 'yours' && (
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={galleryLayout === 'grid' ? styles.toggleBtnActive : styles.toggleBtn}
                onClick={() => setGalleryLayout('grid')}
                aria-label="Show grid layout"
                title="Grid layout"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                type="button"
                className={galleryLayout === 'masonry' ? styles.toggleBtnActive : styles.toggleBtn}
                onClick={() => setGalleryLayout('masonry')}
                aria-label="Show Pinterest masonry layout"
                title="Pinterest masonry layout"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="9" />
                  <rect x="14" y="3" width="7" height="5" />
                  <rect x="14" y="12" width="7" height="9" />
                  <rect x="3" y="16" width="7" height="5" />
                </svg>
              </button>
            </div>
          )}
          <BoardShare
            saved={saved}
            onImport={onImport ?? (() => {})}
            position="inline"
          />
        </div>
      </div>

      {segment === 'feed' ? (
        <>
          <button
            type="button"
            data-testid="drop-author-toggle"
            className={styles.emptyAction}
            onClick={() => setAuthoring((v) => !v)}
          >
            {authoring ? 'Close author' : 'Author a drop'}
          </button>
          {authoring ? (
            <>
              <DropAuthor />
              <div data-testid="curated-drops">
                {curatedDrops.map((d) => (
                  <article key={d.id} className={styles.themeHero} data-testid={`curated-drop-${d.id}`}>
                    <div className={styles.themeHeroBadge}>{d.date}</div>
                    <h3 className={styles.themeHeroTitle}>{d.title}</h3>
                    <p className={styles.themeHeroDescription}>{d.description}</p>
                    <div className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}>
                      {d.gradients.map((g) => (
                        <span
                          key={g.id}
                          className={styles.tilePreview}
                          style={{
                            backgroundImage: buildGradientCss(g.type, g.stops, false),
                            aspectRatio: '4 / 5',
                            display: 'block',
                          }}
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className={styles.themeSelector}>
                {THEMED_FEEDS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={activeThemeId === t.id ? styles.themeTabActive : styles.themeTab}
                    onClick={() => setActiveThemeId(t.id)}
                    style={
                      activeThemeId === t.id
                        ? ({ '--theme-color': t.themeColor } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <span className={styles.themeTabEmoji}>{t.emoji}</span>
                    <span className={styles.themeTabName}>{t.name}</span>
                  </button>
                ))}
              </div>

              <div
                className={styles.themeHero}
                style={{ '--theme-color': activeTheme.themeColor } as React.CSSProperties}
              >
                <div className={styles.themeHeroBadge}>Today’s themed drops</div>
                <h3 className={styles.themeHeroTitle}>{activeTheme.name}</h3>
                <p className={styles.themeHeroSubtitle}>{activeTheme.subtitle}</p>
                <p className={styles.themeHeroDescription}>{activeTheme.description}</p>
              </div>

              <div
                data-testid="gallery-grid"
                ref={gridRef}
                onKeyDown={handleGridKeyDown}
                className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}
              >
                {activeTheme.gradients.map((g) => (
                  <Tile
                    key={g.id}
                    gradient={g}
                    onOpen={setOpen}
                    galleryLayout={galleryLayout}
                    onRiff={onRiff}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : saved.length === 0 ? (
        <div className={styles.onboarding}>
          <p className={styles.onboardingTitle}>Create a gradient</p>
          <p className={styles.onboardingSub}>Pick a shape to start — your saves land here.</p>
          <div className={styles.onboardingChoices}>
            {ONBOARDING_TYPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
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
                      false
                    ),
                  }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : activeCol ? (
        <div data-testid="collection-detail">
          <div className={styles.header}>
            <button
              type="button"
              className={styles.emptyAction}
              onClick={() => setCollectionView(null)}
            >
              ← Collections
            </button>
            <h2 className={styles.title}>
              {activeCol.name} <span className={styles.titleCount}>({members.length})</span>
            </h2>
            <button
              type="button"
              data-testid="collection-open-in-feed"
              className={styles.emptyAction}
              onClick={() => {
                setActiveCollection(activeCol.id)
                setMode('create')
              }}
            >
              Open in feed
            </button>
          </div>
          <div className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}>
            {members.map((g) => (
              <Tile
                key={g.id}
                gradient={g}
                onOpen={setOpen}
                galleryLayout={galleryLayout}
                onRiff={onRiff}
                onDelete={(id) => removeFromCollection(activeCol.id, id)}
                enterDelayMs={0}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <CollectionsRow
            collections={collections}
            gradientsById={gradientsById}
            onOpen={(id) => setCollectionView(id)}
            onCreateFromDrop={(gradientId) => {
              const id = createCollection()
              addToCollection(id, gradientId)
              setCollectionView(id)
            }}
            onDropGradient={addToCollection}
          />
          <div className={styles.chips}>
            <button
              type="button"
              className={!hasFilters ? styles.chipOn : styles.chip}
              onClick={() => {
                setTypeFilter(null)
                setHueFilter(null)
              }}
            >
              All <span className={styles.chipCount}>{saved.length}</span>
            </button>
            {TYPE_CHIPS.map((type) => {
              const count = saved.filter((gradient) => gradient.type === type).length
              return (
                <button
                  key={type}
                  type="button"
                  className={typeFilter === type ? styles.chipOn : styles.chip}
                  onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                >
                  {type[0].toUpperCase() + type.slice(1)}{' '}
                  <span className={styles.chipCount}>{count}</span>
                </button>
              )
            })}
            {HUE_FAMILIES.map((family) => {
              const count = saved.filter((gradient) => gradientHueFamily(gradient.stops) === family.key).length
              return (
                <button
                  key={family.key}
                  type="button"
                  aria-label={`Filter by ${family.label} (${count} matches)`}
                  className={hueFilter === family.key ? styles.hueChipOn : styles.hueChip}
                  onClick={() => setHueFilter(hueFilter === family.key ? null : family.key)}
                >
                  <span className={styles.hueDot} style={{ background: family.swatchHex }} />
                  <span className={styles.hueCount}>{count}</span>
                </button>
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {hasFilters && saved.length > 0 ? (
                <>
                  <p className={styles.emptyText}>No matches here.</p>
                  <button
                    type="button"
                    className={styles.emptyAction}
                    onClick={() => {
                      setTypeFilter(null)
                      setHueFilter(null)
                    }}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.emptyText}>Make something — your pins land here.</p>
                  <button type="button" className={styles.emptyAction} onClick={() => setMode('create')}>
                    Create
                  </button>
                </>
              )}
            </div>
          ) : (
            <div
              ref={gridRef}
              key={`${typeFilter ?? 'all'}-${hueFilter ?? 'all'}`}
              onKeyDown={handleGridKeyDown}
              className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}
            >
              {filtered.map((gradient, index) => (
                <Tile
                  key={gradient.id}
                  gradient={gradient}
                  onOpen={setOpen}
                  galleryLayout={galleryLayout}
                  onRiff={onRiff}
                  onDelete={removeSavedGradientById}
                  enterDelayMs={enterDelayFor(index)}
                  draggable={!hasFilters}
                  isDragging={draggingId === gradient.id}
                  isDragOver={dragOverId === gradient.id}
                  onDragStartTile={handleDragStartTile}
                  onDragEnterTile={handleDragEnterTile}
                  onDropTile={handleDropTile}
                  onDragEndTile={clearDrag}
                />
              ))}
            </div>
          )}
        </>
      )}

      {undoVisible && lastDeleted && (
        <div data-testid="undo-toast" className={styles.undoToast} role="status">
          <span className={styles.undoText}>
            Deleted “{lastDeleted.gradient.name ?? 'Untitled'}”
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
          items={segment === 'feed' ? activeTheme.gradients : filtered}
          onNavigate={setOpen}
          onClose={() => setOpen(null)}
          onRiff={onRiff}
          onImport={onImport ?? (() => {})}
        />
      )}
    </div>
  )
}
