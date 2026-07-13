export interface Oklch {
  l: number // 0-1
  c: number // chroma, typically 0-0.4
  h: number // hue degrees, 0-360
}

export interface Srgb {
  r: number // 0-255
  g: number // 0-255
  b: number // 0-255
}

function oklchToOklab(oklch: Oklch): { L: number; a: number; b: number } {
  const hRad = (oklch.h * Math.PI) / 180
  return {
    L: oklch.l,
    a: oklch.c * Math.cos(hRad),
    b: oklch.c * Math.sin(hRad),
  }
}

function oklabToOklch(oklab: { L: number; a: number; b: number }): Oklch {
  const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b)
  let h = (Math.atan2(oklab.b, oklab.a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: oklab.L, c, h }
}

function oklabToLinearSrgb(oklab: { L: number; a: number; b: number }): { r: number; g: number; b: number } {
  const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b
  const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b
  const s_ = oklab.L - 0.0894841775 * oklab.a - 1.291485548 * oklab.b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

function linearSrgbToOklab(linear: { r: number; g: number; b: number }): { L: number; a: number; b: number } {
  const l = 0.4122214708 * linear.r + 0.5363325363 * linear.g + 0.0514459929 * linear.b
  const m = 0.2119034982 * linear.r + 0.6806995451 * linear.g + 0.1073969566 * linear.b
  const s = 0.0883024619 * linear.r + 0.2817188376 * linear.g + 0.6299787005 * linear.b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

function linearToGamma(c: number): number {
  const abs = Math.abs(c)
  if (abs <= 0.0031308) return 12.92 * c
  return (c < 0 ? -1 : 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055)
}

function gammaToLinear(c: number): number {
  const abs = Math.abs(c)
  if (abs <= 0.04045) return c / 12.92
  return (c < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.4)
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, v))
}

export function oklchToSrgb(oklch: Oklch): Srgb {
  const oklab = oklchToOklab(oklch)
  const linear = oklabToLinearSrgb(oklab)
  return {
    r: clamp255(linearToGamma(linear.r) * 255),
    g: clamp255(linearToGamma(linear.g) * 255),
    b: clamp255(linearToGamma(linear.b) * 255),
  }
}

export function srgbToOklch(srgb: Srgb): Oklch {
  const linear = {
    r: gammaToLinear(srgb.r / 255),
    g: gammaToLinear(srgb.g / 255),
    b: gammaToLinear(srgb.b / 255),
  }
  const oklab = linearSrgbToOklab(linear)
  return oklabToOklch(oklab)
}

export function oklchToHex(oklch: Oklch): string {
  const { r, g, b } = oklchToSrgb(oklch)
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToSrgb(hex: string): Srgb {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

export function hexToOklch(hex: string): Oklch {
  return srgbToOklch(hexToSrgb(hex))
}

export function isLightColor(hex: string): boolean {
  return hexToOklch(hex).l > 0.6
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpHue(a: number, b: number, t: number): number {
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return (a + diff * t + 360) % 360
}

export function blendOklchHex(hexA: string, hexB: string, t = 0.5): string {
  const a = hexToOklch(hexA)
  const b = hexToOklch(hexB)
  return oklchToHex({
    l: lerp(a.l, b.l, t),
    c: lerp(a.c, b.c, t),
    h: lerpHue(a.h, b.h, t),
  })
}
