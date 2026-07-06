import { oklchToHex, type Oklch } from './oklch'
import { SEED_PALETTES } from './seedPalettes'
import type { GradientStop } from './gradient'

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function jitter(color: Oklch): Oklch {
  return {
    l: Math.min(1, Math.max(0, color.l + (Math.random() - 0.5) * 0.1)),
    c: Math.max(0, color.c + (Math.random() - 0.5) * 0.04),
    h: (color.h + (Math.random() - 0.5) * 20 + 360) % 360,
  }
}

export interface GeneratedGradientStops {
  seedName: string
  stops: GradientStop[]
}

export function generateGradientStops(): GeneratedGradientStops {
  const seed = pickRandom(SEED_PALETTES)
  const stopCount = 3 + Math.floor(Math.random() * 4) // 3-6

  const colors: Oklch[] = []
  for (let i = 0; i < stopCount; i++) {
    const base = seed.colors[i % seed.colors.length]
    colors.push(jitter(base))
  }

  const stops = colors.map((color, i) => ({
    hex: oklchToHex(color),
    position: Math.round((i / (stopCount - 1)) * 100),
  }))

  return { seedName: seed.name, stops }
}
