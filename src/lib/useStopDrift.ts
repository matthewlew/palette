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
  // Latest gradient, read fresh inside the rAF loop below instead of closed
  // over at effect-start. Keeping `gradient` out of the effect's dependency
  // array means a mid-play edit (new shape, new stops, a toggled filter) no
  // longer tears the effect down and rebuilds it — which used to matter: the
  // old effect's cleanup ran BEFORE the new one captured its "restore on
  // pause" snapshot, so a shape change mid-play clobbered that snapshot with
  // whatever was on screen before play started, and pausing silently
  // reverted to it instead of the shape you'd switched to.
  const gradientRef = useRef(gradient)
  gradientRef.current = gradient

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches
    // Not every geometry is built from stop positions — angular spreads by
    // index and square paints its own blocks. See stopDrift.isDriftableType.
    // Checked once here (not just per-frame below) so a gradient that's
    // already non-driftable when play starts never schedules a frame loop at
    // all — the Play control is disabled for it in practice, but this keeps
    // the hook correct standalone.
    const paintsOwnBackground = !isDriftableType(gradient.type)

    if (!enabled || reduced || paintsOwnBackground) {
      lastRef.current = null
      // Observable state for tests and for debugging in the browser.
      el.dataset.drift = !enabled ? 'off'
        : reduced ? 'reduced-motion'
        : `unsupported-type:${gradient.type}`
      // Touch nothing. React owns background-image when we are not animating,
      // and clearing it here would wipe the static gradient — React's virtual
      // DOM still believes the property is set, so it never re-applies it.
      return
    }

    // Snapshot React's value once, at play-start, so pausing restores exactly
    // what was on screen when play began — not a value re-derived from the
    // DOM on every gradient change (see the gradientRef comment above).
    const staticBackground = el.style.backgroundImage
    el.dataset.drift = 'on'
    // Tracks the last dataset.drift write so a per-frame type check (a
    // shape can go driftable -> non-driftable mid-play, e.g. switching to
    // Turrell) doesn't also mean a per-frame DOM write.
    let wasOwnBackground = false

    let frame = 0
    const draw = (now: number) => {
      const g = gradientRef.current
      // Not every geometry is built from stop positions — angular spreads by
      // index and square paints its own blocks. See stopDrift.isDriftableType.
      const paintsOwnBackground = !isDriftableType(g.type)
      if (paintsOwnBackground !== wasOwnBackground) {
        wasOwnBackground = paintsOwnBackground
        el.dataset.drift = paintsOwnBackground ? `unsupported-type:${g.type}` : 'on'
      }
      if (paintsOwnBackground) {
        lastRef.current = null
        frame = requestAnimationFrame(draw)
        return
      }
      // Accumulate per-frame deltas rather than measuring against a fixed
      // start. Browsers suspend rAF on a hidden tab, so an absolute clock makes
      // the gradient leap forward by however long the tab was backgrounded —
      // the one moment the motion stops being subtle. Clamping the delta also
      // absorbs a long paint stall for free.
      const previous = lastRef.current
      lastRef.current = now
      if (previous !== null) elapsedRef.current += Math.min(now - previous, 100)
      const stops = driftStops(g.stops, elapsedRef.current)
      const css = buildCroppedGradientCss(g.type, stops, g.reversed ?? false, {
        repeat: g.repeatEnabled,
        hard: g.hardStops,
        // Follow the gradient's actual mode, same as the static render path
        // (GradientPage) — forcing smooth here used to make Hard and Prism
        // silently render as Smooth for the whole duration of playback.
        smooth: g.smoothEnabled,
        prism: g.prismEnabled,
        fanAnchor: g.fanAnchor,
        angle: g.angle,
      }, g.crop)
      if (css) el.style.backgroundImage = css
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      el.style.backgroundImage = staticBackground
    }
  }, [enabled])

  return ref
}
