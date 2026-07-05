import type { Oklch } from './oklch'

export interface SeedPalette {
  name: string
  colors: Oklch[]
}

export const SEED_PALETTES: SeedPalette[] = [
  {
    name: 'bklyn-clay',
    colors: [
      { l: 0.35, c: 0.06, h: 40 }, // clay red-brown
      { l: 0.55, c: 0.08, h: 60 }, // terracotta
      { l: 0.75, c: 0.03, h: 90 }, // sand
      { l: 0.45, c: 0.05, h: 200 }, // slate teal
      { l: 0.25, c: 0.02, h: 250 }, // charcoal
    ],
  },
  {
    name: 'modern-brand-cool',
    colors: [
      { l: 0.55, c: 0.18, h: 250 }, // brand blue
      { l: 0.65, c: 0.14, h: 200 }, // cyan accent
      { l: 0.3, c: 0.05, h: 260 }, // deep navy
      { l: 0.85, c: 0.02, h: 220 }, // pale neutral
    ],
  },
  {
    name: 'modern-brand-warm',
    colors: [
      { l: 0.6, c: 0.2, h: 30 }, // coral
      { l: 0.7, c: 0.15, h: 80 }, // amber
      { l: 0.4, c: 0.1, h: 20 }, // rust
      { l: 0.88, c: 0.03, h: 60 }, // cream
    ],
  },
]
