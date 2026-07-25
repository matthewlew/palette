import { useEffect, useRef, useState } from 'react'
import type { GradientStop } from '../lib/gradient'
import { blendOklchHex } from '../lib/oklch'

const DURATION_MS = 220

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A value signature of the render-relevant fields (position + color). Callers
 * pass a fresh array every render, so we key the effect on content rather than
 * identity — otherwise it re-runs every render, restarting the animation each
 * frame (it never progresses) and, when nothing changed, looping renders. */
function stopsKey(stops: GradientStop[]): string {
  return stops.map((s) => `${s.position}:${s.hex}`).join('|')
}

/**
 * Returns stops to render for `stops`, crossfading each slot's color in OKLCH
 * over DURATION_MS whenever the colors change but the slot layout (count +
 * positions) doesn't — which is exactly what a canvas-handle swap does. So the
 * gradient's color blocks visibly trade places instead of hard-jumping.
 * Layout changes (add/remove/position drags) apply instantly: positions
 * already track the pointer live. Interrupting an animation restarts from the
 * current mid-blend frame, never snapping back.
 */
export function useAnimatedStops(stops: GradientStop[]): GradientStop[] {
  const [rendered, setRendered] = useState(stops)
  const renderedRef = useRef(rendered)
  renderedRef.current = rendered
  const frameRef = useRef<number | null>(null)
  const key = stopsKey(stops)

  useEffect(() => {
    const from = renderedRef.current
    const sameLayout =
      from.length === stops.length && from.every((s, i) => s.position === stops[i].position)
    const colorsChanged =
      !sameLayout || from.some((s, i) => s.hex !== stops[i].hex)
    if (!colorsChanged) {
      // rendered already matches stops in position + color; nothing to do.
      return
    }

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    if (!sameLayout || prefersReducedMotion()) {
      setRendered(stops)
      return
    }

    const fromStops = from
    // Seed `start` from rAF's own timestamp on the first frame rather than
    // performance.now() — mixing the two clocks stalls the animation whenever
    // they disagree.
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = easeOut(t)
      setRendered(stops.map((s, i) => ({ ...s, hex: blendOklchHex(fromStops[i].hex, s.hex, eased) })))
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // Keyed on stop content, not array identity — see stopsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return rendered
}
