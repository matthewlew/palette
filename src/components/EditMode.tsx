import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, FAN_ANCHORS, SELECTABLE_GEOMETRY, type GradientType } from '../lib/gradient'
import {
  toEditableStops,
  equalizePositions,
  removeStopAt,
  addStop,
  moveStop,
  toGradientStops,
  type EditableStop,
} from '../lib/stopOrdering'
import { sortByOklch, type SortKey } from '../lib/sortColors'
import { useHint } from '../hooks/useHint'
import { useScrolling } from '../hooks/useScrolling'
import { Hint } from './Hint'
import { GrainButton } from './GrainButton'
import { NoiseOverlay } from './NoiseOverlay'
import { GeometryTabs } from './GeometryTabs'
import { PaletteTitle } from './PaletteTitle'
import { BoardShare } from './BoardShare'
import { namePalette } from '../lib/naming'
import { titleColorAt } from '../lib/titleColor'
import { LikeButton } from './LikeButton'
import { FlowEditor } from './FlowEditor'
import { TurrellSquare } from './TurrellSquare'
import { ScrollTicker } from './ScrollTicker'
import { feedSession, makeGradient } from './Feed'
import { decayVelocity, shouldStartMomentum } from '../lib/momentum'
import { tickHaptic, primeHaptics } from '../lib/haptics'
import type { Gradient } from '../store/types'
import { CanvasHandles } from './CanvasHandles'
import { useAnimatedStops } from '../hooks/useAnimatedStops'
import styles from './EditMode.module.css'

// 'original' restores the order the stops had before any sorting (the saved
// palette order, or whatever the user last arranged by hand).
type OrderKey = SortKey | 'original'
const ORDER_CYCLE: OrderKey[] = ['original', 'lightness', 'chroma', 'hue']
const ORDER_LABELS: Record<OrderKey, string> = {
  original: 'Original',
  lightness: 'Lightness',
  chroma: 'Chroma',
  hue: 'Hue',
}

interface EditModeProps {
  gradient: Gradient
  onExit: () => void
  onImport?: (jsonText: string) => void
}

export function EditMode({ gradient, onExit, onImport = () => {} }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const saved = useAppStore((s) => s.saved)
  const isGradientSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const toggleNoise = useAppStore((s) => s.toggleNoise)
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)
  // The scroll-position number only means something in the endless Create
  // feed. When editing a saved gradient (opened from the Gallery) it's a
  // named, one-off palette, so the counter would be meaningless — hide it.
  const fromGallery = useAppStore((s) => s.editReturnMode === 'gallery')
  const [editableStops, setEditableStops] = useState<EditableStop[]>(() => toEditableStops(gradient.stops))
  const [activeOrder, setActiveOrder] = useState<OrderKey>('original')
  // Stop ids in the user's own order — the baseline "Original" restores to.
  // Refreshed by every hand edit (add/remove), never by a sort.
  const unsortedOrderRef = useRef<string[]>([])
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const previewPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  // Crossfades the preview's colors when a canvas-handle swap reorders them,
  // so the color blocks visibly trade places instead of hard-jumping.
  const animatedStops = useAnimatedStops(toGradientStops(editableStops))
  const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  // Hidden native color input, driven programmatically: tapping a stop (or the
  // Add color button) seeds and opens it, replacing the removed swatch tray.
  const colorInputRef = useRef<HTMLInputElement>(null)
  const colorTargetRef = useRef<{ mode: 'recolor'; id: string } | { mode: 'add' } | null>(null)
  const editHint = useHint('edit')
  // Duck the floating chrome (title, save, share, noise) out while scrubbing
  // the rolodex, matching the create feed and the bottom tab bar.
  const scrolling = useScrolling()
  // Also duck it while a canvas handle is being dragged, so a drag near the
  // bottom edge never collides with the Save/grain/Order FABs.
  const [handleDragging, setHandleDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const lastHandleDragEndRef = useRef(0)
  const pendingGradientRef = useRef<Gradient | null>(null)
  const chromeHidden = scrolling || handleDragging

  // Per-corner palette-derived foregrounds (same strategy as the title) so
  // every floating control reads as an extension of the gradient.
  const backColor = titleColorAt(gradient, 0.06, 0.06)
  const titleColor = titleColorAt(gradient, 0.5, 0.06)
  const shareColor = titleColorAt(gradient, 0.94, 0.06)
  const cornerColor = titleColorAt(gradient, 0.93, 0.88)
  const sortColor = titleColorAt(gradient, 0.12, 0.93)

  // Scroll, drag, and keyboard navigation state for editing
  const [tickerIndex, setTickerIndex] = useState(() => feedSession.index)
  const accumulatedDeltaRef = useRef(0)
  const lastTouchYRef = useRef<number | null>(null)
  const lastPointerYRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef<number | null>(null)
  const momentumFrameIdRef = useRef<number | null>(null)

  useEffect(() => {
    const stops = toEditableStops(gradient.stops)
    setEditableStops(stops)
    unsortedOrderRef.current = stops.map((s) => s.id)
    setActiveOrder('original')
    setTickerIndex(feedSession.index)
    feedSession.lockedType = gradient.type
    setActiveStopId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id, gradient.type])

  // Dragging the sheet downward shrinks its real height so the flexed
  // preview grows live (a true move/resize, not a dissolve); releasing past
  // 30% of the sheet's height exits edit mode. Bound as non-passive DOM
  // listeners so preventDefault() reliably stops the page itself scrolling.
  // Drags that start on the flow-editor stop handles are exempt — those own
  // their own vertical (drag-to-delete) gesture.
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    // The drag-to-dismiss gesture only makes sense for the bottom-sheet
    // layout; at tablet/desktop widths the sheet is a fixed side panel.
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches) return
    let startY = 0
    let baseHeight = 0
    let dragY = 0
    let dragging = false

    function handleTouchStart(e: TouchEvent) {
      if ((e.target as HTMLElement).closest('[data-testid="flow-handle"]')) return
      startY = e.touches[0]?.clientY ?? 0
      baseHeight = el!.offsetHeight
      dragY = 0
      dragging = true
    }

    function handleTouchMove(e: TouchEvent) {
      if (!dragging) return
      const y = e.touches[0]?.clientY
      if (y == null) return
      dragY = Math.max(0, y - startY)
      if (dragY > 0) {
        e.preventDefault()
        el!.style.height = `${Math.max(0, baseHeight - dragY)}px`
        el!.style.overflow = 'hidden'
      }
    }

    function handleTouchEnd() {
      if (!dragging) return
      dragging = false
      if (dragY > baseHeight * 0.3) {
        // Keep the collapsed height while exiting — restoring it first made
        // the sheet snap back to full size for a frame (a visible flash)
        // before the exit transition slid it away.
        onExitRef.current()
      } else {
        el!.style.height = ''
        el!.style.overflow = ''
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => editHint.dismiss(), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const STEP_PX = 60

  function goTo(newIndex: number) {
    const history = feedSession.history
    if (newIndex < 0) return

    if (newIndex >= history.length) {
      const fresh = makeGradient(feedSession.lockedType ?? gradient.type, activeColorSet)
      history.push(fresh)
    }

    feedSession.index = newIndex
    setTickerIndex(newIndex)
    setCurrentGradient(history[newIndex])
    tickHaptic()
  }

  function consumeAccumulatedDelta() {
    while (accumulatedDeltaRef.current >= STEP_PX) {
      accumulatedDeltaRef.current -= STEP_PX
      goTo(feedSession.index + 1)
    }
    while (accumulatedDeltaRef.current <= -STEP_PX) {
      if (feedSession.index <= 0) {
        accumulatedDeltaRef.current = 0
        break
      }
      accumulatedDeltaRef.current += STEP_PX
      goTo(feedSession.index - 1)
    }
  }

  // Measure the canvas up front (and on resize) so handles mount already at
  // their anchors and dissolve in on hover, instead of sliding in from the
  // corner the first time the pointer moves and size is first read.
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = previewRef.current
    if (!el) return

    function cancelMomentum() {
      if (momentumFrameIdRef.current !== null) {
        cancelAnimationFrame(momentumFrameIdRef.current)
        momentumFrameIdRef.current = null
      }
    }

    function runMomentumFrame(lastFrameTime: number) {
      const now = performance.now()
      const frameDt = now - lastFrameTime
      accumulatedDeltaRef.current += velocityRef.current * frameDt
      consumeAccumulatedDelta()
      velocityRef.current = decayVelocity(velocityRef.current, frameDt)

      const bottomedOut = feedSession.index <= 0 && velocityRef.current < 0
      if (Math.abs(velocityRef.current) < 0.05 || bottomedOut) {
        momentumFrameIdRef.current = null
        return
      }
      momentumFrameIdRef.current = requestAnimationFrame(() => runMomentumFrame(now))
    }

    function handleWheel(e: WheelEvent) {
      cancelMomentum()
      e.preventDefault()
      
      let dy = e.deltaY
      if (e.deltaMode === 1) {
        // DOM_DELTA_LINE
        dy *= 20
      } else if (e.deltaMode === 2) {
        // DOM_DELTA_PAGE
        dy *= 800
      }
      
      accumulatedDeltaRef.current += dy
      consumeAccumulatedDelta()
    }

    function handleTouchStart(e: TouchEvent) {
      cancelMomentum()
      primeHaptics()
      lastTouchYRef.current = e.touches[0]?.clientY ?? null
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = 0
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      const touchY = e.touches[0]?.clientY
      const now = performance.now()
      if (touchY == null || lastTouchYRef.current == null) {
        lastTouchYRef.current = touchY ?? null
        lastMoveTimeRef.current = now
        return
      }
      const delta = lastTouchYRef.current - touchY
      const dt = lastMoveTimeRef.current == null ? 0 : now - lastMoveTimeRef.current
      if (dt >= 1) {
        const instantV = delta / dt
        velocityRef.current = 0.8 * instantV + 0.2 * velocityRef.current
        lastMoveTimeRef.current = now
      }
      lastTouchYRef.current = touchY
      accumulatedDeltaRef.current += delta
      consumeAccumulatedDelta()
    }

    function handleTouchEnd() {
      lastTouchYRef.current = null
      if (shouldStartMomentum(velocityRef.current)) {
        const startTime = performance.now()
        momentumFrameIdRef.current = requestAnimationFrame(() => runMomentumFrame(startTime))
      }
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('button')) {
        return
      }
      cancelMomentum()
      lastPointerYRef.current = e.clientY
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = 0

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    // eslint-disable-next-line no-inner-declarations
    function handleMouseMove(e: MouseEvent) {
      if (lastPointerYRef.current === null) return

      const delta = lastPointerYRef.current - e.clientY
      const now = performance.now()
      const dt = lastMoveTimeRef.current == null ? 0 : now - lastMoveTimeRef.current
      if (dt >= 1) {
        const instantV = delta / dt
        velocityRef.current = 0.8 * instantV + 0.2 * velocityRef.current
        lastMoveTimeRef.current = now
      }
      lastPointerYRef.current = e.clientY
      accumulatedDeltaRef.current += delta
      consumeAccumulatedDelta()
    }

    // eslint-disable-next-line no-inner-declarations
    function handleMouseUp() {
      lastPointerYRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      if (shouldStartMomentum(velocityRef.current)) {
        const startTime = performance.now()
        momentumFrameIdRef.current = requestAnimationFrame(() => runMomentumFrame(startTime))
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })
    el.addEventListener('mousedown', handleMouseDown)

    return () => {
      cancelMomentum()
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editableStopsRef = useRef(editableStops)
  editableStopsRef.current = editableStops

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inTextField =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      // Escape works even while a button holds focus (e.g. right after
      // clicking Save) — only text fields own it, for cancelling their own
      // editing. It discards unsaved edits, mirroring the close/back
      // buttons; only the explicit Save action commits to the Gallery.
      if (e.key === 'Escape' && !inTextField) {
        e.preventDefault()
        onExitRef.current()
        return
      }

      if (
        inTextField ||
        target?.tagName === 'BUTTON' ||
        // Modifier combos (⌘S, ⌘Z…) belong to the browser or other handlers.
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        // Focused flow-editor stops own the arrow keys (they're sliders).
        target?.closest?.('[role="slider"]')
      ) {
        return
      }

      // ArrowDown/Up scrub the rolodex, matching the vertical scroll and
      // the tick marks; PageDown/Up mirror them. Flip lives on F.
      if (e.key === 'PageDown' || e.key === 'ArrowDown') {
        e.preventDefault()
        goTo(feedSession.index + 1)
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (feedSession.index > 0) {
          goTo(feedSession.index - 1)
        }
      } else if (e.key === ' ' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        const state = useAppStore.getState()
        if (state.current) state.toggleSaveGradient(state.current)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const currentGrad = useAppStore.getState().current
        if (currentGrad) {
          const currentType = currentGrad.type
          // indexOf can be -1 for a legacy type not in the list; start the
          // step from 0 so ←/→ still reaches a valid selectable geometry.
          const currentIndex = Math.max(0, SELECTABLE_GEOMETRY.indexOf(currentType))
          const len = SELECTABLE_GEOMETRY.length
          const nextIndex =
            e.key === 'ArrowRight' ? (currentIndex + 1) % len : (currentIndex - 1 + len) % len
          const nextType = SELECTABLE_GEOMETRY[nextIndex]
          setCurrentGradient({
            ...currentGrad,
            type: nextType,
            stops: toGradientStops(editableStopsRef.current),
          })
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        const currentGrad = useAppStore.getState().current
        if (currentGrad) {
          setCurrentGradient({
            ...currentGrad,
            reversed: !currentGrad.reversed,
            stops: toGradientStops(editableStopsRef.current),
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function commit(
    nextStops: EditableStop[],
    overrides?: Partial<Pick<Gradient, 'type' | 'reversed'>>,
    opts?: { fromSort?: boolean }
  ) {
    const equalized = equalizePositions(nextStops)
    setEditableStops(nextStops.map((stop, i) => ({ ...stop, position: equalized[i].position })))
    if (!opts?.fromSort) {
      unsortedOrderRef.current = nextStops.map((s) => s.id)
      setActiveOrder('original')
    }
    const nextGrad: Gradient = {
      ...gradient,
      ...overrides,
      stops: equalized,
    }
    if (isDraggingRef.current) {
      pendingGradientRef.current = nextGrad
    } else {
      pendingGradientRef.current = null
      setCurrentGradient(nextGrad)
    }
  }

  // Switching geometry type or toggling reversed must not disturb the stop
  // positions the user has already dragged into place — only handle removal/
  // addition/sorting re-equalizes, since those change stop count or order.
  function commitPreservingPositions(
    overrides: Partial<Pick<Gradient, 'type' | 'reversed' | 'repeatEnabled' | 'hardStops' | 'fanAnchor'>>
  ) {
    setCurrentGradient({
      ...gradient,
      ...overrides,
      stops: toGradientStops(editableStops),
    })
  }

  function handleRemove(id: string) {
    if (editableStops.length <= 2) return
    if (activeStopId === id) {
      setActiveStopId(null)
    }
    commit(removeStopAt(editableStops, id))
  }

  function handleSelectType(type: GradientType) {
    commitPreservingPositions({ type })
  }

  function handleToggleReversed() {
    commitPreservingPositions({ reversed: !gradient.reversed })
  }

  function handleToggleRepeat() {
    commitPreservingPositions({ repeatEnabled: !gradient.repeatEnabled })
  }

  function handleToggleHardStops() {
    commitPreservingPositions({ hardStops: !gradient.hardStops })
  }

  // Re-tapping the active Fan tab rotates which edge the cone rises from,
  // cycling bottom → top → left → right.
  function handleRotateFan() {
    const currentIndex = FAN_ANCHORS.indexOf(gradient.fanAnchor ?? 'bottom')
    const next = FAN_ANCHORS[(currentIndex + 1) % FAN_ANCHORS.length]
    commitPreservingPositions({ fanAnchor: next })
  }

  // Recolor a stop in place — positions are left untouched, unlike commit(),
  // which re-equalizes on add/remove.
  function recolorStop(id: string, hex: string) {
    const nextStops = editableStops.map((s) => (s.id === id ? { ...s, hex } : s))
    setEditableStops(nextStops)
    setCurrentGradient({ ...gradient, stops: toGradientStops(nextStops) })
  }

  // Fired when the native color picker commits. Either recolors the tapped
  // stop or appends a new explicit color, per whatever opened the picker.
  function handleColorPicked(hex: string) {
    const target = colorTargetRef.current
    if (!target) return
    if (target.mode === 'recolor') {
      recolorStop(target.id, hex)
    } else {
      commit(addStop(editableStops, hex))
    }
  }

  function handleAddColor() {
    const seed = editableStops[editableStops.length - 1]?.hex ?? '#ffffff'
    colorTargetRef.current = { mode: 'add' }
    const input = colorInputRef.current
    if (input) {
      input.value = seed
      input.click()
    }
  }

  function handleSortCycle() {
    const next = ORDER_CYCLE[(ORDER_CYCLE.indexOf(activeOrder) + 1) % ORDER_CYCLE.length]
    if (next === 'original') {
      const orderIndex = new Map(unsortedOrderRef.current.map((id, i) => [id, i]))
      const restored = [...editableStops].sort(
        (a, b) => (orderIndex.get(a.id) ?? Infinity) - (orderIndex.get(b.id) ?? Infinity)
      )
      commit(restored, undefined, { fromSort: true })
    } else {
      commit(sortByOklch(editableStops, (s) => s.hex, next), undefined, { fromSort: true })
    }
    setActiveOrder(next)
  }

  // Tapping a stop opens the OS color picker seeded with its current hex, so a
  // specific color can be dialed in when the rolodex hasn't surfaced it.
  function handleTapStop(id: string) {
    const stop = editableStops.find((s) => s.id === id)
    if (!stop) return
    setActiveStopId(id)
    colorTargetRef.current = { mode: 'recolor', id }
    const input = colorInputRef.current
    if (input) {
      input.value = stop.hex
      input.click()
    }
  }

  // Exit-on-tap for the preview, with two guards: taps on child buttons
  // (like, sort, grain) never exit — target check, since stopPropagation is
  // unreliable across iOS pointer/touch synthesis — and pointer sequences
  // that moved more than a tap threshold (scrolls/drags) never exit either.
  const PREVIEW_TAP_THRESHOLD_PX = 10

  function handlePreviewPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, [data-testid="palette-title"], [data-testid="canvas-handles"], [data-testid="turrell-square"]')) return
    previewPointerStartRef.current = { x: e.clientX, y: e.clientY }
    editHint.dismiss()
  }

  function handlePreviewPointerUp(e: React.PointerEvent) {
    const start = previewPointerStartRef.current
    previewPointerStartRef.current = null
    if (isDraggingRef.current || Date.now() - lastHandleDragEndRef.current < 350) return
    if ((e.target as HTMLElement).closest('button, [data-testid="palette-title"], [data-testid="canvas-handles"], [data-testid="turrell-square"]')) return
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) > PREVIEW_TAP_THRESHOLD_PX) return
    }
    onExit()
  }

  function handlePreviewPointerMove(e: React.PointerEvent) {
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    setCanvasSize({ width: rect.width, height: rect.height })
    setCanvasCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handlePreviewPointerLeave() {
    setCanvasCursor(null)
  }

  function handleMoveStop(id: string, position: number) {
    const nextStops = moveStop(editableStops, id, position)
    setEditableStops(nextStops)
    setCurrentGradient({
      ...gradient,
      stops: toGradientStops(nextStops),
    })
  }

  return (
    <div data-testid="edit-mode" className={styles.container} onPointerDown={() => editHint.dismiss()}>
      <button
        type="button"
        data-testid="edit-mode-back"
        aria-label="Back"
        className={[styles.backButton, 'ghost-chip', chromeHidden && styles.hidden].filter(Boolean).join(' ')}
        style={{ color: backColor }}
        onClick={onExit}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <BoardShare
        saved={saved}
        current={gradient}
        onImport={onImport}
        chromeVisible={!chromeHidden}
        color={shareColor}
      />
      <div
        data-testid="edit-mode-preview"
        ref={previewRef}
        className={styles.preview}
        style={{
          backgroundImage:
            gradient.type === 'square'
              ? undefined
              : buildGradientCss(gradient.type, animatedStops, gradient.reversed, {
                  repeat: gradient.repeatEnabled,
                  hard: gradient.hardStops,
                  fanAnchor: gradient.fanAnchor,
                }),
        }}
        onPointerDown={handlePreviewPointerDown}
        onPointerUp={handlePreviewPointerUp}
        onPointerMove={handlePreviewPointerMove}
        onPointerLeave={handlePreviewPointerLeave}
      >
        {!fromGallery && <ScrollTicker index={tickerIndex} hidden={chromeHidden} />}
        {gradient.type === 'square' && <TurrellSquare stops={animatedStops} reversed={gradient.reversed} />}
        <NoiseOverlay visible={noiseEnabled} />
        <PaletteTitle
          name={gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
          onRename={renameCurrentGradient}
          hidden={chromeHidden}
          color={titleColor}
        />
        <GrainButton enabled={noiseEnabled} onToggle={toggleNoise} hidden={chromeHidden} color={cornerColor} />
        <button
          type="button"
          data-testid="sort-fab"
          aria-label={`Stop order: ${activeOrder}. Tap to change`}
          className={[styles.sortFab, 'ghost-chip', 'ghost-pill', chromeHidden && styles.hidden].filter(Boolean).join(' ')}
          style={{ color: sortColor }}
          onClick={handleSortCycle}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          Order: {ORDER_LABELS[activeOrder]}
        </button>
        {/* Save lives on the gradient itself (bottom-right, above grain) on
            every screen size — the same spot and pill as the create feed —
            instead of a full-width button inside the sheet. */}
        <LikeButton
          liked={isGradientSaved}
          onToggle={() => toggleSaveGradient(gradient)}
          hidden={chromeHidden}
          color={cornerColor}
        />
        <CanvasHandles
          stops={editableStops}
          type={gradient.type}
          spoke="up"
          fanAnchor={gradient.fanAnchor}
          cursor={canvasCursor}
          size={canvasSize}
          onReorder={(next) => commit(next)}
          onDraggingChange={(dragging) => {
            const wasDragging = isDraggingRef.current
            isDraggingRef.current = dragging
            // Only stamp the cooldown on a genuine drag→release transition.
            // CanvasHandles also reports `false` on mount; stamping then would
            // suppress tap-to-exit for 350ms right after entering edit mode.
            if (!dragging && wasDragging) {
              lastHandleDragEndRef.current = Date.now()
            }
            setHandleDragging(dragging)
            if (!dragging && pendingGradientRef.current) {
              setCurrentGradient(pendingGradientRef.current)
              pendingGradientRef.current = null
            }
          }}
        />
      </div>
      <div
        data-testid="edit-sheet"
        ref={sheetRef}
        className={[styles.sheet, chromeHidden && styles.hidden].filter(Boolean).join(' ')}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            setActiveStopId(null)
          }
        }}
      >
        <button
          type="button"
          data-testid="sheet-handle"
          aria-label="Collapse controls"
          className={styles.sheetHandle}
          onClick={onExit}
        />
        <GeometryTabs
          type={gradient.type}
          onSelectType={handleSelectType}
          onToggleReversed={handleToggleReversed}
          repeatEnabled={gradient.repeatEnabled}
          onToggleRepeat={handleToggleRepeat}
          hardStops={gradient.hardStops}
          onToggleHardStops={handleToggleHardStops}
          onRotateFan={handleRotateFan}
        />

        <div className={styles.blockArea}>
          <FlowEditor
            stops={editableStops}
            onMove={handleMoveStop}
            onTapStop={handleTapStop}
            onRemoveStop={handleRemove}
            containerRef={blockContainerRef}
            activeStopId={activeStopId}
          />
        </div>
        <div className={styles.stopActions}>
          <button
            type="button"
            data-testid="add-color"
            className={styles.addColor}
            onClick={handleAddColor}
          >
            + Add color
          </button>
          <span className={styles.stopHint}>Tap a color to recolor · drag down to remove</span>
        </div>
        {/* Off-screen native picker, opened programmatically from a stop tap or
            the Add color button — the explicit-color path that replaces the
            swatch tray. */}
        <input
          ref={colorInputRef}
          type="color"
          aria-hidden="true"
          tabIndex={-1}
          data-testid="color-input"
          className={styles.colorInput}
          onChange={(e) => handleColorPicked(e.target.value)}
        />
      </div>
      {!chromeHidden && editHint.visible && <Hint text="Tap a color to recolor" visible={editHint.visible && !chromeHidden} />}
    </div>
  )
}
