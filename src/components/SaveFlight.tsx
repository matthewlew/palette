import { useEffect, useRef, useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import {
  announceSaveFlightArrival,
  onSaveFlight,
  prefersReducedMotion,
  type SaveFlight,
} from '../lib/saveFlight'
import { TurrellSquare } from './TurrellSquare'
import styles from './SaveFlight.module.css'

/** Card proportions, matching a Gallery tile — the thing it is on its way to
 * becoming. Squarer than the Save pill it leaves from on purpose: the pop is
 * a shape change as well as a move, so it reads as the artwork coming out of
 * the button rather than the button itself sliding. */
const TILE_W = 84
const TILE_H = 106
const DURATION_MS = 660

/** Where a flight goes when the tab bar has no thumbnail stack yet (the very
 * first save) — the Gallery tab itself. */
const TARGET_SELECTORS = ['[data-testid="tab-gallery-thumb"]', '[data-testid="tab-gallery"]']

function findTarget(): DOMRect | null {
  for (const selector of TARGET_SELECTORS) {
    const el = document.querySelector(selector)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return rect
  }
  return null
}

function FlightTile({ flight, onDone }: { flight: SaveFlight; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { gradient, from } = flight

  useEffect(() => {
    const el = ref.current
    // Web Animations is the right tool and also the reason for this guard:
    // jsdom has no `animate`, and a CSS-keyframe version would need the target
    // geometry baked into a stylesheet, which is only knowable at runtime.
    if (!el || typeof el.animate !== 'function') {
      onDone()
      return
    }
    const target = findTarget()
    if (!target) {
      onDone()
      return
    }

    const startX = from.left + from.width / 2
    const startY = from.top + from.height / 2
    const dx = target.left + target.width / 2 - startX
    const dy = target.top + target.height / 2 - startY
    // Land at the thumbnail's own size, so the tile doesn't visibly snap when
    // it is swapped for the real thumb underneath it.
    const endScale = Math.max(target.width / TILE_W, target.height / TILE_H)

    const animation = el.animate(
      [
        // Out of the button: starts small and faint, at the button's centre.
        { transform: 'translate3d(0, 0, 0) scale(0.35)', opacity: 0.35, offset: 0 },
        // The jump. Full size, lifted clear of the chrome, held for a beat so
        // the eye can register WHAT was saved before it shrinks away.
        {
          transform: 'translate3d(0, -46px, 0) scale(1.04) rotate(-3deg)',
          opacity: 1,
          offset: 0.3,
          easing: 'cubic-bezier(0.2, 1.2, 0.4, 1)',
        },
        { transform: 'translate3d(0, -40px, 0) scale(1) rotate(-2deg)', opacity: 1, offset: 0.42 },
        // Into the stack.
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${endScale}) rotate(4deg)`,
          opacity: 1,
          offset: 1,
          easing: 'cubic-bezier(0.6, 0, 0.85, 0.6)',
        },
      ],
      { duration: DURATION_MS, fill: 'forwards' }
    )

    let done = false
    function finish() {
      if (done) return
      done = true
      announceSaveFlightArrival()
      onDone()
    }
    animation.addEventListener('finish', finish)
    // A backstop: an animation on a backgrounded tab may never fire `finish`,
    // and a tile stuck at full opacity over the UI is worse than a missed
    // flourish.
    const timer = window.setTimeout(finish, DURATION_MS + 400)
    return () => {
      window.clearTimeout(timer)
      animation.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      data-testid="save-flight-tile"
      aria-hidden="true"
      className={styles.tile}
      style={{
        left: from.left + from.width / 2 - TILE_W / 2,
        top: from.top + from.height / 2 - TILE_H / 2,
        width: TILE_W,
        height: TILE_H,
        backgroundImage:
          gradient.type === 'square'
            ? undefined
            : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                repeat: gradient.repeatEnabled,
                hard: gradient.hardStops,
                smooth: gradient.smoothEnabled,
                prism: gradient.prismEnabled,
                fanAnchor: gradient.fanAnchor,
                angle: gradient.angle,
              }),
      }}
    >
      {gradient.type === 'square' && (
        <span className={styles.squareInner}>
          <TurrellSquare
            stops={gradient.stops}
            reversed={gradient.reversed}
            repeatEnabled={gradient.repeatEnabled}
            blurPx={3}
            angle={gradient.angle}
          />
        </span>
      )}
    </div>
  )
}

/**
 * Draws saves as they travel to the Gallery tab. Mounted once at the app root
 * rather than inside the surface that fired it: the tile has to cross out of
 * the edit sheet's and the feed's stacking contexts to reach the tab bar, and
 * anything rendered inside `.preview` is captured by that element's view
 * transition and stretched with it.
 */
export function SaveFlightLayer() {
  const [flights, setFlights] = useState<SaveFlight[]>([])

  useEffect(
    () =>
      onSaveFlight((flight) => {
        // Reduced motion still gets the arrival bump (announced by the tab
        // bar's own subscriber) — it just doesn't get 660ms of travel.
        if (prefersReducedMotion()) {
          announceSaveFlightArrival()
          return
        }
        setFlights((prev) => [...prev, flight])
      }),
    []
  )

  return (
    <>
      {flights.map((flight) => (
        <FlightTile
          key={flight.id}
          flight={flight}
          onDone={() => setFlights((prev) => prev.filter((f) => f.id !== flight.id))}
        />
      ))}
    </>
  )
}
