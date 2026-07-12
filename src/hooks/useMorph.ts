import { useEffect, useRef, useState } from 'react'
import type { Gradient } from '../store/types'
import { morphStops } from '../lib/morph'

const DURATION_MS = 300

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Returns the gradient to render for `target`. When `target` changes and `skip`
 * is false, both gradients share a stop count, and reduced-motion is off, the
 * returned gradient's stops animate (OKLCH) from the currently-rendered frame to
 * the target over DURATION_MS. Interrupting a morph restarts from the current
 * frame; mismatched stop counts or skip => instant swap.
 */
export function useMorph(target: Gradient, skip: boolean): Gradient {
  const [rendered, setRendered] = useState<Gradient>(target)
  const renderedRef = useRef(rendered)
  renderedRef.current = rendered
  const frameRef = useRef<number | null>(null)
  const prevTargetId = useRef(target.id)

  useEffect(() => {
    if (target.id === prevTargetId.current) {
      setRendered(target)
      return
    }
    prevTargetId.current = target.id

    const from = renderedRef.current
    const canMorph =
      !skip &&
      !prefersReducedMotion() &&
      from.stops.length === target.stops.length

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    if (!canMorph) {
      setRendered(target)
      return
    }

    const fromStops = from.stops
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = easeOut(t)
      setRendered({ ...target, stops: morphStops(fromStops, target.stops, eased) })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, skip])

  return rendered
}
