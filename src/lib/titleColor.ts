import { gradientColorAt } from './gradient'
import { hexToSrgb, hexToOklch, oklchToHex } from './oklch'
import { lcOn, inkOn, Lc } from 'lew-design-system/ink'
import type { Gradient } from '../store/types'

/** APCA floor for chrome that sits on a gradient. The title is 15px/600 and the
 * chrome labels 13px/600, which APCA puts at the "minimum body text" tier.
 *
 * This replaced a WCAG 4.5:1 check. WCAG's ratio is symmetric and ignores
 * polarity, so it scores light-on-dark and dark-on-light the same and is
 * unreliable in the mid-tones — which is exactly where gradients live. */
const MIN_INK_LC = Lc.BODY_LARGE

/** How far to walk lightness looking for a legible version of a palette color,
 * and in what increment. One full pass of the OKLCH lightness axis. */
const NUDGE_STEP = 0.02
const NUDGE_MAX = 1

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToSrgb(hex)
  const linear = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio between two hex colors, 1 (none) to 21 (black/white).
 *
 * Retained as a general utility and for ordering colors by luminance. Ink
 * decisions no longer use it — see MIN_INK_LC. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** The most legible of a gradient's own stops against `backdrop`, plus its Lc. */
function bestStop(stops: readonly { hex: string }[], backdrop: string) {
  let hex: string | null = null
  let lc = -1
  for (const stop of stops) {
    const candidate = lcOn(stop.hex, backdrop)
    if (candidate > lc) {
      lc = candidate
      hex = stop.hex
    }
  }
  return { hex, lc }
}

/** How far the round-tripped hue may drift before we call a color out of gamut. */
const HUE_TOLERANCE = 2

/** Render an OKLCH color to hex without letting it shift hue.
 *
 * oklchToHex clamps each sRGB channel independently, so a color outside the
 * gamut comes back a different hue — and that is exactly what raising the
 * lightness of a saturated stop produces (a vivid pink pushed light clipped
 * ~29° toward magenta). Backing the chroma off until the round-trip preserves
 * the hue keeps the nudged ink reading as the same color, which is the whole
 * reason for nudging instead of falling back to white. */
function inGamutHex(l: number, c: number, h: number): string {
  let chroma = c
  for (let i = 0; i < 24; i++) {
    const hex = oklchToHex({ l, c: chroma, h })
    const back = hexToOklch(hex)
    // Hue is meaningless once a color is essentially neutral, so accept it.
    if (back.c < 0.01) return hex
    const drift = Math.abs((((back.h - h) % 360) + 540) % 360 - 180)
    if (drift < HUE_TOLERANCE) return hex
    chroma *= 0.85
  }
  return oklchToHex({ l, c: 0, h })
}

/** Hold a color's hue, walk its lightness both directions until it clears
 * `min` against `backdrop`. Returns null if nothing on that axis does.
 *
 * This is what keeps the palette's own color in play under APCA's stricter
 * floor. Without it the exact-stop hit rate is only ~6% and almost every label
 * degrades to plain white or black — the on-brand ink would effectively
 * disappear from the product. */
function nudgeToLegible(hex: string, backdrop: string, min: number): string | null {
  const { l, c, h } = hexToOklch(hex)
  for (let delta = 0; delta <= NUDGE_MAX; delta += NUDGE_STEP) {
    for (const lightness of [l + delta, l - delta]) {
      if (lightness < 0 || lightness > 1) continue
      const candidate = inGamutHex(lightness, c, h)
      if (lcOn(candidate, backdrop) >= min) return candidate
    }
  }
  return null
}

/** Text color for the palette title anchored at normalized coordinates
 * (x, y in 0-1) over the gradient. Prefers one of the gradient's own stop
 * colors — the highest-contrast one against the backdrop sampled at that
 * spot — so the title reads as a natural extension of the palette. If no stop
 * clears APCA outright, the best one is nudged along its OKLCH lightness axis
 * (hue and chroma held, so it still reads as that color) before falling back
 * to whichever of white/black scores higher. Because the backdrop is sampled
 * where the title actually sits, a linear gradient that is light at the top
 * and dark at the bottom gets a different answer than one flipped the other
 * way. */
export function titleColorAt(gradient: Gradient, x: number, y: number): string {
  const backdrop = gradientColorAt(gradient.type, gradient.stops, x, y, gradient.reversed, {
    repeat: gradient.repeatEnabled,
    repeatCount: gradient.repeatCount,
    hard: gradient.hardStops,
    fanAnchor: gradient.fanAnchor,
  })

  const best = bestStop(gradient.stops, backdrop)
  if (best.hex && best.lc >= MIN_INK_LC) return best.hex

  if (best.hex) {
    const nudged = nudgeToLegible(best.hex, backdrop, MIN_INK_LC)
    if (nudged) return nudged
  }

  return inkOn(backdrop)
}

/** Ink for a gradient's label rendered on a solid surface (the Gallery tile
 * captions sit on the dark app surface, not on the gradient). Echoes the
 * palette by starting from its most vivid stop; if that stop is too low in
 * contrast against the surface, it's lightened in OKLCH — hue and chroma held
 * so it still reads as that color — until it clears APCA. White/black is
 * only the last-resort fallback (e.g. a fully desaturated palette). */
export function paletteInkOn(gradient: Gradient, surfaceHex: string): string {
  const vivid = gradient.stops.reduce((a, b) =>
    hexToOklch(b.hex).c > hexToOklch(a.hex).c ? b : a
  ).hex
  if (lcOn(vivid, surfaceHex) >= MIN_INK_LC) return vivid

  const nudged = nudgeToLegible(vivid, surfaceHex, MIN_INK_LC)
  if (nudged) return nudged

  return inkOn(surfaceHex)
}
