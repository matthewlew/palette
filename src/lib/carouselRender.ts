/**
 * Canvas rendering for carousel slides.
 *
 * A composite slide draws each of its slices by rendering that gradient
 * full-bleed to an offscreen canvas at the slice's pixel size and blitting it
 * in. Rendering at slice size rather than slide size and cropping matters for
 * every non-linear geometry: a radial or Turrell gradient centres on the
 * canvas it is drawn to, so cropping a full-slide render would push the centre
 * out of a narrow bar instead of keeping it in frame.
 */

import type { Gradient } from '../store/types'
import { renderGradientToCanvas } from './canvasExport'
import { applyNoise, VIGNETTE_PAPER, POSTER_INK, POSTER_MUTED } from './vignette'
import type { CarouselSlide, SlicePlacement } from './carouselTemplates'
import type { CaptionParts } from './carouselCaption'

/** Slide dimensions Instagram accepts for a carousel. Every slide in one
 * carousel must share a ratio, so this is chosen once for the whole set. */
export type SlideRatio = 'portrait' | 'square' | 'story'

export const SLIDE_SIZES: Record<SlideRatio, { width: number; height: number; label: string }> = {
  portrait: { width: 1080, height: 1350, label: '4:5 Portrait' },
  square: { width: 1080, height: 1080, label: '1:1 Square' },
  story: { width: 1080, height: 1920, label: '9:16 Story' },
}

export interface SlideStyle {
  /** Inset every slice on a paper ground, with a gutter between them, and
   * round the corners — the difference between "a mosaic" and "prints laid on
   * a page". Off means edge-to-edge colour. */
  framed?: boolean
  /** Film grain over the finished slide. */
  grain?: boolean
}

/** Outer margin and inter-slice gutter, as fractions of the slide's short
 * edge, so a story slide isn't framed three times as thickly as a square one. */
const FRAME_MARGIN = 0.045
const FRAME_GUTTER = 0.022

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** Pixel rect for a fractional slice, after framing insets are applied. */
function sliceBox(
  slice: SlicePlacement,
  width: number,
  height: number,
  framed: boolean
): { x: number; y: number; w: number; h: number } {
  const unit = Math.min(width, height)
  const margin = framed ? unit * FRAME_MARGIN : 0
  const inset = framed ? (unit * FRAME_GUTTER) / 2 : 0

  const areaW = width - margin * 2
  const areaH = height - margin * 2

  return {
    x: margin + slice.x * areaW + inset,
    y: margin + slice.y * areaH + inset,
    w: Math.max(1, slice.w * areaW - inset * 2),
    h: Math.max(1, slice.h * areaH - inset * 2),
  }
}

/**
 * Draws one composite slide. `gradients` is the full pick list; each slice
 * names its gradient by index into it. A slice whose index has no gradient is
 * skipped rather than throwing, so a stale template selection degrades to a
 * gap instead of a failed export.
 */
export function renderCompositeSlide(
  canvas: HTMLCanvasElement,
  slide: CarouselSlide,
  gradients: Gradient[],
  width: number,
  height: number,
  style: SlideStyle = {}
) {
  const { framed = false, grain = true } = style
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = framed ? VIGNETTE_PAPER : '#000000'
  ctx.fillRect(0, 0, width, height)

  const radius = framed ? Math.min(width, height) * 0.02 : 0

  for (const slice of slide.slices) {
    const gradient = gradients[slice.index]
    if (!gradient) continue
    const box = sliceBox(slice, width, height, framed)

    const source = document.createElement('canvas')
    renderGradientToCanvas(source, gradient, Math.round(box.w), Math.round(box.h))

    ctx.save()
    if (radius > 0) {
      roundRectPath(ctx, box.x, box.y, box.w, box.h, radius)
      ctx.clip()
    }
    ctx.drawImage(source, box.x, box.y, box.w, box.h)
    ctx.restore()
  }

  if (grain) applyNoise(ctx, width, height)
}

/** Wraps `text` to `maxWidth` using the context's current font. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let line = words[0]
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
}

/**
 * The closing text tile: title, then one numbered row per gradient carrying
 * its colour chips and hex codes. This is the slide people screenshot, so the
 * hexes are the content and the type is deliberately plain.
 *
 * Rows that would overflow the tile are dropped and replaced by a "+N more"
 * line rather than being drawn off the bottom edge.
 */
export function renderCaptionSlide(
  canvas: HTMLCanvasElement,
  parts: CaptionParts,
  width: number,
  height: number,
  style: SlideStyle = {}
) {
  const { grain = true } = style
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = VIGNETTE_PAPER
  ctx.fillRect(0, 0, width, height)

  const unit = Math.min(width, height)
  const margin = unit * 0.09
  const contentWidth = width - margin * 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const titleSize = unit * 0.062
  ctx.font = `600 ${titleSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
  ctx.fillStyle = POSTER_INK
  const titleLines = wrapText(ctx, parts.title, contentWidth)

  let y = margin + titleSize
  for (const line of titleLines) {
    ctx.fillText(line, margin, y)
    y += titleSize * 1.16
  }

  // Rule under the title, the one piece of structure on the tile.
  y += unit * 0.02
  ctx.fillStyle = `${POSTER_MUTED}66`
  ctx.fillRect(margin, y, contentWidth, Math.max(1, unit * 0.002))
  y += unit * 0.05

  const nameSize = unit * 0.03
  const hexSize = unit * 0.021
  const chip = unit * 0.028
  const bottomLimit = height - margin

  // Rows breathe into whatever space is left rather than stacking tight at the
  // top of a mostly-empty tile — a four-gradient carousel would otherwise
  // leave half the slide blank. Capped so a two-gradient set doesn't drift
  // into a sparse, unreadable list, and floored at the natural row height so a
  // long set still packs and overflows into the "+N more" line.
  const naturalRow = unit * 0.082
  const available = bottomLimit - y
  const rowHeight = Math.min(
    naturalRow * 1.8,
    Math.max(naturalRow, available / Math.max(1, parts.entries.length))
  )

  let drawn = 0
  for (const entry of parts.entries) {
    // Reserve a row's worth of space for the "+N more" line if this isn't the
    // last entry, so the overflow notice always has somewhere to go.
    const isLast = drawn === parts.entries.length - 1
    const needed = isLast ? rowHeight : rowHeight * 2
    if (y + needed > bottomLimit) break

    ctx.fillStyle = POSTER_INK
    ctx.font = `500 ${nameSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
    ctx.fillText(`${entry.position}. ${entry.name}`, margin, y)

    // Colour chips, then the hex codes beneath them.
    const chipY = y + nameSize * 0.35
    entry.hexes.forEach((hex, i) => {
      ctx.fillStyle = hex
      roundRectPath(ctx, margin + i * (chip * 1.28), chipY, chip, chip, chip * 0.24)
      ctx.fill()
    })

    ctx.fillStyle = POSTER_MUTED
    ctx.font = `400 ${hexSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
    const hexLine = entry.hexes.join('  ')
    const chipsWidth = entry.hexes.length * (chip * 1.28)
    ctx.fillText(hexLine, margin + chipsWidth + unit * 0.02, chipY + chip * 0.72)

    y += rowHeight
    drawn++
  }

  const remaining = parts.entries.length - drawn
  if (remaining > 0) {
    ctx.fillStyle = POSTER_MUTED
    ctx.font = `400 ${nameSize}px system-ui, 'Segoe UI', Roboto, sans-serif`
    ctx.fillText(`+${remaining} more in the caption`, margin, y)
  }

  if (grain) applyNoise(ctx, width, height)
}

/** Renders whichever kind of slide this is. */
export function renderSlide(
  canvas: HTMLCanvasElement,
  slide: CarouselSlide,
  gradients: Gradient[],
  parts: CaptionParts,
  width: number,
  height: number,
  style: SlideStyle = {}
) {
  if (slide.kind === 'caption') {
    renderCaptionSlide(canvas, parts, width, height, style)
  } else {
    renderCompositeSlide(canvas, slide, gradients, width, height, style)
  }
}
