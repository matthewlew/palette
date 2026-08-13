import { useEffect, useRef } from 'react'
import { buildCroppedGradientCss } from './gradientCrop'
import { driftStops, isDriftableType } from './stopDrift'
import type { Gradient } from '../store/types'

/**
 * Animate a gradient's stops by writing `background-image` straight to the
 * element on each frame.
 *
 * Deliberately NOT React state. Re-rendering the page every frame would
 * re-run `titleColorAt` for the title and all three chrome anchors 60 times a
 * second — the sampled ink would flicker as it crossed a threshold, and the
 * whole tree would reconcile for what is one CSS property. The ref write skips
 * all of it.
 *
 * Returns the ref to attach to the element painting the gradient.
 */
export function useStopDrift(gradient: Gradient, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  // Accumulated animation time, held in a ref so a gradient change mid-drift
  // continues from where it was rather than snapping home.
  const elapsedRef = useRef(0)
  const lastRef = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Not every geometry is built from stop positions — angular spreads by
    // index and square paints its own blocks. See stopDrift.isDriftableType.
    const paintsOwnBackground = !isDriftableType(gradient.type)

    const reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches

    // Observable state for tests and for debugging in the browser: the reason
    // the animation is (or is not) running, on the element itself.
    el.dataset.drift = !enabled ? 'off'
      : reduced ? 'reduced-motion'
      : paintsOwnBackground ? `unsupported-type:${gradient.type}`
      : 'on'

    if (!enabled || reduced || paintsOwnBackground) {
      lastRef.current = null
      // Touch nothing. React owns background-image when we are not animating,
      // and clearing it here would wipe the static gradient — React's virtual
      // DOM still believes the property is set, so it never re-applies it.
      return
    }

    // Snapshot React's value so stopping restores exactly what it had set,
    // rather than us rebuilding the same string from a second code path.
    const staticBackground = el.style.backgroundImage

    let frame = 0
    const draw = (now: number) => {
      // Accumulate per-frame deltas rather than measuring against a fixed
      // start. Browsers suspend rAF on a hidden tab, so an absolute clock makes
      // the gradient leap forward by however long the tab was backgrounded —
      // the one moment the motion stops being subtle. Clamping the delta also
      // absorbs a long paint stall for free.
      const previous = lastRef.current
      lastRef.current = now
      if (previous !== null) elapsedRef.current += Math.min(now - previous, 100)
      const stops = driftStops(gradient.stops, elapsedRef.current)
      const css = buildCroppedGradientCss(gradient.type, stops, gradient.reversed ?? false, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
        // Smooth densifies the ramp with Oklab-eased interior stops. Without it
        // the drifting stops visibly band as they slide past each other.
        smooth: true,
        fanAnchor: gradient.fanAnchor,
        angle: gradient.angle,
      }, gradient.crop)
      if (css) el.style.backgroundImage = css
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      el.style.backgroundImage = staticBackground
    }
  }, [enabled, gradient])

  return ref
}
