/**
 * Turns a carousel spec into files on disk.
 *
 * Slide order is the whole point of this feature, and a zip has no order — so
 * every filename is zero-padded and numbered from 1. Sorted by name in Finder,
 * Files or the Instagram picker, they come out in exactly the order the
 * gradients were picked.
 */

import JSZip from 'jszip'
import type { Gradient } from '../store/types'
import { buildCarousel, type BuildCarouselOptions } from './carouselTemplates'
import { captionParts, buildCaption, type CaptionOptions } from './carouselCaption'
import { renderSlide, SLIDE_SIZES, type SlideRatio, type SlideStyle } from './carouselRender'

export interface CarouselSpec {
  templateId: string
  gradients: Gradient[]
  ratio: SlideRatio
  style?: SlideStyle
  caption?: CaptionOptions
  carousel?: BuildCarouselOptions
}

/** Zero-padded to the widest index in the set, so 10 slides sort 01..10 rather
 * than 1, 10, 2. */
export function slideFilename(index: number, total: number, kind: string): string {
  const width = String(total).length
  const n = String(index + 1).padStart(width, '0')
  return `${n}-${kind}.png`
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'carousel'
  )
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export interface RenderedSlide {
  filename: string
  blob: Blob
}

/**
 * Renders every slide of the carousel to a PNG blob, in order. `onProgress` is
 * called after each slide so the UI can show real progress — a nine-slide
 * framed carousel is seconds of canvas work, not milliseconds.
 */
export async function renderCarouselSlides(
  spec: CarouselSpec,
  onProgress?: (done: number, total: number) => void
): Promise<RenderedSlide[]> {
  const slides = buildCarousel(spec.templateId, spec.gradients.length, spec.carousel)
  if (slides.length === 0) return []

  const { width, height } = SLIDE_SIZES[spec.ratio]
  const parts = captionParts(spec.gradients, spec.caption)
  const out: RenderedSlide[] = []

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const canvas = document.createElement('canvas')
    renderSlide(canvas, slide, spec.gradients, parts, width, height, spec.style)
    const blob = await canvasToBlob(canvas)
    if (blob) {
      out.push({ filename: slideFilename(i, slides.length, slide.kind), blob })
    }
    onProgress?.(i + 1, slides.length)
    // Yield between slides so the progress paint actually lands — the render
    // loop is synchronous canvas work and would otherwise block to the end.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return out
}

/**
 * Renders the carousel and downloads it as a zip, with the caption text
 * alongside the images as caption.txt — so the post can be assembled from the
 * folder alone, without coming back to the app to copy it.
 */
export async function downloadCarouselZip(
  spec: CarouselSpec,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const slides = await renderCarouselSlides(spec, onProgress)
  if (slides.length === 0) return 0

  const zip = new JSZip()
  for (const slide of slides) zip.file(slide.filename, slide.blob)
  zip.file('caption.txt', buildCaption(spec.gradients, spec.caption))

  const blob = await zip.generateAsync({ type: 'blob' })
  const title = captionParts(spec.gradients, spec.caption).title
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(title)}-carousel.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return slides.length
}
