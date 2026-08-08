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

/** How a carousel actually reached the user, so the UI can say so. */
export type CarouselDelivery = 'shared' | 'downloaded' | 'cancelled'

export interface CarouselExportResult {
  delivery: CarouselDelivery
  count: number
}

/** Whether this browser can hand a set of PNGs to the OS share sheet.
 *
 * `canShare({ files })` is the only honest test: iOS Safari has `navigator.share`
 * but rejects file payloads in some contexts, and Firefox has neither. */
function canShareFiles(files: File[]): boolean {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Renders the carousel and gets the images onto the device.
 *
 * The share sheet is tried first because it is the only route that reaches the
 * iOS camera roll: `navigator.share` with an array of PNG files gives Safari's
 * "Save N Images", which drops them straight into Photos where Instagram picks
 * them up. A zip was the wrong shape for a phone entirely — iOS files it in
 * Files, and unpacking it and getting the PNGs into Photos is several steps
 * that all happen outside this app.
 *
 * Desktop browsers (and anything without file sharing) fall back to one
 * download per slide, which is where a zip was actually earning its keep — so
 * the filenames stay zero-padded and numbered either way.
 *
 * The caption rides along as the share sheet's `text`, and is copyable in the
 * studio regardless; it is deliberately not a file, since a .txt in the payload
 * makes iOS offer "Save to Files" instead of "Save Images".
 */
export async function exportCarousel(
  spec: CarouselSpec,
  onProgress?: (done: number, total: number) => void
): Promise<CarouselExportResult> {
  const slides = await renderCarouselSlides(spec, onProgress)
  if (slides.length === 0) return { delivery: 'downloaded', count: 0 }

  const files = slides.map(
    (slide) => new File([slide.blob], slide.filename, { type: 'image/png' })
  )

  if (canShareFiles(files)) {
    const parts = captionParts(spec.gradients, spec.caption)
    try {
      await navigator.share({ files, title: parts.title, text: buildCaption(spec.gradients, spec.caption) })
      return { delivery: 'shared', count: files.length }
    } catch (e) {
      // Dismissing the sheet throws AbortError. That is a decision, not a
      // failure, so don't "helpfully" dump N downloads on someone who just
      // backed out.
      if (e instanceof Error && e.name === 'AbortError') {
        return { delivery: 'cancelled', count: 0 }
      }
      // Anything else: fall through to downloads rather than losing the render.
      console.warn('Carousel share failed, falling back to downloads', e)
    }
  }

  for (const slide of slides) {
    triggerDownload(slide.blob, slide.filename)
    // Browsers throttle or silently drop a burst of simultaneous downloads.
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return { delivery: 'downloaded', count: slides.length }
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
