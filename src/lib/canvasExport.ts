import type { Gradient } from '../store/types'
import {
  repeatedStops,
  hardenStops,
  positionedStops,
  sampleStops,
  getFanConfig,
  FAN_ANCHOR_CONFIG,
  getRadialConfig,
  smoothStops,
} from './gradient'

function getLinearGradientCoords(angle: number = 0, width: number, height: number) {
  const step = (Math.round((180 + angle) / 45) * 45) % 360
  switch (step) {
    case 0: return { x0: 0, y0: height, x1: 0, y1: 0 } // to top
    case 45: return { x0: 0, y0: height, x1: width, y1: 0 } // to top right
    case 90: return { x0: 0, y0: 0, x1: width, y1: 0 } // to right
    case 135: return { x0: 0, y0: 0, x1: width, y1: height } // to bottom right
    case 180: return { x0: 0, y0: 0, x1: 0, y1: height } // to bottom
    case 225: return { x0: width, y0: 0, x1: 0, y1: height } // to bottom left
    case 270: return { x0: width, y0: 0, x1: 0, y1: 0 } // to left
    case 315: return { x0: width, y0: height, x1: 0, y1: 0 } // to top left
    default: return { x0: 0, y0: 0, x1: 0, y1: height } // fallback to bottom
  }
}

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
    smoothEnabled = false,
    angle,
    fanAnchor,
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
    if (smoothEnabled && !hardStops) stops = smoothStops(stops)
  }

  // Clear background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  switch (type) {
    case 'linear': {
      const coords = getLinearGradientCoords(angle, width, height)
      const grad = ctx.createLinearGradient(coords.x0, coords.y0, coords.x1, coords.y1)
      stops.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'radial': {
      const config = getRadialConfig(angle)
      const cx = width * config.px
      const cy = height * config.py
      const r = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy))
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
      const startAngle = (((angle ?? 0) - 90) * Math.PI) / 180

      if (ctx.createConicGradient) {
        const grad = ctx.createConicGradient(startAngle, cx, cy)
        withSeam.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      } else {
        // Fallback: draw fine angular wedges
        const numWedges = 360
        for (let i = 0; i < numWedges; i++) {
          const angleStart = (i / numWedges) * 2 * Math.PI + startAngle
          const angleEnd = ((i + 1) / numWedges) * 2 * Math.PI + startAngle
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
    case 'fan': {
      const config = typeof gradient.angle === 'number' ? getFanConfig(gradient.angle) : FAN_ANCHOR_CONFIG[fanAnchor ?? 'bottom']
      const cx = width * config.px
      const cy = height * config.py
      const compressed = stops.map((s) => ({ hex: s.hex, position: Math.round(s.position * config.span) }))
      const withTail = [...compressed, { hex: stops[stops.length - 1].hex, position: 100 }]
      const radius = Math.hypot(width, height)
      const startAngle = ((config.from - 90) * Math.PI) / 180

      if (ctx.createConicGradient) {
        const grad = ctx.createConicGradient(startAngle, cx, cy)
        withTail.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      } else {
        const numWedges = 360
        for (let i = 0; i < numWedges; i++) {
          const angleStart = (i / numWedges) * 2 * Math.PI + startAngle
          const angleEnd = ((i + 1) / numWedges) * 2 * Math.PI + startAngle
          const color = sampleStops(withTail, i / numWedges)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, radius, angleStart, angleEnd)
          ctx.closePath()
          ctx.fillStyle = color
          ctx.fill()
        }
      }
      break
    }
    case 'square': {
      /* Mirrors TurrellSquare exactly — this is the export of what is on
       * screen, so the two geometries have to agree. The previous version
       * disagreed in three ways:
       *
       *   1. It hardcoded a centred nest, `(width - sizeX) / 2`, and never
       *      consulted getRadialConfig — so every non-centred origin exported
       *      as centred. That is the bug that made shared posts wrong.
       *   2. It inverted the size ramp: `100 - position * 0.8` makes position 0
       *      the OUTERMOST layer, while the component's `0.2 + position * 0.8`
       *      makes it the innermost.
       *   3. It skipped the repeat filter, which the component applies.
       *
       * Built from gradient.stops rather than the pre-processed `stops` above,
       * because the component applies repeat BEFORE reversing hexes and the
       * shared pipeline reverses first. */
      const base = repeatEnabled ? repeatedStops([...gradient.stops]) : [...gradient.stops]
      const hexes = reversed ? base.map((s) => s.hex).reverse() : base.map((s) => s.hex)

      const origin = getRadialConfig(angle)
      // Reach to the farthest edge on each axis, so an edge/corner origin still
      // spans the whole canvas instead of leaving a flat band of the last colour.
      const reachX = Math.max(origin.px, 1 - origin.px)
      const reachY = Math.max(origin.py, 1 - origin.py)
      const cx = origin.px * width
      const cy = origin.py * height

      const layers = base
        .map((stop, i) => ({
          hex: hexes[i],
          factor: base.length <= 1 ? 1 : 0.2 + (stop.position / 100) * 0.8,
        }))
        // Largest first, so smaller inner layers are not painted over.
        .sort((a, b) => b.factor - a.factor)

      // The canvas is painted in the outermost layer's colour, matching the
      // component's container fill.
      ctx.fillStyle = layers[0]?.hex ?? '#000000'
      ctx.fillRect(0, 0, width, height)

      const blurRadius = 24 * (width / 400)

      for (const layer of layers) {
        const sizeX = 2 * reachX * layer.factor * width
        const sizeY = 2 * reachY * layer.factor * height
        const rx = cx - sizeX / 2
        const ry = cy - sizeY / 2

        ctx.save()
        if (blurRadius > 0) {
          // Safari often ignores ctx.filter = 'blur()' on large canvases.
          // Drawing the shadow of an offscreen rect perfectly emulates it.
          ctx.shadowColor = layer.hex
          ctx.shadowBlur = blurRadius
          ctx.shadowOffsetX = width * 2
          ctx.shadowOffsetY = 0
          ctx.fillStyle = layer.hex
          ctx.fillRect(rx - width * 2, ry, sizeX, sizeY)
        } else {
          ctx.fillStyle = layer.hex
          ctx.fillRect(rx, ry, sizeX, sizeY)
        }
        ctx.restore()
      }
      break
    }
    case 'mirror': {
      const forward = stops.map((s) => s.hex)
      const mirrored = [...forward, ...forward.slice(0, -1).reverse()]
      const ordered = positionedStops(mirrored)
      const coords = getLinearGradientCoords(angle, width, height)
      const grad = ctx.createLinearGradient(coords.x0, coords.y0, coords.x1, coords.y1)
      ordered.forEach((s) => grad.addColorStop(s.position / 100, s.hex))
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'repeat': {
      const hexes = stops.map((s) => s.hex)
      const sequence = [...hexes, ...hexes]
      const ordered = positionedStops(sequence)
      const coords = getLinearGradientCoords(angle, width, height)
      const grad = ctx.createLinearGradient(coords.x0, coords.y0, coords.x1, coords.y1)
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
