import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, nextRotationAngle, nextFanRotation, SELECTABLE_GEOMETRY, angleForTypeChange, defaultAngleForType, type GradientType } from '../lib/gradient'
import {
  toEditableStops,
  equalizeEditableStops,
  isEvenlyDistributed,
  reassignPositions,
  removeStopAt,
  addStop,
  moveStop,
  toGradientStops,
  type EditableStop,
} from '../lib/stopOrdering'
import { sortByOklch, type SortKey } from '../lib/sortColors'
import { useHint } from '../hooks/useHint'
import { useScrolling } from '../hooks/useScrolling'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { Hint } from './Hint'
import { ColorList } from './ColorList'
import { gradientCssSnippet } from '../lib/cssSnippet'
import { NoiseOverlay } from './NoiseOverlay'
import { GeometryTabs } from './GeometryTabs'
import { ShortcutHints, type ShortcutHintItem } from './ShortcutHints'
import { PaletteTitle } from './PaletteTitle'
import { BoardShare } from './BoardShare'
import { namePalette } from '../lib/naming'
import { launchSaveFlight, saveFlightOrigin } from '../lib/saveFlight'
import { MEDIA_ICON } from '../lib/mediaChrome'
import { titleColorAt } from '../lib/titleColor'
import { LikeButton } from './LikeButton'
import { FlowEditor } from './FlowEditor'
import { TurrellSquare } from './TurrellSquare'
import { ScrollTicker } from './ScrollTicker'
import { feedSession, makeGradient, SHAPE_STEP_PX } from './Feed'
import { decayVelocity, shouldStartMomentum } from '../lib/momentum'
import { tickHaptic, primeHaptics } from '../lib/haptics'
import type { Gradient } from '../store/types'
import { CanvasHandles } from './CanvasHandles'
import { useAnimatedStops } from '../hooks/useAnimatedStops'
import { Icon } from '../icons'
import { Drawer } from '@base-ui/react/drawer'
import styles from './EditMode.module.css'

// 'original' restores the order the stops had before any sorting (the saved
// palette order, or whatever the user last arranged by hand).
type OrderKey = SortKey | 'original'
const ORDER_CYCLE: OrderKey[] = ['original', 'lightness', 'chroma', 'hue']
// Short enough that the longest ("Order: Original") still fits a third of a
// 320px sheet without ellipsizing. "Lightness" was the one that didn't — the
// accessible name still says the full key, see the chip's aria-label.
const ORDER_LABELS: Record<OrderKey, string> = {
  original: 'Original',
  lightness: 'Light',
  chroma: 'Chroma',
  hue: 'Hue',
}

/** Ceiling on stops. Beyond this the flow editor's handles overlap and the
 * palette stops being a palette. */
const MAX_STOPS = 8

const EDIT_SHORTCUTS: ShortcutHintItem[] = [
  { keys: ['↑', '↓'], label: 'Browse' },
  { keys: ['←', '→'], label: 'Style' },
  { keys: ['S'], label: 'Save' },
  { keys: ['F'], label: 'Flip' },
  { keys: ['R'], label: 'Rotate' },
  { keys: ['Esc'], label: 'Back' },
]

interface EditModeProps {
  gradient: Gradient
  onExit: () => void
  onImport?: (jsonText: string) => void
  /** Fires whenever the mobile bottom sheet's open/closed state changes, so
   * the app shell can bring the tab bar back while the sheet is dismissed —
   * otherwise the tab bar stays hidden for all of edit mode and closing the
   * sheet leaves the user with no way back to the gallery. */
  onSheetHiddenChange?: (hidden: boolean) => void
}

export function EditMode({ gradient, onExit, onImport = () => {}, onSheetHiddenChange }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const saved = useAppStore((s) => s.saved)
  const isGradientSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const toggleNoise = useAppStore((s) => s.toggleNoise)
  const lockedColors = useAppStore((s) => s.lockedColors)
  const toggleColorLock = useAppStore((s) => s.toggleColorLock)
  const syncColorLock = useAppStore((s) => s.syncColorLock)
  const releaseColorLockAt = useAppStore((s) => s.releaseColorLockAt)
  const lockedPositions = useAppStore((s) => s.lockedPositions)
  const togglePositionLock = useAppStore((s) => s.togglePositionLock)
  const syncPositionLock = useAppStore((s) => s.syncPositionLock)
  const releasePositionLockAt = useAppStore((s) => s.releasePositionLockAt)
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)
  // The scroll-position number only means something in the endless Create
  // feed. When editing a saved gradient (opened from the Gallery) it's a
  // named, one-off palette, so the counter would be meaningless — hide it.
  const fromGallery = useAppStore((s) => s.editEnteredFrom === 'gallery')
  const [editableStops, setEditableStops] = useState<EditableStop[]>(() => toEditableStops(gradient.stops))
  const [activeOrder, setActiveOrder] = useState<OrderKey>('original')
  // Set the moment a stop is dragged (or nudged with the arrow keys). From
  // then on the spacing belongs to the user: adding or deleting a colour must
  // NOT re-spread everything, which is what made a single delete undo a
  // carefully placed set of stops. Cleared by the Reset spacing button.
  //
  // Seeded from the gradient itself rather than starting false, because a
  // palette can arrive already custom — reopening a saved one from the Gallery,
  // or following a share link. Where the spacing came from is not the point;
  // that it isn't the default ladder is.
  const [positionsCustomized, setPositionsCustomized] = useState(
    () => !isEvenlyDistributed(toEditableStops(gradient.stops))
  )
  // Stop ids in the user's own order — the baseline "Original" restores to.
  // Refreshed by every hand edit (add/remove), never by a sort.
  const unsortedOrderRef = useRef<string[]>([])
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const previewPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  // ONE HEIGHT. The sheet had two — a peek showing the Shape/Effect switch and
  // one section, and an open state adding the colour stops — with a drag
  // gesture and a grab handle to move between them. It is now just the open
  // one.
  //
  // Two heights meant the sheet you got depended on invisible state: the same
  // surface was 240px or 359px, the grabber changed size between them, and the
  // stops were present or absent depending on which you were in. A sheet whose
  // contents come and go is one you have to check before you can use, and the
  // peek's only real job — seeing more gradient — is what the Create feed and
  // the gallery are already for.
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  // Crossfades the preview's colors when a canvas-handle swap reorders them,
  // so the color blocks visibly trade places instead of hard-jumping.
  const animatedStops = useAnimatedStops(toGradientStops(editableStops))
  const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const editHint = useHint('edit')
  // Duck the floating chrome (title, save, share, noise) out while scrubbing
  // the rolodex, matching the create feed and the bottom tab bar.
  const scrolling = useScrolling()
  // Also duck it while a canvas handle is being dragged, so a drag near the
  // bottom edge never collides with the Save/grain/Order FABs.
  const [handleDragging, setHandleDragging] = useState(false)
  // Tapping the preview asks the drawer to open/close so the gradient can be
  // seen in full, rather than the bottom third of it staying covered. MOBILE
  // ONLY — see chromeHidden below for why the side panel doesn't get this.
  // Persists across a rolodex scrub on purpose: closing the sheet to look at
  // a shape is a state you're in, not a one-shot reveal, so browsing to the
  // next candidate shouldn't quietly reopen it. Also flipped by the drawer
  // itself — swiping the sheet down closes it the same way a tap does; see
  // the Drawer.Root below.
  const [sheetHidden, setSheetHidden] = useState(false)
  const isDraggingRef = useRef(false)
  const lastHandleDragEndRef = useRef(0)
  const pendingGradientRef = useRef<Gradient | null>(null)
  const isDesktop = useIsDesktop()
  // Duck the floating chrome (FABs, back) while a canvas handle is being
  // dragged, or while the sheet is closed, so both share the same "gradient
  // alone, nothing floating" state. MOBILE ONLY — the side panel never
  // obstructs the gradient the way the bottom sheet does, so tapping the
  // preview there still exits instead of needing a reveal state at all.
  const chromeHidden = (handleDragging || sheetHidden) && !isDesktop
  // Surface the sheet's real open/closed state to the app shell, so it can
  // bring the tab bar back the moment the sheet is dismissed rather than
  // hiding it for the whole edit-mode duration.
  useEffect(() => {
    onSheetHiddenChange?.(sheetHidden)
    return () => onSheetHiddenChange?.(false)
  }, [sheetHidden, onSheetHiddenChange])
  // The sheet's OWN duck during a handle drag is separate from chromeHidden:
  // it is a transient opacity fade (the drag ends, it comes right back),
  // not the drawer's real open/closed state, which only the tap/swipe above
  // changes. Conflating the two would make releasing a drag re-open a sheet
  // the user had deliberately closed a moment before.
  const sheetDuckHidden = handleDragging && !isDesktop

  // The title is bare text on the gradient, so it still samples the palette
  // where it sits. The floating buttons no longer do — they carry their own
  // surface (.ghost-chip) with a fixed ink, so back / share / save read as one
  // set with the tab bar instead of four differently-tinted chips.
  //
  // Sampled from what is ON SCREEN rather than from the last committed
  // gradient, which is what made the title look a beat behind the picture.
  // Two things caused that. A canvas-handle drag deliberately withholds
  // setCurrentGradient until release (see commit), so `gradient` is stale for
  // the entire drag while the preview repaints every frame — the ink simply
  // froze and then snapped. And a colour swap crossfades the background over
  // 220ms while the ink, read off the committed stops, had already jumped.
  // animatedStops is precisely what the preview is painting, so the two now
  // move together by construction.
  const painted = useMemo(() => ({ ...gradient, stops: animatedStops }), [gradient, animatedStops])
  const titleColor = titleColorAt(painted, 0.5, 0.06)

  // See the identical ref in Feed: goTo runs inside listeners bound once at
  // mount, so the locks it generates against must be read live.
  const lockedColorsRef = useRef(lockedColors)
  lockedColorsRef.current = lockedColors
  const lockedPositionsRef = useRef(lockedPositions)
  lockedPositionsRef.current = lockedPositions

  // Scroll, drag, and keyboard navigation state for editing
  const [tickerIndex, setTickerIndex] = useState(() => feedSession.index)
  const accumulatedDeltaRef = useRef(0)
  const lastTouchYRef = useRef<number | null>(null)
  const lastPointerYRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef<number | null>(null)
  const momentumFrameIdRef = useRef<number | null>(null)
  // Horizontal scroll/swipe → shape step, the same state machine the create
  // feed runs: wheel deltas accumulate per segment (reset on a pause), and a
  // touch gesture locks to one axis so a sideways swipe never also scrubs.
  const wheelXAccumRef = useRef(0)
  const wheelXResetTimerRef = useRef<number | null>(null)
  const lastTouchXRef = useRef<number | null>(null)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const touchAxisRef = useRef<'none' | 'h' | 'v'>('none')
  const touchShapeAccumRef = useRef(0)

  useEffect(() => {
    const stops = toEditableStops(gradient.stops)
    setEditableStops(stops)
    unsortedOrderRef.current = stops.map((s) => s.id)
    setActiveOrder('original')
    setPositionsCustomized(!isEvenlyDistributed(stops))
    setTickerIndex(feedSession.index)
    feedSession.lockedType = gradient.type
    feedSession.lockedAngle = gradient.angle
    setActiveStopId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id, gradient.type])


  useEffect(() => {
    const timer = setTimeout(() => editHint.dismiss(), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const STEP_PX = 60

  /** Step the geometry sideways, keeping the colors — the same action the
   * ←/→ keys and the Shape tiles perform, and the counterpart to goTo's
   * vertical scrub. The create feed has had this on a horizontal wheel/swipe
   * since it shipped; the editor only had the keys, so on desktop a trackpad
   * swipe that worked full-screen did nothing here. */
  function cycleShape(dir: 1 | -1) {
    const currentGrad = useAppStore.getState().current
    if (!currentGrad) return
    // indexOf can be -1 for a legacy type not in the list; start from 0 so the
    // step still lands on a valid selectable geometry.
    const currentIndex = Math.max(0, SELECTABLE_GEOMETRY.indexOf(currentGrad.type))
    const len = SELECTABLE_GEOMETRY.length
    const nextType = SELECTABLE_GEOMETRY[(currentIndex + dir + len) % len]
    feedSession.lockedType = nextType
    setCurrentGradient({
      ...currentGrad,
      type: nextType,
      stops: toGradientStops(editableStopsRef.current),
    })
    tickHaptic()
  }

  function goTo(newIndex: number) {
    const history = feedSession.history
    if (newIndex < 0) return

    if (newIndex >= history.length) {
      const typeToUse = feedSession.lockedType ?? gradient.type
      const fresh = {
        // Via the ref: this runs inside listeners bound once at mount, so a
        // lock set moments ago must not be read from a stale closure.
        ...makeGradient(typeToUse, activeColorSet, lockedColorsRef.current, lockedPositionsRef.current),
        angle: feedSession.lockedAngle ?? defaultAngleForType(typeToUse)
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

      const scale = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 800 : 1
      const dy = e.deltaY * scale
      const dx = e.deltaX * scale

      // Horizontal-dominant wheel steps the shape, exactly as it does in the
      // create feed. Accumulate per swipe segment and reset on a direction
      // flip or a pause, so one flick steps once instead of racing the list.
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.sign(dx) !== Math.sign(wheelXAccumRef.current)) wheelXAccumRef.current = 0
        wheelXAccumRef.current += dx
        if (wheelXResetTimerRef.current) clearTimeout(wheelXResetTimerRef.current)
        if (Math.abs(wheelXAccumRef.current) >= SHAPE_STEP_PX) {
          cycleShape(wheelXAccumRef.current > 0 ? 1 : -1)
          wheelXAccumRef.current = 0
        } else {
          wheelXResetTimerRef.current = window.setTimeout(() => {
            wheelXAccumRef.current = 0
          }, 200)
        }
        return
      }

      wheelXAccumRef.current = 0
      accumulatedDeltaRef.current += dy
      consumeAccumulatedDelta()
    }

    function handleTouchStart(e: TouchEvent) {
      cancelMomentum()
      primeHaptics()
      const touch = e.touches[0]
      lastTouchYRef.current = touch?.clientY ?? null
      lastTouchXRef.current = touch?.clientX ?? null
      touchStartXRef.current = touch?.clientX ?? 0
      touchStartYRef.current = touch?.clientY ?? 0
      touchAxisRef.current = 'none'
      touchShapeAccumRef.current = 0
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = 0
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      const touchY = e.touches[0]?.clientY
      const touchX = e.touches[0]?.clientX
      const now = performance.now()

      // Lock the gesture to whichever axis it commits to first — sideways
      // steps the shape, up/down scrubs the rolodex, never both at once.
      if (touchAxisRef.current === 'none' && touchX != null && touchY != null) {
        const dxTotal = Math.abs(touchX - touchStartXRef.current)
        const dyTotal = Math.abs(touchY - touchStartYRef.current)
        if (Math.max(dxTotal, dyTotal) > 8) {
          touchAxisRef.current = dxTotal > dyTotal ? 'h' : 'v'
        }
      }

      if (touchAxisRef.current === 'h' && touchX != null) {
        const prevX = lastTouchXRef.current ?? touchX
        lastTouchXRef.current = touchX
        touchShapeAccumRef.current += touchX - prevX
        // Swipe left advances, matching ArrowRight.
        while (touchShapeAccumRef.current <= -SHAPE_STEP_PX) {
          touchShapeAccumRef.current += SHAPE_STEP_PX
          cycleShape(1)
        }
        while (touchShapeAccumRef.current >= SHAPE_STEP_PX) {
          touchShapeAccumRef.current -= SHAPE_STEP_PX
          cycleShape(-1)
        }
        return
      }

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
      if (wheelXResetTimerRef.current) clearTimeout(wheelXResetTimerRef.current)
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
        if (state.current) {
          // Same flight the pill fires on click — see saveFlightOrigin. Only
          // on the way IN, matching LikeButton: un-saving is a correction.
          if (!state.isGradientSaved(state.current)) {
            launchSaveFlight(state.current, saveFlightOrigin())
          }
          state.toggleSaveGradient(state.current)
        }
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
          const nextAngle = angleForTypeChange(currentGrad.type, nextType, currentGrad.angle)
          feedSession.lockedAngle = nextAngle
          setCurrentGradient({
            ...currentGrad,
            type: nextType,
            angle: nextAngle,
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

    // Capture, not bubble: Base UI's Drawer.Popup stops propagation of every
    // arrow/Home/End keydown that reaches it (it assumes such keys belong to
    // a composite widget inside the popup), which would otherwise swallow
    // these shortcuts the moment focus is inside the mobile sheet — a
    // geometry tab, the sort chip, anything. A capture listener on window
    // runs on the way down, before that stopPropagation happens on the way
    // back up, so it sees the key regardless of where focus is.
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  // Auto re-spreading is for the DEFAULT state only. Once a stop has been
  // dragged, or a colour pinned, the arrangement is something the user built
  // and the app has no business rewriting it on the next add or delete —
  // that's the "I moved a stop, deleted a colour, and lost my spacing" bug.
  // Reset spacing (in the sheet) is how you deliberately go back.
  const distributionLocked = positionsCustomized || Object.keys(lockedColors).length > 0

  function commit(
    nextStops: EditableStop[],
    overrides?: Partial<Pick<Gradient, 'type' | 'reversed'>>,
    opts?: { fromSort?: boolean; reorder?: boolean }
  ) {
    // Three different things can happen to positions here:
    //   reorder  — same stops, new sequence: keep the ladder, re-pair colours
    //              to it, so a sort or a canvas swap survives custom spacing.
    //   locked   — count changed but the spacing is the user's: leave it be.
    //   default  — count changed and nothing is customized: re-spread evenly.
    const spaced = opts?.reorder
      ? reassignPositions(nextStops)
      : distributionLocked
        ? nextStops
        : equalizeEditableStops(nextStops, lockedPositions)
    setEditableStops(spaced)
    if (!opts?.fromSort) {
      unsortedOrderRef.current = spaced.map((s) => s.id)
      setActiveOrder('original')
    }
    const nextGrad: Gradient = {
      ...gradient,
      ...overrides,
      // toGradientStops sorts by position, because a CSS gradient reads its
      // stops in order and silently clamps any that go backwards — and a
      // re-ranked palette is in colour order, not position order.
      stops: toGradientStops(spaced),
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
    // Locks are keyed by index, so removing a stop has to close the gap —
    // otherwise every pin above the removed one starts holding the wrong
    // color.
    const index = editableStops.findIndex((s) => s.id === id)
    if (index !== -1) {
      releaseColorLockAt(index)
      releasePositionLockAt(index)
    }
    commit(removeStopAt(editableStops, id))
  }

  function handleSelectType(type: GradientType) {
    // Switching into radial or Turrell centres the origin unless it was
    // already an origin type — see angleForTypeChange.
    const angle = angleForTypeChange(gradient.type, type, gradient.angle)
    feedSession.lockedAngle = angle
    commitPreservingPositions({ type, angle })
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
    // If this stop is pinned, the pin follows the edit. Otherwise the next
    // scroll would restore the OLD locked color and quietly undo what the
    // user just typed.
    const index = nextStops.findIndex((s) => s.id === id)
    if (index !== -1) syncColorLock(index, hex)
  }

  function handleToggleColorLock(index: number, hex: string) {
    toggleColorLock(index, hex)
  }

  function handleTogglePositionLock(index: number, position: number) {
    togglePositionLock(index, position)
  }

  /** Typing a percentage in the Colors list. Same path as dragging the handle,
   * so it marks the spacing customized and carries any pin with it. */
  function handleReposition(id: string, position: number) {
    handleMoveStop(id, position)
  }

  /** Seed for a new stop: the color of whichever existing stop sits at or
   * before `position`, so an added stop starts as a neighbour rather than as
   * a white slab through the middle of the gradient. */
  function seedHexAt(position: number): string {
    const sorted = [...editableStops].sort((a, b) => a.position - b.position)
    if (sorted.length === 0) return '#ffffff'
    let seed = sorted[sorted.length - 1].hex
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].position >= position) {
        seed = sorted[Math.max(0, i - 1)].hex
        break
      }
    }
    return seed
  }

  function handleAddColorAt(position: number) {
    if (editableStops.length >= MAX_STOPS) return
    const newStop = { id: crypto.randomUUID(), hex: seedHexAt(position), position }
    const next = [...editableStops, newStop]
    setEditableStops(next)
    setCurrentGradient({ ...gradient, stops: toGradientStops(next) })
    // Selecting it scrolls the Colors list to its row, which is where the new
    // stop gets its actual color. Tapping the track used to open the OS picker
    // instead — on desktop that opened in a corner of the screen nowhere near
    // where you clicked.
    setActiveStopId(newStop.id)
  }

  /** The Colors list's own "+ Add": no click position to work from, so it
   * lands in the widest gap, the same rule the swatch tray used. */
  function handleAddColor() {
    if (editableStops.length >= MAX_STOPS) return
    const next = addStop(editableStops, editableStops[editableStops.length - 1]?.hex ?? '#ffffff')
    const added = next[next.length - 1]
    commit(next)
    setActiveStopId(added.id)
  }

  // Order re-ranks the COLOURS and leaves the placements alone: commit's
  // `reorder` option re-pairs the new colour sequence to the existing sorted
  // ladder instead of re-spacing evenly, so a sort or a canvas-handle swap
  // survives custom spacing.
  function handleSortCycle() {
    const next = ORDER_CYCLE[(ORDER_CYCLE.indexOf(activeOrder) + 1) % ORDER_CYCLE.length]
    if (next === 'original') {
      const orderIndex = new Map(unsortedOrderRef.current.map((id, i) => [id, i]))
      const restored = [...editableStops].sort(
        (a, b) => (orderIndex.get(a.id) ?? Infinity) - (orderIndex.get(b.id) ?? Infinity)
      )
      commit(restored, undefined, { fromSort: true, reorder: true })
    } else {
      commit(sortByOklch(editableStops, (s) => s.hex, next), undefined, { fromSort: true, reorder: true })
    }
    setActiveOrder(next)
  }

  // Tapping a stop selects it, which highlights and scrolls to its row in the
  // Colors list — where the swatch, the hex field and the lock live. It used
  // to fire a hidden `<input type="color">.click()`; see ColorList for why
  // that put the OS picker in the wrong corner of a desktop screen.
  function handleTapStop(id: string) {
    if (!editableStops.some((s) => s.id === id)) return
    setActiveStopId(id)
  }

  // Exit-on-tap for the preview, with two guards: taps on child buttons
  // (like, sort, grain) never exit — target check, since stopPropagation is
  // unreliable across iOS pointer/touch synthesis — and pointer sequences
  // that moved more than a tap threshold (scrolls/drags) never exit either.
  const PREVIEW_TAP_THRESHOLD_PX = 10

  function handlePreviewPointerDown(e: React.PointerEvent) {
    // turrell-square is deliberately NOT in this list: it's a purely decorative
    // stack of divs (no buttons, no handlers of its own), but it covers the
    // entire preview via position:absolute/inset:0 — excluding it here would
    // swallow every tap on a Turrell gradient specifically, since there'd be
    // nowhere left inside the preview for a tap to land outside it.
    if ((e.target as HTMLElement).closest('button, [data-testid="palette-title"], [data-testid="canvas-handles"]')) return
    previewPointerStartRef.current = { x: e.clientX, y: e.clientY }
    editHint.dismiss()
  }

  function handlePreviewPointerUp(e: React.PointerEvent) {
    const start = previewPointerStartRef.current
    previewPointerStartRef.current = null
    if (isDraggingRef.current || Date.now() - lastHandleDragEndRef.current < 350) return
    // turrell-square is deliberately NOT in this list: it's a purely decorative
    // stack of divs (no buttons, no handlers of its own), but it covers the
    // entire preview via position:absolute/inset:0 — excluding it here would
    // swallow every tap on a Turrell gradient specifically, since there'd be
    // nowhere left inside the preview for a tap to land outside it.
    if ((e.target as HTMLElement).closest('button, [data-testid="palette-title"], [data-testid="canvas-handles"]')) return
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) > PREVIEW_TAP_THRESHOLD_PX) return
    }
    // Mobile: the sheet covers the bottom of the gradient, so a tap clears it
    // to show the whole thing rather than leaving edit mode outright — the
    // same tap brings it back. Desktop's side panel never covers the
    // gradient, so there's nothing to reveal and the tap still exits.
    if (!isDesktop) {
      setSheetHidden((hidden) => !hidden)
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

  // Built from the COMMITTED stops, not `animatedStops`: the copy box must not
  // churn through interpolation frames while a reorder crossfades, and what
  // you copy has to be the palette, not a moment inside a transition.
  const cssSnippet = gradientCssSnippet(gradient, toGradientStops(editableStops))

  function handleMoveStop(id: string, position: number) {
    const nextStops = moveStop(editableStops, id, position)
    setEditableStops(nextStops)
    // The one gesture that means "this spacing is mine now".
    setPositionsCustomized(true)
    // A pinned stop's pin follows the handle, exactly as a pinned colour
    // follows an edit — otherwise the next roll would snap it back and the
    // drag would look like it had been rejected.
    const movedIndex = nextStops.findIndex((s) => s.id === id)
    if (movedIndex !== -1) syncPositionLock(movedIndex, Math.round(nextStops[movedIndex].position))
    setCurrentGradient({
      ...gradient,
      stops: toGradientStops(nextStops),
    })
  }

  /** Puts the stops back on the even ladder and hands automatic re-spreading
   * back to the app. The deliberate counterpart to never re-spreading behind
   * the user's back. */
  function handleResetDistribution() {
    // Pinned positions survive the reset — that is what pinning one is for.
    const even = equalizeEditableStops(editableStops, lockedPositions)
    setEditableStops(even)
    setPositionsCustomized(false)
    setCurrentGradient({ ...gradient, stops: toGradientStops(even) })
  }

  // Offered only when it would actually do something. Pinning a colour also
  // locks the distribution, and a Reset button that changes nothing visible is
  // worse than no button.
  // With a position pinned, Reset spacing always has something to do (put the
  // UNPINNED stops back on the ladder), so it stays available rather than
  // hiding the moment the arrangement happens to look even.
  const evenlySpaced =
    Object.keys(lockedPositions).length === 0 && isEvenlyDistributed(editableStops)

  // Shared between the desktop side panel (plain div, always open, no
  // gesture) and the mobile sheet (Drawer.Popup, open/closed by tap or
  // swipe) — the two differ in what wraps this, not in what's inside it.
  const sheetBody = (
    <>
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
        order={activeOrder}
        orderLabel={ORDER_LABELS[activeOrder]}
        onCycleOrder={handleSortCycle}
      />

      <div className={styles.blockArea}>
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
      <div className={styles.stopActions}>
        <span className={styles.stopHint}>Tap a blank spot to add · drag down to remove</span>
        {/* Only when the spacing has actually drifted off the even ladder —
            this is the escape hatch for the "stop re-spreading my stops"
            rule, not a permanent control. */}
        {!evenlySpaced && (
          <button
            type="button"
            data-testid="reset-distribution"
            className={`lds-chip ${styles.resetButton}`}
            onClick={handleResetDistribution}
          >
            Reset spacing
          </button>
        )}
      </div>
      {/* The palette, readable. Below the flow editor because the editor is
          the spatial view (where each color sits) and this is the literal
          one (what each color IS). */}
      <ColorList
        stops={editableStops}
        lockedColors={lockedColors}
        lockedPositions={lockedPositions}
        onRecolor={recolorStop}
        onReposition={handleReposition}
        onToggleLock={handleToggleColorLock}
        onTogglePositionLock={handleTogglePositionLock}
        onRemove={handleRemove}
        onAdd={handleAddColor}
        cssText={cssSnippet}
        activeStopId={activeStopId}
        onSelect={setActiveStopId}
      />
      {/* Keyboard hints live in the panel (desktop only, hidden on touch via
          the component's own media query) rather than floating on the canvas. */}
      <div>
        <ShortcutHints items={EDIT_SHORTCUTS} placement="inline" color="currentColor" />
      </div>
    </>
  )

  /** Clears the active stop when the sheet's own background (not a child
   * control) is pressed — unchanged from the pre-Drawer sheet. */
  function handleSheetPointerDown(e: React.PointerEvent) {
    if (e.target === e.currentTarget) {
      setActiveStopId(null)
    }
  }

  return (
    <div data-testid="edit-mode" className={styles.container} onPointerDown={() => editHint.dismiss()}>
      <button
        type="button"
        data-testid="edit-mode-back"
        aria-label="Back"
        className={[styles.backButton, MEDIA_ICON, chromeHidden && styles.hidden].filter(Boolean).join(' ')}
        onClick={onExit}
      >
        <Icon name="chevron-left" size="md" />
      </button>
      <BoardShare
        saved={saved}
        current={gradient}
        onImport={onImport}
        chromeVisible={!chromeHidden}
        position="editor"
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
        {/* Save lives on the gradient itself (bottom-right) on every screen
            size — the same spot and pill as the create feed — instead of a
            full-width button inside the sheet. */}
        <LikeButton
          liked={isGradientSaved}
          onToggle={() => toggleSaveGradient(gradient)}
          hidden={chromeHidden}
          gradient={gradient}
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
          onReorder={(next) => commit(next, undefined, { reorder: true })}
          onResetSpacing={() => {
            handleResetDistribution()
            tickHaptic()
          }}
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
      {isDesktop ? (
        <div
          data-testid="edit-sheet"
          className={styles.sheet}
          onPointerDown={handleSheetPointerDown}
        >
          {/* Decorative, and deliberately not a button. With one height there
              is nothing for it to do, and a grabber that answers a tap with
              nothing is worse than no grabber — it is the visual cap that
              says "sheet". Hidden on this layout by its own media query. */}
          <div data-testid="sheet-handle" aria-hidden="true" className={styles.sheetHandle} />
          {/* Same shell/content split as the mobile Drawer.Popup/Drawer.Content
              pair below, so .sheetContent's padding/scroll rules apply the
              same way on both layouts without a separate desktop-only class. */}
          <div className={styles.sheetContent}>{sheetBody}</div>
        </div>
      ) : (
        // Real drag-to-dismiss/reopen physics instead of a hand-rolled
        // max-height collapse — see the framework discussion this replaced.
        // modal={false}: the canvas underneath (dragging a stop handle) has
        // to stay interactive while the sheet is open, which a modal drawer's
        // focus trap and pointer-blocking backdrop would both prevent.
        // disablePointerDismissal: the preview tap that reopens the sheet is
        // itself a press outside Drawer.Popup — without this, Base UI's own
        // outside-press dismissal saw that same tap and closed the sheet right
        // back, so a reopen never stuck. The preview's own pointerUp handler
        // (below) is the one and only thing that should open/close on a tap;
        // the built-in swipe-to-dismiss on the popup is untouched by this prop.
        <Drawer.Root
          modal={false}
          disablePointerDismissal
          open={!sheetHidden}
          onOpenChange={(open) => setSheetHidden(!open)}
        >
          <Drawer.Portal>
            <Drawer.Viewport className={styles.sheetViewport}>
              <Drawer.Popup
                data-testid="edit-sheet"
                className={[styles.sheet, sheetDuckHidden && styles.hidden].filter(Boolean).join(' ')}
                onPointerDown={handleSheetPointerDown}
              >
                {/* Outside Drawer.Content on purpose — it's the one part of
                    the sheet that should always start a drag, where
                    everything below needs a scroll/tap to resolve first. */}
                <div data-testid="sheet-handle" aria-hidden="true" className={styles.sheetHandle} />
                <Drawer.Content className={styles.sheetContent}>{sheetBody}</Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      )}
      {/* "Recolor" was the old promise: tapping a stop fired the OS picker.
          It now selects the stop and takes you to its row in the Colors list. */}
      {!chromeHidden && editHint.visible && <Hint text="Tap a color to select it" visible={editHint.visible && !chromeHidden} />}
    </div>
  )
}
