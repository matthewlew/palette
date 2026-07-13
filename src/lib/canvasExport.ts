import type { Gradient } from '../store/types'
import {
  repeatedStops,
  hardenStops,
  positionedStops,
  sampleStops,
} from './gradient'

/**
 * Renders the base gradient to a canvas context at specified width and height.
 * Handles Linear, Radial, Angular, Square, Mirror, and Repeat gradient types,
 * along with reverse, repeat, and hard filters.
 */
export function renderGradientToCanvas(
  canvas: HTMLCanvasElement,
  gradient: Gradient,
  width: number,
  height: number
) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const {
    type,
    reversed = false,
    repeatEnabled = false,
    hardStops = false,
  } = gradient

  let stops = [...gradient.stops].sort((a, b) => a.position - b.position)

  // 1. Apply reversed stops
  if (reversed) {
    const reversedHexes = [...stops].reverse().map((s) => s.hex)
    stops = stops.map((s, i) => ({ hex: reversedHexes[i], position: s.position }))
  }

  // 2. Apply repeat & hard filters (doesn't apply to square, mirror, repeat)
  if (type !== 'square' && type !== 'mirror' && type !== 'repeat') {
    if (repeatEnabled) stops = repeatedStops(stops)
    if (hardStops) stops = hardenStops(stops)
  }

  // Clear background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  switch (type) {
    case 'linear': {
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      stops.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'radial': {
      const cx = width / 2
      const cy = height / 2
      const r = Math.hypot(cx, cy)
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      stops.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'angular': {
      const cx = width / 2
      const cy = height / 2
      const scaleFactor = stops.length / (stops.length + 1)
      const compressed = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position * scaleFactor) }))
      const withSeam = [...compressed, { hex: stops[0].hex, position: 100 }]

      if (ctx.createConicGradient) {
        const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy)
        withSeam.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      } else {
        // Fallback: draw fine angular wedges
        const numWedges = 360
        for (let i = 0; i < numWedges; i++) {
          const angleStart = (i / numWedges) * 2 * Math.PI - Math.PI / 2
          const angleEnd = ((i + 1) / numWedges) * 2 * Math.PI - Math.PI / 2
          const t = i / numWedges
          const color = sampleStops(withSeam, t)

          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, Math.hypot(cx, cy), angleStart, angleEnd)
          ctx.closePath()
          ctx.fillStyle = color
          ctx.fill()
        }
      }
      break
    }
    case 'square': {
      const hexes = stops.map((s) => s.hex)
      // Flat background fill with outermost color
      ctx.fillStyle = hexes[0]
      ctx.fillRect(0, 0, width, height)

      // Nested blur layers. Default blur is 24px when width is 400px.
      const scaleFactor = width / 400
      const blurRadius = 24 * scaleFactor

      for (let i = 1; i < stops.length; i++) {
        const stop = stops[i]
        const scalePercent = 100 - (stop.position / 100) * 80
        const sizeX = (scalePercent / 100) * width
        const sizeY = (scalePercent / 100) * height
        const rx = (width - sizeX) / 2
        const ry = (height - sizeY) / 2

        ctx.save()
        if (blurRadius > 0) {
          ctx.filter = `blur(${blurRadius}px)`
        }
        ctx.fillStyle = hexes[i]
        ctx.fillRect(rx, ry, sizeX, sizeY)
        ctx.restore()
      }
      break
    }
    case 'mirror': {
      const forward = stops.map((s) => s.hex)
      const mirrored = [...forward, ...forward.slice(0, -1).reverse()]
      const ordered = positionedStops(mirrored)
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      ordered.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'repeat': {
      const hexes = stops.map((s) => s.hex)
      const sequence = [...hexes, ...hexes]
      const ordered = positionedStops(sequence)
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      ordered.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      break
    }
  }
}

/**
 * Renders a gradient to an offscreen canvas and returns a PNG data URL. Used to
 * embed a faithful raster of gradient types that SVG gradients can't express
 * (angular/square/fan) when copying to the clipboard for Figma. Throws where
 * canvas is unavailable (e.g. jsdom) — callers guard with try/catch.
 */
export function gradientToPngDataUrl(gradient: Gradient, size = 1024): string {
  const canvas = document.createElement('canvas')
  renderGradientToCanvas(canvas, gradient, size, size)
  return canvas.toDataURL('image/png')
}

/**
 * Triggers the device download/share flow for a gradient.
 * On modern mobile/iOS Safari, triggers navigator.share() with the image file.
 * Falls back to anchor tag download on desktop browsers.
 */
export async function downloadGradientAsPng(gradient: Gradient, width: number, height: number) {
  const canvas = document.createElement('canvas')
  renderGradientToCanvas(canvas, gradient, width, height)

  const filename = `${(gradient.name ?? 'gradient').toLowerCase().replace(/\s+/g, '-')}-${width}x${height}.png`
  await shareOrDownloadCanvas(canvas, filename, gradient.name ?? 'Gradient')
}

/**
 * Shares (mobile share sheet) or downloads (desktop anchor) a rendered canvas
 * as PNG. Shared by the plain export and the vignette export paths.
 */
export async function shareOrDownloadCanvas(canvas: HTMLCanvasElement, filename: string, title: string) {
  // Use Web Share API if available (for iOS share sheet / mobile save path)
  if (navigator.canShare && navigator.share) {
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (blob) {
        const file = new File([blob], filename, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title,
          })
          return
        }
      }
    } catch (e) {
      console.warn('Web Share failed, falling back to direct download', e)
    }
  }

  // Fallback: regular desktop anchor download
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
