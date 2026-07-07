import { hexToOklch } from './oklch'

export type SortKey = 'lightness' | 'hue' | 'chroma'

function metricFor(hex: string, key: SortKey): number {
  const c = hexToOklch(hex)
  return key === 'lightness' ? c.l : key === 'hue' ? c.h : c.c
}

/** Stable ascending sort of any items carrying a hex color. */
export function sortByOklch<T>(items: T[], getHex: (item: T) => string, key: SortKey): T[] {
  return [...items].sort((a, b) => metricFor(getHex(a), key) - metricFor(getHex(b), key))
}

/** Average metric across a gradient's stops, used to sort the feed/drawer. */
export function gradientMetric(hexes: string[], key: SortKey): number {
  if (hexes.length === 0) return 0
  const vals = hexes.map((h) => metricFor(h, key))
  return vals.reduce((s, v) => s + v, 0) / vals.length
}
