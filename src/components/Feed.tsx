import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { generateGradientStops } from '../lib/palette'
import { GradientPage } from './GradientPage'
import type { GradientType } from '../lib/gradient'
import type { Gradient } from '../store/types'
import type { ColorSet } from '../lib/colorSets'
import { withViewTransition } from '../lib/viewTransition'
import { decayVelocity, shouldStartMomentum } from '../lib/momentum'
import { tickHaptic, primeHaptics } from '../lib/haptics'
import { Hint } from './Hint'
import { useHint } from '../hooks/useHint'
import { ScrollTicker } from './ScrollTicker'
import styles from './Feed.module.css'

const GEOMETRY_TYPES: GradientType[] = ['linear', 'radial', 'angular', 'square']

function pickRandomType(): GradientType {
  return GEOMETRY_TYPES[Math.floor(Math.random() * GEOMETRY_TYPES.length)]
}

export function makeGradient(type: GradientType, colorSet: ColorSet): Gradient {
  const stops = generateGradientStops(colorSet)
  return {
    id: crypto.randomUUID(),
    type,
    stops,
    reversed: false,
  }
}


const STEP_PX = 60

// Session state that must survive Feed unmounting/remounting when the app
// swaps between explore mode (<Feed/>) and edit mode (<EditMode/>). Module-
// level state persists across component remounts within the same page load
// since ES modules are singletons — this is standard practice for exactly
// this kind of "survive unmount" requirement.
export const feedSession: { history: Gradient[]; index: number; lockedType: GradientType | null } = {
  history: [],
  index: 0,
  lockedType: null,
}

export function resetFeedSession() {
  feedSession.history = []
  feedSession.index = 0
  feedSession.lockedType = null
}

/** Riff: seed the Create rolodex with a gradient picked in the Gallery.
 * Per the persistent-session decision, riffing APPENDS to the existing
 * history (scroll-up still reaches everything from this page load) and the
 * locked shape follows the riffed gradient's type. The caller is
 * responsible for setCurrentGradient + switching mode to 'create'; on
 * remount Feed's init effect restores history[index], which is exactly the
 * appended gradient. */
export function riffIntoFeed(gradient: Gradient) {
  feedSession.history = [...feedSession.history, gradient]
  feedSession.index = feedSession.history.length - 1
  feedSession.lockedType = gradient.type
}

interface FeedProps {
  /** When false, chrome (the like button) fades out for uninterrupted viewing. */
  chromeVisible?: boolean
}

export function Feed({ chromeVisible = true }: FeedProps) {
  const current = useAppStore((s) => s.current)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const isGradientSaved = useAppStore((s) => s.isGradientSaved)
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const enterEditMode = useAppStore((s) => s.enterEditMode)
  const scrollHint = useHint('scroll')
  const likeHint = useHint('like')
  // Fires at the reward moment: the first pin teaches where pins live.
  // Dismissed forever on the first Gallery visit (Gallery writes the key).
  const galleryHint = useHint('gallery')
  const hasSaved = useAppStore((s) => s.saved.length > 0)
  const containerRef = useRef<HTMLDivElement>(null)

  // History of gradients generated/visited this session, and the index of
  // the one currently displayed, live on the module-level `feedSession`
  // singleton (see above) so they survive Feed unmount/remount across an
  // edit-mode round trip.
  const accumulatedDeltaRef = useRef(0)
  const lastTouchYRef = useRef<number | null>(null)
  const lastPointerYRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef<number | null>(null)
  const momentumFrameIdRef = useRef<number | null>(null)

  // The gradient "shape" (geometry type) is locked once per Feed session so
  // that scrubbing through the rolodex only varies colors/stops, never the
  // underlying shape. It lives on `feedSession` (see above) and is resolved
  // once in the mount effect below, where `current` (from the store) is read
  // at the correct point in time: if a gradient already exists in the store
  // at mount, its type is reused; otherwise a random type is picked.

  // Avoids stale closures inside the DOM-listener effect below, whose
  // dependency array is intentionally minimal (it doesn't re-run per render).
  const scrollHintDismissRef = useRef(scrollHint.dismiss)
  scrollHintDismissRef.current = scrollHint.dismiss

  // The single piece of React state: whatever gradient is currently shown.
  // Re-renders are triggered explicitly via setDisplayed, never implicitly.
  const [displayed, setDisplayed] = useState<Gradient | null>(null)
  const [tickerIndex, setTickerIndex] = useState(0)

  // Initialize history with a first gradient on mount, if the store doesn't
  // already have one. This is the only place that writes to the store AND
  // to `displayed`/history as a single, deliberate action, so it can't race
  // with the external-sync effect below. This is also where the locked
  // geometry type is resolved (see feedSession.lockedType comment above).
  useEffect(() => {
    if (feedSession.lockedType === null) {
      feedSession.lockedType = current ? current.type : pickRandomType()
    }
    if (feedSession.history.length === 0) {
      const initial = current ?? makeGradient(feedSession.lockedType, activeColorSet)
      feedSession.history = [initial]
      feedSession.index = 0
      setDisplayed(initial)
      if (!current) {
        setCurrentGradient(initial)
      }
    } else {
      // Remounting after returning from edit mode: restore the previously
      // displayed gradient and scroll position without regenerating anything.
      // Edit mode commits keep the gradient id but produce a new object, so
      // adopt the store's version (and its possibly-changed shape) whenever
      // it isn't the exact object already in the history slot.
      if (current && feedSession.history[feedSession.index] !== current) {
        feedSession.history[feedSession.index] = current
        feedSession.lockedType = current.type
      }
      setDisplayed(feedSession.history[feedSession.index])
      setTickerIndex(feedSession.index)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detect external changes to `store.current` (e.g. Drawer selection) and
  // overwrite the current history slot in place, without moving the index
  // or generating anything new. This is the ONLY effect that reacts to
  // `current` changes — `goTo`/init below update the store directly and
  // synchronously alongside `displayed`, so there's no separate "sync
  // displayed -> store" effect to race against this one.
  useEffect(() => {
    if (!current) return
    const history = feedSession.history
    const index = feedSession.index
    const atIndex = history[index]
    // Reference comparison, not id: edit-mode commits keep the id while
    // changing stops/type, and those edits must not be dropped.
    if (atIndex && atIndex !== current) {
      history[index] = current
      setDisplayed(current)
    }
    feedSession.lockedType = current.type
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  function goTo(newIndex: number) {
    const history = feedSession.history

    if (newIndex < 0) {
      return
    }

    if (newIndex === feedSession.index) {
      return
    }

    if (newIndex >= history.length) {
      // Forward past the end of history: generate a brand-new gradient,
      // keeping the same locked shape for this Feed session.
      const fresh = makeGradient(feedSession.lockedType!, activeColorSet)
      history.push(fresh)
    }

    feedSession.index = newIndex
    setTickerIndex(newIndex)
    const next = history[newIndex]
    setDisplayed(next)
    setCurrentGradient(next)
    tickHaptic()
  }

  function consumeAccumulatedDelta() {
    while (accumulatedDeltaRef.current >= STEP_PX) {
      accumulatedDeltaRef.current -= STEP_PX
      goTo(feedSession.index + 1)
    }
    while (accumulatedDeltaRef.current <= -STEP_PX) {
      // Stop consuming once the index has bottomed out at 0, so leftover
      // negative delta doesn't keep spinning the loop with no effect.
      if (feedSession.index <= 0) {
        accumulatedDeltaRef.current = 0
        break
      }
      accumulatedDeltaRef.current += STEP_PX
      goTo(feedSession.index - 1)
    }
  }

  // Attach wheel/touch/mouse/keyboard listeners manually so preventDefault()
  // reliably suppresses native scrolling. React's synthetic onWheel/onTouchMove
  // handlers are not guaranteed to be non-passive across versions/browsers,
  // so we bind directly to the DOM/window nodes instead.
  useEffect(() => {
    const el = containerRef.current
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
      scrollHintDismissRef.current()
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
      // Build the iOS haptic actuator while we still hold user activation,
      // so the first tick of this scroll gesture can actually buzz.
      primeHaptics()
      lastTouchYRef.current = e.touches[0]?.clientY ?? null
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = 0
    }

    function handleTouchMove(e: TouchEvent) {
      scrollHintDismissRef.current()
      e.preventDefault()
      const touchY = e.touches[0]?.clientY
      const now = performance.now()
      if (touchY == null || lastTouchYRef.current == null) {
        lastTouchYRef.current = touchY ?? null
        lastMoveTimeRef.current = now
        return
      }
      // Dragging up (finger moves to smaller Y) should behave like scrolling
      // forward (deltaY > 0), matching the wheel convention.
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
      if (target.closest('button') || target.closest('[data-testid="saved-drawer"]')) {
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
      scrollHintDismissRef.current()

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
  }, [displayed !== null])

  if (!displayed) return null

  return (
    <div data-testid="feed-container" ref={containerRef} className={styles.container}>
      <GradientPage
        gradient={displayed}
        chromeVisible={chromeVisible}
        liked={isGradientSaved(displayed)}
        onToggleLike={() => {
          likeHint.dismiss()
          toggleSaveGradient(displayed)
        }}
        onEdit={() => withViewTransition(enterEditMode)}
      />
      <ScrollTicker index={tickerIndex} />
      {scrollHint.visible && <Hint text="Scroll to explore palettes ↓" visible={scrollHint.visible} />}
      {!scrollHint.visible && likeHint.visible && <Hint text="Tap ♥ to save" visible={likeHint.visible} />}
      {!scrollHint.visible && !likeHint.visible && galleryHint.visible && hasSaved && (
        <Hint text="Saved to your Gallery" visible />
      )}
    </div>
  )
}
