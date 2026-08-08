import type { Gradient } from '../store/types'
import { renderGradientToCanvas, shareOrDownloadCanvas } from './canvasExport'
import { titleColorAt } from './titleColor'
import { namePalette } from './naming'

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
/** Print ink and its muted companion. Exported so the carousel caption tile
 * (lib/carouselRender.ts) sets type in the same two tones as the poster
 * vignette instead of picking a second, nearly-identical pair. */
export const POSTER_INK = '#1c1a20'
export const POSTER_MUTED = '#8d8894'

/**
 * Renders a gradient vignette: the gradient masked to a shape on a paper
 * background, or (for 'poster') inset with a border and titled like a
 * minimalist print. 'full' delegates to the plain full-bleed render.
 */
/** Monochrome film grain over the whole canvas — the texture that makes every
 * export read as a print rather than a screenshot. Exported so carousel slides
 * carry the same grain as single-gradient exports. */
export function applyNoise(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data
  // Simple monochrome grain: +/- ~12 to RGB channels
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 24
    data[i] = Math.min(255, Math.max(0, data[i] + noise))
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise))
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise))
  }
  ctx.putImageData(imgData, 0, 0)
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
    if (ctx) applyNoise(ctx, width, height)
    return
  }

  // The gradient itself is rendered full-bleed offscreen, then composited
  // through the mask so every gradient type keeps its normal geometry.
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  renderGradientToCanvas(source, gradient, width, height)

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

    const title = gradient.name ?? namePalette(gradient.stops.map(s => s.hex))
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
    applyNoise(ctx, width, height)
    return
  }
  
  if (shape === 'post') {
    ctx.drawImage(source, 0, 0, width, height)
    
    const title = gradient.name ?? namePalette(gradient.stops.map(s => s.hex))
    const fontSize = width * 0.028
    ctx.font = `600 ${fontSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
    ctx.textBaseline = 'middle'
    
    // Left aligned with a 6% margin
    const x = width * 0.06
    const y = height / 2
    
    ctx.fillStyle = titleColorAt(gradient, 0.06, 0.5)
    ctx.textAlign = 'left'
    ctx.fillText(title, x, y)
    applyNoise(ctx, width, height)
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
  applyNoise(ctx, width, height)
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
