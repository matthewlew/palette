import { useEffect, useState, type RefObject } from 'react'

/**
 * The width/height of an element as it is actually laid out.
 *
 * Needed because one thing a gradient renders cannot be expressed in CSS: a
 * conic gradient squished to match an oval crop (see `squishConicStops`).
 * Every other crop adjustment is either angle-only or rides percentage lengths
 * that CSS resolves against the box for free — this one has to know the number.
 *
 * Returns 1 until the element is measured, and 1 for a zero-height box. Both
 * are the identity for every caller: a square box is one whose inscribed
 * ellipse is a circle, so nothing is squished and the pre-measurement frame
 * renders the same gradient it always did rather than a wrong one.
 */
export function useElementAspect(ref: RefObject<HTMLElement | null>): number {
  const [aspect, setAspect] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      // Quantized to 1/100. The raw ratio changes on every scroll-driven
      // subpixel reflow, and each distinct value rebuilds a ~70-stop gradient
      // string; below this the difference is far under a degree of bearing.
      setAspect(Math.round((width / height) * 100) / 100)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return aspect
}
