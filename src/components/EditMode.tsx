import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, type GradientType } from '../lib/gradient'
import {
  toEditableStops,
  equalizePositions,
  removeStopAt,
  addStop,
  removeLastByHex,
  moveStop,
  toGradientStops,
  type EditableStop,
} from '../lib/stopOrdering'
import { sortByOklch, type SortKey } from '../lib/sortColors'
import { useHint } from '../hooks/useHint'
import { Hint } from './Hint'
import { LikeButton } from './LikeButton'
import { GrainButton } from './GrainButton'
import { NoiseOverlay } from './NoiseOverlay'
import { GeometryTabs } from './GeometryTabs'
import { PaletteTitle } from './PaletteTitle'
import { FlutedOverlay } from './FlutedOverlay'
import { Drawer } from './Drawer'
import { namePalette } from '../lib/naming'
import { glassToneAt } from '../lib/glassTone'
import { FlowEditor } from './FlowEditor'
import { SwatchTray } from './SwatchTray'
import { TurrellSquare } from './TurrellSquare'
import { ScrollTicker } from './ScrollTicker'
import { feedSession, makeGradient } from './Feed'
import { decayVelocity, shouldStartMomentum } from '../lib/momentum'
import { tickHaptic, primeHaptics } from '../lib/haptics'
import type { Gradient } from '../store/types'
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
}

export function EditMode({ gradient, onExit }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const saved = useAppStore((s) => s.saved)
  const isGradientSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const toggleNoise = useAppStore((s) => s.toggleNoise)
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)
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
  const editHint = useHint('edit')

  // Per-corner glass tones so each floating control flips dark only when the
  // gradient underneath it is bright (see lib/glassTone).
  const backTone = glassToneAt(gradient, 0.06, 0.06)
  const titleTone = glassToneAt(gradient, 0.5, 0.06)
  const cornerTone = glassToneAt(gradient, 0.93, 0.88)
  const sortTone = glassToneAt(gradient, 0.12, 0.93)

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

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goTo(feedSession.index + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        if (feedSession.index > 0) {
          goTo(feedSession.index - 1)
        }
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })
    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelMomentum()
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setCurrentGradient({
      ...gradient,
      ...overrides,
      stops: equalized,
    })
  }

  // Switching geometry type or toggling reversed must not disturb the stop
  // positions the user has already dragged into place — only handle removal/
  // addition/sorting re-equalizes, since those change stop count or order.
  function commitPreservingPositions(
    overrides: Partial<
      Pick<Gradient, 'type' | 'reversed' | 'repeatEnabled' | 'hardStops' | 'smoothEnabled' | 'flutedEnabled'>
    >
  ) {
    setCurrentGradient({
      ...gradient,
      ...overrides,
      stops: toGradientStops(editableStops),
    })
  }

  function handleRemove(id: string) {
    if (editableStops.length <= 2) return
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

  function handleToggleSmooth() {
    commitPreservingPositions({ smoothEnabled: !gradient.smoothEnabled })
  }

  function handleToggleFluted() {
    commitPreservingPositions({ flutedEnabled: !gradient.flutedEnabled })
  }

  function isPointOverElement(point: { x: number; y: number }, el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  }

  function handleDragAddFromTray(hex: string, point: { x: number; y: number }) {
    const el = blockContainerRef.current
    if (!el) return
    if (!isPointOverElement(point, el)) return
    commit(addStop(editableStops, hex))
  }

  function handleTapAdd(hex: string) {
    commit(addStop(editableStops, hex))
  }

  function handleTapRemove(hex: string) {
    if (editableStops.length <= 2) return
    commit(removeLastByHex(editableStops, hex))
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

  function handleTapStop(_id: string) {
    // Placeholder hook for a future "tap to change color" UI. No such UI
    // exists yet in this codebase (BlockStack never wired one either), so
    // this intentionally does nothing until that flow is built.
  }

  // Exit-on-tap for the preview, with two guards: taps on child buttons
  // (like, sort, grain) never exit — target check, since stopPropagation is
  // unreliable across iOS pointer/touch synthesis — and pointer sequences
  // that moved more than a tap threshold (scrolls/drags) never exit either.
  const PREVIEW_TAP_THRESHOLD_PX = 10

  function handlePreviewPointerDown(e: React.PointerEvent) {
    previewPointerStartRef.current = { x: e.clientX, y: e.clientY }
    editHint.dismiss()
  }

  function handlePreviewPointerUp(e: React.PointerEvent) {
    const start = previewPointerStartRef.current
    previewPointerStartRef.current = null
    if ((e.target as HTMLElement).closest('button, [data-testid="palette-title"]')) return
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.sqrt(dx * dx + dy * dy) > PREVIEW_TAP_THRESHOLD_PX) return
    }
    onExit()
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
        className={backTone === 'dark' ? `${styles.backButton} glass-dark` : styles.backButton}
        onClick={onExit}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <div
        data-testid="edit-mode-preview"
        ref={previewRef}
        className={styles.preview}
        style={{
          backgroundImage:
            gradient.type === 'square'
              ? undefined
              : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                  repeat: gradient.repeatEnabled,
                  hard: gradient.hardStops,
                  smooth: gradient.smoothEnabled,
                }),
        }}
        onPointerDown={handlePreviewPointerDown}
        onPointerUp={handlePreviewPointerUp}
      >
        <ScrollTicker index={tickerIndex} />
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
        <FlutedOverlay visible={!!gradient.flutedEnabled} />
        <NoiseOverlay visible={noiseEnabled} />
        <PaletteTitle
          name={gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
          onRename={renameCurrentGradient}
          tone={titleTone}
        />
        <GrainButton enabled={noiseEnabled} onToggle={toggleNoise} tone={cornerTone} />
        <LikeButton liked={isGradientSaved} onToggle={() => toggleSaveGradient(gradient)} tone={cornerTone} />
        <button
          type="button"
          data-testid="sort-fab"
          aria-label={`Stop order: ${activeOrder}. Tap to change`}
          className={sortTone === 'dark' ? `${styles.sortFab} glass-dark` : styles.sortFab}
          onClick={handleSortCycle}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          Order: {ORDER_LABELS[activeOrder]}
        </button>
      </div>
      <div data-testid="edit-sheet" ref={sheetRef} className={styles.sheet}>
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
          smoothEnabled={gradient.smoothEnabled}
          onToggleSmooth={handleToggleSmooth}
          flutedEnabled={gradient.flutedEnabled}
          onToggleFluted={handleToggleFluted}
        />
        <div className={styles.blockArea}>
          <FlowEditor
            stops={editableStops}
            onMove={handleMoveStop}
            onTapStop={handleTapStop}
            onRemoveStop={handleRemove}
            containerRef={blockContainerRef}
          />
        </div>
        <SwatchTray
          colorSet={activeColorSet}
          stops={editableStops}
          onTapAdd={handleTapAdd}
          onTapRemove={handleTapRemove}
          onDragAdd={handleDragAddFromTray}
        />
      </div>
      {editHint.visible && <Hint text="Tap a swatch to edit" visible={editHint.visible} />}
      {/* Desktop keeps the favorites stack from explore mode (shifted left of
          the side panel) so the corner stays seamless across modes and saved
          palettes are one tap away while editing. Hidden on mobile, where the
          bottom sheet owns that space (see .container drawer override). */}
      <Drawer saved={saved} onSelect={(g) => setCurrentGradient(g)} />
    </div>
  )
}
