import type { Gradient } from '../store/types'
import { renderGradientToCanvas, shareOrDownloadCanvas } from './canvasExport'
import { titleColorAt } from './titleColor'
import { NOISE_DATA_URL } from '../components/NoiseOverlay'

export type VignetteShape = 'full' | 'circle' | 'oval' | 'diamond' | 'poster' | 'post'

export const VIGNETTE_SHAPES: { id: VignetteShape; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'circle', label: 'Circle' },
  { id: 'oval', label: 'Oval' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'poster', label: 'Poster' },
  { id: 'post', label: 'Post' },
]

/** Warm paper tone behind every masked vignette, so exports read as prints
 * rather than screenshots. */
export const VIGNETTE_PAPER = '#f7f5f0'
const POSTER_INK = '#1c1a20'
const POSTER_MUTED = '#8d8894'

/**
 * Renders a gradient vignette: the gradient masked to a shape on a paper
 * background, or (for 'poster') inset with a border and titled like a
 * minimalist print. 'full' delegates to the plain full-bleed render.
 */
async function drawNoise(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.35
  const img = new Image()
  img.src = NOISE_DATA_URL
  await new Promise((resolve) => {
    img.onload = () => {
      const pattern = ctx.createPattern(img, 'repeat')
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, width, height)
      }
      resolve(null)
    }
    img.onerror = resolve
  })
  ctx.restore()
}

export async function renderVignetteToCanvas(
  canvas: HTMLCanvasElement,
  gradient: Gradient,
  width: number,
  height: number,
  shape: VignetteShape
) {
  if (shape === 'full') {
    renderGradientToCanvas(canvas, gradient, width, height)
    const ctx = canvas.getContext('2d')
    if (ctx) await drawNoise(ctx, width, height)
    return
  }

  // The gradient itself is rendered full-bleed offscreen, then composited
  // through the mask so every gradient type keeps its normal geometry.
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  renderGradientToCanvas(source, gradient, width, height)
  const sourceCtx = source.getContext('2d')
  if (sourceCtx) await drawNoise(sourceCtx, width, height)

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = VIGNETTE_PAPER
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2

  if (shape === 'poster') {
    // Minimalist poster: generous even border, taller caption band below,
    // title + meta line bottom-left. Type scales off the short edge.
    const unit = Math.min(width, height)
    const margin = unit * 0.09
    const band = unit * 0.24
    const artHeight = height - margin - band
    ctx.fillStyle = '#00000014'
    ctx.fillRect(margin, margin + 1, width - margin * 2, artHeight)
    ctx.drawImage(source, margin, margin, width - margin * 2, artHeight)

    const title = gradient.name ?? 'Untitled'
    const meta = `${gradient.type.toUpperCase()} GRADIENT · ${gradient.stops.length} COLORS`
    const titleSize = unit * 0.045
    const metaSize = unit * 0.02

    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = POSTER_INK
    ctx.font = `500 ${titleSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
    ctx.fillText(title, margin, margin + artHeight + band * 0.42)
    ctx.fillStyle = POSTER_MUTED
    ctx.font = `400 ${metaSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
    ctx.fillText(meta, margin, margin + artHeight + band * 0.42 + titleSize * 0.95)
    return
  }
  
  if (shape === 'post') {
    ctx.drawImage(source, 0, 0, width, height)
    
    const title = gradient.name ?? 'Untitled'
    const fontSize = width * 0.045
    ctx.font = `600 ${fontSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
    ctx.textBaseline = 'middle'
    
    const textWidth = ctx.measureText(title).width
    const x = (width - textWidth) / 2
    const y = height / 2
    
    ctx.fillStyle = titleColorAt(gradient, 0.5, 0.5)
    ctx.textAlign = 'left'
    ctx.fillText(title, x, y)
    return
  }

  ctx.save()
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(cx, cy, (Math.min(width, height) / 2) * 0.78, 0, Math.PI * 2)
  } else if (shape === 'oval') {
    ctx.ellipse(cx, cy, (width / 2) * 0.78, (height / 2) * 0.78, 0, 0, Math.PI * 2)
  } else {
    // diamond
    const rx = (width / 2) * 0.82
    const ry = (height / 2) * 0.82
    ctx.moveTo(cx, cy - ry)
    ctx.lineTo(cx + rx, cy)
    ctx.lineTo(cx, cy + ry)
    ctx.lineTo(cx - rx, cy)
    ctx.closePath()
  }
  ctx.clip()
  ctx.drawImage(source, 0, 0, width, height)
  ctx.restore()
}

/** Renders the chosen vignette and hands it to the share/download flow. */
export async function downloadVignettePng(
  gradient: Gradient,
  width: number,
  height: number,
  shape: VignetteShape
) {
  const canvas = document.createElement('canvas')
  await renderVignetteToCanvas(canvas, gradient, width, height, shape)
  const slug = (gradient.name ?? 'gradient').toLowerCase().replace(/\s+/g, '-')
  const shapeSuffix = shape === 'full' ? '' : `-${shape}`
  const filename = `${slug}${shapeSuffix}-${width}x${height}.png`
  await shareOrDownloadCanvas(canvas, filename, gradient.name ?? 'Gradient')
}
