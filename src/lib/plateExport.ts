/**
 * Drum's plate exporter (PRD §6 item 4) — one grayscale PDF per ink, flattened,
 * 600dpi, white base (bare paper), zero alpha. Reuses renderGradientToCanvas
 * as a wrapper: per ink, coverage substitutes for the stop's hex, and the
 * canvas background is white instead of the RGB default black — 0% coverage
 * must read as bare paper, not full ink (see the `background` param there).
 *
 * DPI and alpha are the PRD's two hard-block preflight checks (§6 item 3).
 * Both are satisfied by construction here rather than checked after the
 * fact: the canvas is rasterized at a fixed 600dpi and PNG-embedded with no
 * alpha channel, so there is no export path that could produce a rejected
 * file.
 */
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import type { Gradient } from '../store/types'
import type { GradientStop } from './gradient'
import { renderGradientToCanvas } from './canvasExport'

const PLATE_DPI = 600
/** Matches the 4x6" postcard Jenny's reference sheet was cut from. */
export const PLATE_WIDTH_IN = 6
export const PLATE_HEIGHT_IN = 4

/** 0% coverage -> white (bare paper), 100% coverage -> black (full ink). */
export function coverageToGrayscaleHex(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent))
  const value = Math.round(255 - (clamped / 100) * 255)
  const hex = value.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}

/**
 * The same gradient shape (type, angle, easing, flags), with every stop's
 * hex replaced by that ink's grayscale coverage value — so the plate matches
 * exactly what the overprint preview composited for this ink, not a
 * re-derived approximation.
 */
export function buildInkPlateGradient(gradient: Gradient, inkIndex: number): Gradient {
  const coverage = gradient.riso?.coverage ?? []
  const stops: GradientStop[] = gradient.stops.map((stop, i) => ({
    position: stop.position,
    hex: coverageToGrayscaleHex(coverage[i]?.[inkIndex] ?? 0),
  }))
  return { ...gradient, stops }
}

function renderPlateCanvas(gradient: Gradient, inkIndex: number, widthPx: number, heightPx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  renderGradientToCanvas(canvas, buildInkPlateGradient(gradient, inkIndex), widthPx, heightPx, '#ffffff')
  return canvas
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'plate'
  )
}

async function canvasToPdfBytes(canvas: HTMLCanvasElement, widthIn: number, heightIn: number): Promise<Uint8Array> {
  const pngDataUrl = canvas.toDataURL('image/png')
  const pngBytes = await (await fetch(pngDataUrl)).arrayBuffer()

  const pdf = await PDFDocument.create()
  const png = await pdf.embedPng(pngBytes)
  // PDF page size is in points (72/inch), independent of the source raster's
  // pixel dimensions — the DPI lives entirely in how many pixels we chose to
  // render per inch above.
  const page = pdf.addPage([widthIn * 72, heightIn * 72])
  page.drawImage(png, { x: 0, y: 0, width: widthIn * 72, height: heightIn * 72 })
  return pdf.save()
}

export interface DrumPlate {
  ink: string
  filename: string
  bytes: Uint8Array
}

const PREVIEW_WIDTH_PX = 240
const PREVIEW_HEIGHT_PX = 160

export interface DrumPlatePreview {
  ink: string
  dataUrl: string
}

/**
 * Cheap raster previews of what renderDrumPlates would produce — same
 * buildInkPlateGradient composite as the real export, just rasterized small
 * and returned as PNG data URLs instead of full 600dpi PDFs, so the export
 * flow can show what's about to be downloaded before committing to it.
 */
export function renderDrumPlatePreviews(gradient: Gradient): DrumPlatePreview[] {
  const inks = gradient.riso?.inks ?? []
  return inks.map((ink, i) => ({
    ink,
    dataUrl: renderPlateCanvas(gradient, i, PREVIEW_WIDTH_PX, PREVIEW_HEIGHT_PX).toDataURL('image/png'),
  }))
}

/**
 * Renders one flattened grayscale PDF per ink drum, at fixed 600dpi over a
 * 4x6" postcard sheet. Returns the raw plates rather than triggering a
 * download directly, so callers (and tests) can inspect them before the zip
 * step.
 */
export async function renderDrumPlates(
  gradient: Gradient,
  widthIn = PLATE_WIDTH_IN,
  heightIn = PLATE_HEIGHT_IN
): Promise<DrumPlate[]> {
  const inks = gradient.riso?.inks ?? []
  const widthPx = Math.round(widthIn * PLATE_DPI)
  const heightPx = Math.round(heightIn * PLATE_DPI)
  const baseName = slugify(gradient.name ?? 'drum')

  const plates: DrumPlate[] = []
  for (let i = 0; i < inks.length; i++) {
    const canvas = renderPlateCanvas(gradient, i, widthPx, heightPx)
    const bytes = await canvasToPdfBytes(canvas, widthIn, heightIn)
    plates.push({ ink: inks[i], filename: `${baseName}_${slugify(inks[i])}.pdf`, bytes })
  }
  return plates
}

/**
 * Renders the plates and downloads them as a single zip — mirrors
 * downloadCarouselZip's pattern, and avoids the browser's multi-file-download
 * prompt that N separate anchor-click downloads would trigger.
 */
export async function downloadDrumPlatesZip(gradient: Gradient): Promise<number> {
  const plates = await renderDrumPlates(gradient)
  if (plates.length === 0) return 0

  const zip = new JSZip()
  for (const plate of plates) zip.file(plate.filename, plate.bytes)

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(gradient.name ?? 'drum')}-plates.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return plates.length
}
