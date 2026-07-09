import { hexToOklch } from './oklch'
import type { GradientStop } from './gradient'

/** Below this OKLCH chroma a color is effectively neutral and its hue is
 * numerically arbitrary — neutrals never match a hue chip. */
export const CHROMA_FLOOR = 0.06

export interface HueFamily {
  key: string
  label: string
  /** Center hue in OKLCH degrees; a family spans center ± 22.5°. */
  center: number
  /** Representative swatch for the chip UI. */
  swatchHex: string
}

export const HUE_FAMILIES: HueFamily[] = [
  { key: 'red', label: 'Red', center: 25, swatchHex: '#c0392b' },
  { key: 'orange', label: 'Orange', center: 70, swatchHex: '#d98836' },
  { key: 'yellow', label: 'Yellow', center: 100, swatchHex: '#d4b13f' },
  { key: 'green', label: 'Green', center: 145, swatchHex: '#4a8a5c' },
  { key: 'cyan', label: 'Cyan', center: 195, swatchHex: '#3d97a3' },
  { key: 'blue', label: 'Blue', center: 255, swatchHex: '#3f6bb0' },
  { key: 'purple', label: 'Purple', center: 305, swatchHex: '#7d55a8' },
  { key: 'pink', label: 'Pink', center: 350, swatchHex: '#bd5a8b' },
]

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** The hue-family key a gradient belongs to, judged by its single most
 * chromatic stop (perceptual "dominant color" — the first stop is often a
 * sliver in radial/angular types). Returns null when every stop sits below
 * the chroma floor: all-neutral gradients match no hue chip. */
export function gradientHueFamily(stops: GradientStop[]): string | null {
  let best: { c: number; h: number } | null = null
  for (const stop of stops) {
    const { c, h } = hexToOklch(stop.hex)
    if (c >= CHROMA_FLOOR && (best === null || c > best.c)) {
      best = { c, h }
    }
  }
  if (!best) return null
  let closest = HUE_FAMILIES[0]
  for (const family of HUE_FAMILIES) {
    if (hueDistance(best.h, family.center) < hueDistance(best.h, closest.center)) {
      closest = family
    }
  }
  return closest.key
}
