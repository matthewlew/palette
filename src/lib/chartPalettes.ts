import { hexToSrgb } from './oklch'
import { contrastRatio } from './titleColor'

/**
 * Colorblind-safe color schemes for data visualization — a system distinct
 * from the app's gradients, with different requirements: chart colors must
 * stay distinguishable for the ~8% of men with a color-vision deficiency
 * (deuteranopia, protanopia, tritanopia) and survive grayscale export.
 *
 * These are the peer-reviewed standards, not hand-picked hues:
 * - Qualitative → Okabe & Ito, "Color Universal Design" (2008). Eight hues
 *   that differ in BOTH luminance and hue, so no two collapse together under
 *   any common CVD.
 * - Sequential → Viridis (Smith & van der Walt). Perceptually uniform and
 *   monotonic in lightness — equal data steps read as equal color steps.
 * - Diverging → blue↔orange (ColorBrewer, Cynthia Brewer). Blue vs. orange
 *   is the safest polarity contrast; a neutral gray midpoint keeps zero from
 *   reading as a hue.
 */

export type ChartScheme = 'qualitative' | 'sequential' | 'diverging'

export interface QualitativeSwatch {
  hex: string
  name: string
}

/** Okabe–Ito, ordered for maximum adjacent contrast (strong hue + luminance
 * jumps between neighbors). Assign to series in THIS order and never cycle:
 * past eight categories, fold the rest into "Other" or use small multiples —
 * a 9th generated hue is where CVD-safety breaks down. */
export const QUALITATIVE: readonly QualitativeSwatch[] = [
  { hex: '#0072B2', name: 'Blue' },
  { hex: '#E69F00', name: 'Orange' },
  { hex: '#009E73', name: 'Green' },
  { hex: '#CC79A7', name: 'Purple' },
  { hex: '#56B4E9', name: 'Sky' },
  { hex: '#D55E00', name: 'Vermillion' },
  { hex: '#F0E442', name: 'Yellow' },
  { hex: '#999999', name: 'Grey' },
]

/** Viridis control points, lightest→darkest is reversed here to run low→high
 * magnitude (dark = low, bright = high) the way it ships in matplotlib. */
export const SEQUENTIAL: readonly string[] = [
  '#440154',
  '#414487',
  '#2A788E',
  '#22A884',
  '#7AD151',
  '#FDE725',
]

/** Blue↔orange with a neutral gray midpoint. Index 3 is the zero point; the
 * two arms are balanced in lightness so neither side dominates. */
export const DIVERGING: readonly string[] = [
  '#2166AC',
  '#67A9CF',
  '#D1E5F0',
  '#F0EFEC',
  '#FEE0B6',
  '#F1A340',
  '#B35806',
]

/** The neutral midpoint of {@link DIVERGING} — the color for a value of zero. */
export const DIVERGING_MIDPOINT = DIVERGING[3]

/** How many distinct categories the qualitative scheme can encode before
 * colors must fold into "Other". */
export const MAX_QUALITATIVE = QUALITATIVE.length

/** The first `count` qualitative colors, in fixed order. Colors follow the
 * entity, not its rank, so a stable slice keeps a series the same color when
 * the data is filtered or reordered. Counts above {@link MAX_QUALITATIVE} are
 * clamped — the caller is expected to bucket the overflow into "Other". */
export function qualitativeColors(count: number): string[] {
  const n = Math.max(0, Math.min(count, MAX_QUALITATIVE))
  return QUALITATIVE.slice(0, n).map((s) => s.hex)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Linear sRGB interpolation between two hex colors. */
function mixHex(from: string, to: string, t: number): string {
  const a = hexToSrgb(from)
  const b = hexToSrgb(to)
  const channel = (x: number, y: number) => Math.round(lerp(x, y, t)).toString(16).padStart(2, '0')
  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`
}

/** Samples a ramp (ordered stops) at position `t` in [0, 1], interpolating
 * between the two nearest stops. `t` is clamped to the ramp's ends. */
function sampleRamp(ramp: readonly string[], t: number): string {
  if (ramp.length === 1) return ramp[0]
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (ramp.length - 1)
  const lower = Math.floor(scaled)
  if (lower >= ramp.length - 1) return ramp[ramp.length - 1]
  const frac = scaled - lower
  // Landing exactly on a stop returns it verbatim (preserving its canonical
  // casing) rather than a re-serialized mix of it with itself.
  if (frac === 0) return ramp[lower]
  return mixHex(ramp[lower], ramp[lower + 1], frac)
}

/** A single sequential color for a normalized magnitude `t` in [0, 1]
 * (0 = lowest, 1 = highest). */
export function sequentialColorAt(t: number): string {
  return sampleRamp(SEQUENTIAL, t)
}

/** `count` evenly spaced sequential colors, low→high. With `count` ≤ the
 * number of Viridis control points the exact points are used; larger counts
 * interpolate between them. */
export function sequentialColors(count: number): string[] {
  if (count <= 0) return []
  if (count === 1) return [SEQUENTIAL[Math.floor(SEQUENTIAL.length / 2)]]
  return Array.from({ length: count }, (_, i) => sequentialColorAt(i / (count - 1)))
}

/** A diverging color for `value` on a symmetric domain [-magnitude, +magnitude].
 * Negative → blue, zero → neutral gray, positive → orange. `magnitude` should
 * be the larger absolute extent of the data so the arms stay balanced. */
export function divergingColorAt(value: number, magnitude: number): string {
  if (magnitude <= 0) return DIVERGING_MIDPOINT
  const t = 0.5 + value / (2 * magnitude)
  return sampleRamp(DIVERGING, t)
}

/** `count` evenly spaced diverging colors across the full blue→orange range. */
export function divergingColors(count: number): string[] {
  if (count <= 0) return []
  if (count === 1) return [DIVERGING_MIDPOINT]
  return Array.from({ length: count }, (_, i) => sampleRamp(DIVERGING, i / (count - 1)))
}

/** Black or white — whichever has more WCAG contrast — for labels drawn on
 * top of a swatch. */
export function readableTextOn(hex: string): '#000000' | '#ffffff' {
  return contrastRatio('#ffffff', hex) >= contrastRatio('#000000', hex) ? '#ffffff' : '#000000'
}

/** Structured index of all three schemes, for building a palette preview or
 * a scheme picker without reaching for each export individually. */
export const CHART_PALETTES: Record<
  ChartScheme,
  { name: string; description: string; colors: readonly string[] }
> = {
  qualitative: {
    name: 'Qualitative',
    description: 'Okabe–Ito · distinct categories',
    colors: QUALITATIVE.map((s) => s.hex),
  },
  sequential: {
    name: 'Sequential',
    description: 'Viridis · low → high magnitude',
    colors: SEQUENTIAL,
  },
  diverging: {
    name: 'Diverging',
    description: 'Blue ↔ orange · below / above baseline',
    colors: DIVERGING,
  },
}
