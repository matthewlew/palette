import type { Oklch } from './oklch'

export interface NamedColor {
  name: string
  value: Oklch
}

export interface ColorSet {
  name: string
  colors: NamedColor[]
}

export const DEFAULT_COLOR_SET: ColorSet = {
  name: 'bklyn-clay',
  colors: [
    // Earth reds
    { name: 'Clay', value: { l: 0.42, c: 0.09, h: 35 } },
    { name: 'Terracotta', value: { l: 0.52, c: 0.12, h: 40 } },
    { name: 'Brick', value: { l: 0.35, c: 0.1, h: 30 } },
    { name: 'Rust', value: { l: 0.45, c: 0.13, h: 45 } },
    { name: 'Adobe', value: { l: 0.6, c: 0.08, h: 50 } },
    { name: 'Sienna', value: { l: 0.38, c: 0.11, h: 42 } },
    // Warm neutrals
    { name: 'Sand', value: { l: 0.78, c: 0.03, h: 80 } },
    { name: 'Bone', value: { l: 0.85, c: 0.02, h: 75 } },
    { name: 'Speckled White', value: { l: 0.92, c: 0.01, h: 70 } },
    { name: 'Oat', value: { l: 0.8, c: 0.025, h: 85 } },
    { name: 'Camel', value: { l: 0.65, c: 0.05, h: 65 } },
    { name: 'Biscuit', value: { l: 0.72, c: 0.04, h: 60 } },
    // Cool neutrals
    { name: 'Ash', value: { l: 0.7, c: 0.01, h: 220 } },
    { name: 'Fog', value: { l: 0.8, c: 0.008, h: 210 } },
    { name: 'Pewter', value: { l: 0.55, c: 0.015, h: 230 } },
    { name: 'Slate', value: { l: 0.45, c: 0.02, h: 215 } },
    { name: 'Dove', value: { l: 0.75, c: 0.01, h: 205 } },
    { name: 'Concrete', value: { l: 0.6, c: 0.012, h: 225 } },
    // Greens
    { name: 'Moss', value: { l: 0.45, c: 0.06, h: 130 } },
    { name: 'Sage', value: { l: 0.65, c: 0.04, h: 120 } },
    { name: 'Fern', value: { l: 0.5, c: 0.08, h: 140 } },
    { name: 'Olive', value: { l: 0.4, c: 0.05, h: 100 } },
    { name: 'Juniper', value: { l: 0.35, c: 0.05, h: 150 } },
    { name: 'Celadon', value: { l: 0.72, c: 0.05, h: 145 } },
    // Blues
    { name: 'Indigo', value: { l: 0.35, c: 0.1, h: 265 } },
    { name: 'Denim', value: { l: 0.45, c: 0.09, h: 250 } },
    { name: 'Cobalt', value: { l: 0.5, c: 0.15, h: 255 } },
    { name: 'Steel', value: { l: 0.55, c: 0.06, h: 240 } },
    { name: 'Harbor', value: { l: 0.4, c: 0.07, h: 230 } },
    { name: 'Powder', value: { l: 0.78, c: 0.04, h: 235 } },
    // Darks
    { name: 'Charcoal', value: { l: 0.25, c: 0.01, h: 250 } },
    { name: 'Ink', value: { l: 0.18, c: 0.02, h: 260 } },
    { name: 'Espresso', value: { l: 0.28, c: 0.04, h: 40 } },
    { name: 'Onyx', value: { l: 0.15, c: 0.005, h: 0 } },
    { name: 'Iron', value: { l: 0.32, c: 0.015, h: 220 } },
    { name: 'Midnight', value: { l: 0.2, c: 0.05, h: 270 } },
  ],
}
