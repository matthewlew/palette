import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { generateGradientStops } from '../lib/palette'
import { GradientPage } from './GradientPage'
import type { GradientType } from '../lib/gradient'
import type { Gradient } from '../store/types'
import type { ColorSet } from '../lib/colorSets'
import { withViewTransition } from '../lib/viewTransition'
import { decayVelocity, shouldStartMomentum } from '../lib/momentum'
import { Hint } from './Hint'
import { useHint } from '../hooks/useHint'
import { ScrollTicker } from './ScrollTicker'
import styles from './Feed.module.css'

const GEOMETRY_TYPES: GradientType[] = ['linear', 'radial', 'angular', 'square']

function pickRandomType(): GradientType {
  return GEOMETRY_TYPES[Math.floor(Math.random() * GEOMETRY_TYPES.length)]
}

function makeGradient(type: GradientType, colorSet: ColorSet): Gradient {
  const stops = generateGradientStops(colorSet)
  return {
    id: crypto.randomUUID(),
    type,
    stops,
    reversed: false,
  }
}

function vibrateStep() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

const STEP_PX = 60

export function Feed() {
  const current = useAppStore((s) => s.current)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const enterEditMode = useAppStore((s) => s.enterEditMode)
  const scrollHint = useHint('scroll')
  const likeHint = useHint('like')
  const containerRef = useRef<HTMLDivElement>(null)

  // History of gradients generated/visited this session, and the index of
  // the one currently displayed. These are refs (not state) because wheel
  // and touch events fire rapidly and must mutate synchronously without
  // waiting on React re-renders.
  const historyRef = useRef<Gradient[]>([])
  const indexRef = useRef(0)
  const accumulatedDeltaRef = useRef(0)
  const lastTouchYRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef<number | null>(null)
  const momentumFrameIdRef = useRef<number | null>(null)

  // The gradient "shape" (geometry type) is locked once per Feed mount so
  // that scrubbing through the rolodex only varies colors/stops, never the
  // underlying shape. `useRef` has no lazy initializer, so this starts as
  // null and is resolved exactly once in the mount effect below, where
  // `current` (from the store) is read at the correct point in time: if a
  // gradient already exists in the store at mount, its type is reused;
  // otherwise a random type is picked.
  const lockedTypeRef = useRef<GradientType | null>(null)

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
  // geometry type is resolved (see lockedTypeRef comment above).
  useEffect(() => {
    if (lockedTypeRef.current === null) {
      lockedTypeRef.current = current ? current.type : pickRandomType()
    }
    if (historyRef.current.length === 0) {
      const initial = current ?? makeGradient(lockedTypeRef.current, activeColorSet)
      historyRef.current = [initial]
      indexRef.current = 0
      setDisplayed(initial)
      if (!current) {
        setCurrentGradient(initial)
      }
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
    const history = historyRef.current
    const index = indexRef.current
    const atIndex = history[index]
    if (atIndex && atIndex.id !== current.id) {
      history[index] = current
      setDisplayed(current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  function goTo(newIndex: number) {
    const history = historyRef.current

    if (newIndex < 0) {
      return
    }

    if (newIndex === indexRef.current) {
      return
    }

    if (newIndex >= history.length) {
      // Forward past the end of history: generate a brand-new gradient,
      // keeping the same locked shape for this Feed session.
      const fresh = makeGradient(lockedTypeRef.current!, activeColorSet)
      history.push(fresh)
    }

    indexRef.current = newIndex
    setTickerIndex(newIndex)
    const next = history[newIndex]
    setDisplayed(next)
    setCurrentGradient(next)
    vibrateStep()
  }

  function consumeAccumulatedDelta() {
    while (accumulatedDeltaRef.current >= STEP_PX) {
      accumulatedDeltaRef.current -= STEP_PX
      goTo(indexRef.current + 1)
    }
    while (accumulatedDeltaRef.current <= -STEP_PX) {
      // Stop consuming once the index has bottomed out at 0, so leftover
      // negative delta doesn't keep spinning the loop with no effect.
      if (indexRef.current <= 0) {
        accumulatedDeltaRef.current = 0
        break
      }
      accumulatedDeltaRef.current += STEP_PX
      goTo(indexRef.current - 1)
    }
  }

  // Attach wheel/touch listeners manually as non-passive so preventDefault()
  // reliably suppresses native scrolling. React's synthetic onWheel/onTouchMove
  // handlers are not guaranteed to be non-passive across versions/browsers,
  // so we bind directly to the DOM node instead.
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

      const bottomedOut = indexRef.current <= 0 && velocityRef.current < 0
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
      accumulatedDeltaRef.current += e.deltaY
      consumeAccumulatedDelta()
    }

    function handleTouchStart(e: TouchEvent) {
      cancelMomentum()
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

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      cancelMomentum()
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed !== null])

  if (!displayed) return null

  return (
    <div data-testid="feed-container" ref={containerRef} className={styles.container}>
      <GradientPage
        gradient={displayed}
        onSave={(g) => {
          likeHint.dismiss()
          saveGradient(g)
        }}
        onEdit={() => withViewTransition(enterEditMode)}
      />
      <ScrollTicker index={tickerIndex} />
      {scrollHint.visible && <Hint text="Scroll to explore palettes ↓" visible={scrollHint.visible} />}
      {!scrollHint.visible && likeHint.visible && <Hint text="Double-tap to like" visible={likeHint.visible} />}
    </div>
  )
}
