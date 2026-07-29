import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, nextRotationAngle, nextFanRotation, SELECTABLE_GEOMETRY, type GradientType } from '../lib/gradient'
import {
  toEditableStops,
  equalizePositions,
  removeStopAt,
  addStop,
  moveStop,
  toGradientStops,
  stopLayout,
  applyToLayout,
  type EditableStop,
} from '../lib/stopOrdering'
import { sortByOklch, type SortKey } from '../lib/sortColors'
import { normalizeStopLayout } from '../lib/palette'
import { useHint } from '../hooks/useHint'
import { useScrolling } from '../hooks/useScrolling'
import { Hint } from './Hint'
import { NoiseOverlay } from './NoiseOverlay'
import { GeometryTabs } from './GeometryTabs'
import { ShortcutHints, type ShortcutHintItem } from './ShortcutHints'
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

const EDIT_SHORTCUTS: ShortcutHintItem[] = [
  { keys: ['↑', '↓'], label: 'Browse' },
  { keys: ['←', '→'], label: 'Style' },
  { keys: ['S'], label: 'Save' },
  { keys: ['F'], label: 'Flip' },
  { keys: ['R'], label: 'Rotate' },
  { keys: ['Esc'], label: 'Back' },
]

// Past a detent the sheet still moves, but only a third as far — the standard
// rubber band. It exists so a drag in the "wrong" direction is answered with
// resistance instead of nothing: dead controls read as broken controls.
const RUBBER_BAND = 0.33

// A flick faster than this decides the destination on its own, however short it
// was. px/ms, measured off real dispatched touch drags: a deliberate short
// flick lands between 0.33 and 0.45, and a slow deliberate drag around 0.12.
// 0.35 sits in the gap — comfortably above anything accidental, below the
// slowest thing a person would call a flick.
const FLICK_VELOCITY = 0.35

// How long the sheet takes to settle onto a detent after release. Matches the
// max-height transition the collapsed class already used.
const SETTLE_MS = 200

// Movement under this is a tap, not a drag — the handle's own click still
// toggles, and a thumb that wobbles a few pixels should not move the sheet.
const DRAG_SLOP_PX = 6

/** Hold `value` between two detents, but keep moving past them at a fraction of
 * the distance. The clamp is what stops the sheet sliding somewhere it cannot
 * rest and springing back; the give is what stops the ends feeling broken. */
export function clampWithRubberBand(value: number, min: number, max: number): number {
  if (value < min) return min - (min - value) * RUBBER_BAND
  if (value > max) return max + (value - max) * RUBBER_BAND
  return value
}

/**
 * Which detent a released drag settles onto: 'peek' or 'open'.
 *
 * Velocity first, position second. A short fast flick beats a long slow drag,
 * which is how every other sheet on the platform behaves and what makes a
 * half-open sheet feel thrown rather than dropped. `velocity` is px/ms and
 * positive downward, matching clientY.
 */
export function chooseDetent(
  height: number,
  peekH: number,
  openH: number,
  velocity: number,
): 'peek' | 'open' {
  if (velocity > FLICK_VELOCITY) return 'peek'
  if (velocity < -FLICK_VELOCITY) return 'open'
  // Ties go to open: the sheet is the controls, and the user dragged it there.
  return height - peekH < openH - height ? 'peek' : 'open'
}

/**
 * Open the OS colour picker for a hidden `<input type="color">`.
 *
 * showPicker() first. It is the standardised API for exactly this, and unlike
 * a synthetic click it is SPECIFIED to open the picker rather than merely to
 * dispatch a click event — a browser that will not honour it throws
 * (NotAllowedError without user activation, InvalidStateError otherwise)
 * instead of silently doing nothing, which is what makes the fallback
 * reachable rather than decorative.
 *
 * `position` is the stop's 0-100 place on the track. The input is parked over
 * that stop before opening, because a picker anchored to a control has to have
 * somewhere sensible to point at; a 1x1 element left at the origin gets a
 * popover in the corner of the screen.
 */
export function openColorPicker(
  input: HTMLInputElement | null,
  track: HTMLElement | null,
  position: number,
) {
  if (!input) return
  if (track) {
    const rect = track.getBoundingClientRect()
    if (rect.width > 0) {
      input.style.left = `${rect.left + (rect.width * position) / 100}px`
      input.style.top = `${rect.top + rect.height / 2}px`
    }
  }
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
  } catch {
    // Refused — fall through to the click, which some engines still honour.
  }
  input.click()
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
  const lockedStopLayout = useAppStore((s) => s.lockedStopLayout)
  const setLockedStopLayout = useAppStore((s) => s.setLockedStopLayout)
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)
  // The scroll-position number only means something in the endless Create
  // feed. When editing a saved gradient (opened from the Gallery) it's a
  // named, one-off palette, so the counter would be meaningless — hide it.
  const fromGallery = useAppStore((s) => s.editEnteredFrom === 'gallery')
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
  // Dragging the sheet down collapses it to a peek — a near-full-screen
  // gradient view that's still in edit mode (a pull-tab restores it); only
  // Back/Esc actually exits.
  //
  // It now OPENS OPEN on mobile too. It used to start at the peek so the
  // preview got the screen, but the peek shows the Shape/Effect switch and one
  // section, and nothing else — so tapping a gradient to edit it handed you six
  // shape buttons and no colour stops, and the stops (what most edits are
  // actually about) needed a second, undiscoverable tap on a 4px grab handle.
  // Opening with the controls you came for beats opening with a bigger picture
  // of the gradient you were already looking at; dragging down is still there
  // the moment you want the picture back.
  const [collapsed, setCollapsed] = useState(false)
  const collapseRef = useRef<(v: boolean) => void>(() => {})
  collapseRef.current = setCollapsed
  // The drag gesture is bound once as native listeners, so it reads the
  // current collapsed state through a ref rather than a stale closure.
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed
  // True only while a drag or its settle animation is in flight. It drops the
  // collapsed class so the whole panel is in the layout and the inline height
  // can reveal it continuously — see the gesture effect below.
  const [sheetDragging, setSheetDragging] = useState(false)
  const setDraggingRef = useRef<(v: boolean) => void>(() => {})
  setDraggingRef.current = setSheetDragging
  // Last measured peek height. Survives the sheet being open, so a drag that
  // starts from open still knows where the lower detent is.
  const peekHRef = useRef(0)
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
  // Duck the floating chrome (FABs, sheet, back) while a canvas handle is being
  // dragged, so a drag near the bottom edge never collides with them.
  const chromeHidden = handleDragging

  // Per-corner palette-derived foregrounds (same strategy as the title) so
  // every floating control reads as an extension of the gradient.
  //
  // Sampled from what is ON SCREEN rather than from the last committed
  // gradient, which is what made the chrome look a beat behind the picture.
  // Two things caused that. A canvas-handle drag deliberately withholds
  // setCurrentGradient until release (see commit), so `gradient` is stale for
  // the entire drag while the preview repaints every frame — the ink simply
  // froze and then snapped. And a colour swap crossfades the background over
  // 220ms while the ink, read off the committed stops, had already jumped.
  // animatedStops is precisely what the preview is painting, so the two now
  // move together by construction.
  const painted = useMemo(() => ({ ...gradient, stops: animatedStops }), [gradient, animatedStops])
  const backColor = titleColorAt(painted, 0.06, 0.06)
  const titleColor = titleColorAt(painted, 0.5, 0.06)
  const shareColor = titleColorAt(painted, 0.94, 0.06)
  const cornerColor = titleColorAt(painted, 0.93, 0.88)

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
    feedSession.lockedAngle = gradient.angle
    setActiveStopId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id, gradient.type])

  // ONE gesture, not four.
  //
  // The sheet has two resting heights — peek (the handle, the Shape/Effect
  // switch, and the active section) and open (all of it). The previous version
  // handled each state-and-direction pair differently: open-dragged-down
  // resized live, collapsed-dragged-up jumped at a 28px threshold,
  // collapsed-dragged-down did literally nothing, and open-dragged-up did
  // nothing. Four quadrants, three mental models, and two of them silent — so
  // the sheet felt locked in one state, jerky in another, and dead in a third.
  //
  // Now every quadrant is the same thing: the sheet's height follows your
  // thumb, clamped to the two detents, with a rubber band past either end so a
  // drag with nowhere to go answers with resistance instead of nothing. On
  // release it settles onto whichever detent it is nearer, or whichever way a
  // flick was thrown.
  //
  // The collapsed CLASS is dropped for the duration of the drag and the height
  // driven inline instead. The class hides the lower half outright
  // (display:none, so the peek can never show a sliced row), which is right at
  // rest and impossible to interpolate through — you cannot reveal in stages
  // what is not in the layout. Dropping it renders everything and lets the
  // inline height do the clipping, which is what makes the reveal continuous
  // in both directions.
  //
  // Bound as non-passive DOM listeners so preventDefault() reliably stops the
  // page itself scrolling. Drags that start on the flow-editor stop handles are
  // exempt — those own their own vertical (drag-to-delete) gesture.
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    // The drag gesture only makes sense for the bottom-sheet layout; at
    // tablet/desktop widths the sheet is a fixed side panel.
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches) return

    let startY = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let peekH = 0
    let openH = 0
    let active = false
    let moved = false
    let settling = false

    /** The peek height, derived rather than hard-coded — sizing to content is
     * what stopped the peek slicing a row when the Shape and Effect sections
     * turned out to be different heights.
     *
     * Measured with the collapsed class ON, exactly mirroring measureOpen:
     * add, read, restore in one synchronous block, so nothing paints in between
     * and it costs a reflow and nothing else.
     *
     * It used to reconstruct the number by summing the children the class does
     * not hide, which is only ever an approximation of what the class actually
     * does. That path was a rare fallback while the sheet started collapsed;
     * now that it opens open it would be the path taken on every first drag, so
     * it measures the real thing instead. */
    function measurePeek(): number {
      const had = el!.classList.contains(styles.collapsed)
      if (!had) el!.classList.add(styles.collapsed)
      const h = el!.offsetHeight
      if (!had) el!.classList.remove(styles.collapsed)
      if (h > 0) peekHRef.current = h
      return peekHRef.current
    }

    // performance.now(), not event.timeStamp: the timeStamp origin is not
    // consistent across engines, and it cannot be driven from a test, which
    // means the flick rule would go unverified.
    const now = () => performance.now()

    /** The full height of the open panel — measured with the collapsed class
     * OFF, because that class hides the lower half with display:none and
     * display:none is not in the layout at all. Reading scrollHeight through it
     * returned the PEEK height, so from a collapsed start the sheet believed
     * its two detents were the same number: every upward drag was really just
     * rubber band, and it opened only because `h - peek < open - h` happens to
     * be false when the two are equal.
     *
     * Remove, read, restore, all in one synchronous block — nothing paints in
     * between, so this costs a reflow and nothing else. */
    function measureOpen(): number {
      const had = el!.classList.contains(styles.collapsed)
      if (had) el!.classList.remove(styles.collapsed)
      const h = el!.scrollHeight
      if (had) el!.classList.add(styles.collapsed)
      return h
    }

    function handleTouchStart(e: TouchEvent) {
      if (settling) return
      if ((e.target as HTMLElement).closest('[data-testid="flow-handle"]')) return
      startY = e.touches[0]?.clientY ?? 0
      lastY = startY
      lastT = now()
      velocity = 0
      moved = false
      active = true
      peekH = measurePeek()
      openH = Math.max(measureOpen(), peekH)
    }

    function handleTouchMove(e: TouchEvent) {
      if (!active) return
      const y = e.touches[0]?.clientY
      if (y == null) return

      const t = now()
      const dt = t - lastT
      if (dt > 0) velocity = (y - lastY) / dt
      lastY = y
      lastT = t

      const dragY = y - startY
      if (!moved) {
        if (Math.abs(dragY) < DRAG_SLOP_PX) return
        moved = true
        // Hand the height over to the drag. Setting it to the CURRENT height
        // first means dropping the collapsed class cannot make the sheet jump.
        el!.style.height = `${collapsedRef.current ? peekH : openH}px`
        el!.style.overflow = 'hidden'
        setDraggingRef.current(true)
      }

      e.preventDefault()
      const from = collapsedRef.current ? peekH : openH
      // Never below zero. A negative height is an invalid CSS value, so the
      // CSSOM drops the assignment entirely and the sheet freezes at whatever
      // it last held — the drag looks broken precisely when it is pulled
      // hardest. Only reachable when the peek measures near zero, which is
      // exactly when a rubber band undershoots.
      const next = Math.max(0, clampWithRubberBand(from - dragY, peekH, openH))
      el!.style.height = `${next}px`
    }

    function handleTouchEnd() {
      if (!active) return
      active = false
      if (!moved) return

      // offsetHeight, not getBoundingClientRect: the latter reports 0 wherever
      // there is no real layout engine, which silently sends every released
      // drag to the same detent under test.
      const toPeek = chooseDetent(el!.offsetHeight, peekH, openH, velocity) === 'peek'
      settleTo(toPeek ? peekH : openH, toPeek)
    }

    /** Animate to a detent, then hand control back to the class. */
    function settleTo(targetH: number, toPeek: boolean) {
      settling = true
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        el!.removeEventListener('transitionend', onEnd)
        el!.style.transition = ''
        el!.style.height = ''
        el!.style.overflow = ''
        collapseRef.current(toPeek)
        setDraggingRef.current(false)
        settling = false
      }
      const onEnd = (ev: TransitionEvent) => {
        if (ev.propertyName === 'height') finish()
      }
      el!.addEventListener('transitionend', onEnd)
      el!.style.transition = `height ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
      el!.style.height = `${targetH}px`
      // transitionend never fires when the height is already the target (a drag
      // released exactly on a detent, or reduced-motion), so never wait on it.
      window.setTimeout(finish, SETTLE_MS + 60)
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  // The lock follows the palette in front of you — how many stops there are AND
  // where they sit.
  //
  // Locking a layout and then adding a colour, or dragging a stop along the
  // track, would otherwise leave the feed handing back the old layout and
  // quietly undoing the edit on the next scrub. Moving the lock instead is what
  // makes it a preference — "like this, from now on" — rather than a cage you
  // have to unlock to get out of. Opening a palette with a different layout
  // reads the same way: the lock is about what you are looking at.
  //
  // Keyed on the layout's VALUES, not the array: editableStops is a fresh array
  // every render, so an identity dep would write to the store on every one.
  //
  // NORMALIZED before comparing, which is load-bearing. A dragged stop carries
  // a fractional position (the track maps pixels to percent and does not
  // round), the store rounds on write — so comparing a raw 12.5 against a
  // stored 13 never matches, the effect writes again, and React tears the tree
  // down with a max-update-depth error the moment you drag a handle while
  // locked. Both sides through the same normalizer is what gives it a fixpoint.
  const layoutKey = normalizeStopLayout(stopLayout(editableStops)).join(',')
  useEffect(() => {
    if (lockedStopLayout === null) return
    if (lockedStopLayout.join(',') === layoutKey) return
    setLockedStopLayout(layoutKey.split(',').map(Number))
  }, [layoutKey, lockedStopLayout, setLockedStopLayout])

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
      const typeToUse = feedSession.lockedType ?? gradient.type
      const fresh = {
        // The same stop lock the Create feed honours — scrubbing from inside
        // the editor is the same rolodex, so it obeys the same rule.
        ...makeGradient(typeToUse, activeColorSet, useAppStore.getState().lockedStopLayout ?? undefined),
        angle: feedSession.lockedAngle ?? (typeToUse === 'radial' ? undefined : 0)
      }
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
      // Only block when focus is on a text-like input — checkboxes, switches
      // (e.g. the haptic actuator), and range sliders should not swallow keys.
      const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number'])
      const isTextInput = target?.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((target as HTMLInputElement).type)
      const inTextField =
        isTextInput || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      // Escape works even while a button holds focus (e.g. right after
      // clicking Save) — only text fields own it, for cancelling their own
      // editing. It discards unsaved edits, mirroring the close/back
      // buttons; only the explicit Save action commits to the Gallery.
      if (e.key === 'Escape' && !inTextField) {
        e.preventDefault()
        onExitRef.current()
        return
      }

      // A focused control button (geometry tabs, Add color, Save…) shouldn't
      // swallow the navigation shortcuts — after tapping one, ←/→/↑/↓/F must
      // still work. Only Space/Enter are left to the button so it can activate.
      const onButton = target?.tagName === 'BUTTON'
      if (
        inTextField ||
        // Modifier combos (⌘S, ⌘Z…) belong to the browser or other handlers.
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        // Focused flow-editor stops own the arrow keys (they're sliders).
        (target instanceof Element && target.closest('[role="slider"]'))
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
      } else if (e.key === 's' || e.key === 'S' || (e.key === ' ' && !onButton)) {
        // Space saves only when a button isn't focused — otherwise let Space
        // activate that button. 's' always saves (buttons don't type it).
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
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        const currentGrad = useAppStore.getState().current
        if (currentGrad) {
          const newAngle = nextRotationAngle(currentGrad.type, currentGrad.angle)
          setCurrentGradient({
            ...currentGrad,
            angle: newAngle,
            stops: toGradientStops(editableStopsRef.current),
          })
          feedSession.lockedAngle = newAngle
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
    // keepPositions: the caller has already placed the stops and the ladder is
    // the point (Order re-ranks colours across the placements the user set).
    // Everything else — add, remove — changes the stop COUNT, where an even
    // re-space is the only sane answer.
    opts?: { fromSort?: boolean; keepPositions?: boolean }
  ) {
    const placed = opts?.keepPositions
      ? nextStops.map((stop) => ({ hex: stop.hex, position: stop.position }))
      : equalizePositions(nextStops)
    setEditableStops(nextStops.map((stop, i) => ({ ...stop, position: placed[i].position })))
    if (!opts?.fromSort) {
      unsortedOrderRef.current = nextStops.map((s) => s.id)
      setActiveOrder('original')
    }
    const nextGrad: Gradient = {
      ...gradient,
      ...overrides,
      // Sorted by position, because a CSS gradient reads its stops in order and
      // silently clamps any that go backwards — and a re-ranked palette is in
      // colour order, not position order.
      stops: [...placed].sort((a, b) => a.position - b.position),
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
    overrides: Partial<Pick<Gradient, 'type' | 'reversed' | 'repeatEnabled' | 'hardStops' | 'smoothEnabled' | 'fanAnchor' | 'angle'>>
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
    const reversedPositions = editableStops.map(s => ({ ...s, position: 100 - s.position }))
    setEditableStops(reversedPositions)
    setCurrentGradient({
      ...gradient,
      stops: toGradientStops(reversedPositions),
    })
  }

  function handleToggleRepeat() {
    commitPreservingPositions({ repeatEnabled: !gradient.repeatEnabled })
  }

  function handleToggleHardStops() {
    commitPreservingPositions({ hardStops: !gradient.hardStops, smoothEnabled: false })
  }

  function handleToggleSmooth() {
    commitPreservingPositions({ smoothEnabled: !gradient.smoothEnabled, hardStops: false })
  }

  function handleRotateAngle() {
    const newAngle = nextRotationAngle(gradient.type, gradient.angle)
    commitPreservingPositions({ angle: newAngle })
    feedSession.lockedAngle = newAngle
  }

  // Re-tapping the active Fan tab rotates which edge the cone rises from,
  // by jumping 90 degrees.
  function handleRotateFan() {
    // Shares the 45 degree, nine-position origin cycle with radial and square
    // (centre -> top -> clockwise) instead of its own 90 degree one, which only
    // ever visited the four edges. Rotating also drops the legacy fanAnchor —
    // see nextFanRotation.
    const { angle: newAngle, fanAnchor } = nextFanRotation(gradient.angle)
    commitPreservingPositions({ angle: newAngle, fanAnchor })
    feedSession.lockedAngle = newAngle
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
      // The native color input fires change events continuously while the user
      // drags inside the picker. Append exactly one stop on the first event,
      // then live-recolor that same stop for the rest of the interaction, so a
      // single pick can't spam a pile of near-identical stops.
      const next = addStop(editableStops, hex)
      const added = next[next.length - 1]
      commit(next)
      colorTargetRef.current = { mode: 'recolor', id: added.id }
    }
  }

  function handleAddColorAt(position: number) {
    if (editableStops.length >= 8) return
    // Sample color from nearest stop (or interpolate in the future)
    const sorted = [...editableStops].sort((a, b) => a.position - b.position)
    let seed = '#ffffff'
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].position >= position) {
        seed = sorted[Math.max(0, i - 1)].hex
        break
      }
      if (i === sorted.length - 1) {
        seed = sorted[i].hex
      }
    }
    
    const newStop = { id: Math.random().toString(36).slice(2), hex: seed, position }
    const next = [...editableStops, newStop]
    setEditableStops(next)
    setActiveStopId(newStop.id)
    colorTargetRef.current = { mode: 'recolor', id: newStop.id }
    
    const input = colorInputRef.current
    if (input) {
      input.value = seed
      openColorPicker(input, blockContainerRef.current, position)
    }
  }

  // Order re-ranks the COLOURS and leaves the placements alone.
  //
  // It used to go through commit's equalizePositions, which assigns positions
  // by array index — so re-ranking a palette whose stops had been dragged into
  // place threw that placement away and re-spaced everything evenly. Two
  // independent things were welded together: which colour comes first, and
  // where the stops sit. The ladder is now carried across the sort.
  function handleSortCycle() {
    const next = ORDER_CYCLE[(ORDER_CYCLE.indexOf(activeOrder) + 1) % ORDER_CYCLE.length]
    const ladder = stopLayout(editableStops)
    if (next === 'original') {
      const orderIndex = new Map(unsortedOrderRef.current.map((id, i) => [id, i]))
      const restored = [...editableStops].sort(
        (a, b) => (orderIndex.get(a.id) ?? Infinity) - (orderIndex.get(b.id) ?? Infinity)
      )
      commit(applyToLayout(restored, ladder), undefined, { fromSort: true, keepPositions: true })
    } else {
      commit(
        applyToLayout(sortByOklch(editableStops, (s) => s.hex, next), ladder),
        undefined,
        { fromSort: true, keepPositions: true },
      )
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
      openColorPicker(input, blockContainerRef.current, stop.position)
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
    // While collapsed to the full-screen view, a tap restores the edit panel
    // instead of leaving edit mode.
    if (collapsed) {
      setCollapsed(false)
      return
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
                  angle: gradient.angle,
                  smooth: gradient.smoothEnabled,
                }),
        }}
        onPointerDown={handlePreviewPointerDown}
        onPointerUp={handlePreviewPointerUp}
        onPointerMove={handlePreviewPointerMove}
        onPointerLeave={handlePreviewPointerLeave}
      >
        {/* The tick scroller stays put while scrolling — it's the one bit of
            chrome that should remain when everything else ducks away — but it
            still hides during a handle drag so it doesn't sit under the dots. */}
        {!fromGallery && <ScrollTicker index={tickerIndex} hidden={handleDragging} />}
        {/* Turrell reads "Hard" as crisp: no blur between the nested squares. */}
        {gradient.type === 'square' && (
          <TurrellSquare
            stops={animatedStops}
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
          hidden={chromeHidden}
          color={titleColor}
        />
        {/* Grain used to float here as its own round button. It is an effect
            like Repeat/Smooth/Hard, and having one of the effects live in a
            different corner meant the Effect tab was not, in fact, the list of
            effects — so it moved into that tab. */}

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
          repeat={gradient.repeatEnabled}
          angle={gradient.angle}
          cursor={canvasCursor}
          size={canvasSize}
          hidden={scrolling}
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
        className={[
          styles.sheet,
          chromeHidden && styles.hidden,
          // While dragging, the inline height owns the sheet's size and the
          // whole panel must be in the layout to be revealed a pixel at a time.
          collapsed && !sheetDragging && styles.collapsed,
          sheetDragging && styles.dragging,
        ].filter(Boolean).join(' ')}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            setActiveStopId(null)
          }
        }}
      >
        <button
          type="button"
          data-testid="sheet-handle"
          aria-label={collapsed ? 'Show controls' : 'Collapse controls'}
          className={styles.sheetHandle}
          onClick={() => {
            // On the desktop side-panel layout the sheet doesn't collapse, so
            // the handle keeps its exit behavior; on the mobile bottom sheet it
            // toggles the full-screen (collapsed) view.
            if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches) {
              onExit()
            } else {
              setCollapsed((c) => !c)
            }
          }}
        />
        <GeometryTabs
          gradient={gradient}
          stops={animatedStops}
          onSelectType={handleSelectType}
          onToggleReversed={handleToggleReversed}
          onToggleRepeat={handleToggleRepeat}
          onToggleHardStops={handleToggleHardStops}
          onToggleSmooth={handleToggleSmooth}
          onRotateFan={handleRotateFan}
          onRotate={handleRotateAngle}
          noiseEnabled={noiseEnabled}
          onToggleNoise={toggleNoise}
          stopCount={editableStops.length}
          stopCountLocked={lockedStopLayout !== null}
          onToggleStopCountLock={() =>
            setLockedStopLayout(lockedStopLayout === null ? stopLayout(editableStops) : null)
          }
          order={activeOrder}
          orderLabel={ORDER_LABELS[activeOrder]}
          onCycleOrder={handleSortCycle}
        />

        <div className={[styles.blockArea, styles.belowSections].join(' ')}>
          <FlowEditor
            stops={editableStops}
            onMove={handleMoveStop}
            onTapStop={handleTapStop}
            onRemoveStop={handleRemove}
            onAddStopAt={handleAddColorAt}
            containerRef={blockContainerRef}
            activeStopId={activeStopId}
          />
        </div>
        {/* The Order button used to live here in its own row. It is a modifier
            like Repeat/Smooth/Hard/Rotate, so it now sits with them in
            GeometryTabs — which also gives the mobile preview back the 91px
            this row cost. Only the hint is left. */}
        <div className={[styles.stopActions, styles.belowSections].join(' ')}>
          <span className={styles.stopHint}>Tap a blank spot to add · drag down to remove</span>
        </div>
        {/* Keyboard hints live in the panel (desktop only, hidden on touch via
            the component's own media query) rather than floating on the canvas. */}
        <div className={styles.belowSections}>
          <ShortcutHints items={EDIT_SHORTCUTS} placement="inline" color="currentColor" />
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
