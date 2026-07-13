import type { Gradient } from '../store/types'
import {
  fromImportJson,
  importGradient,
  toExportJson,
  toSharePayloadGradient,
} from './gradientCodec'
import { gradientToSvg } from './gradientSvg'
import { gradientToPngDataUrl } from './canvasExport'
import type { GradientType } from './gradient'

// Types with no faithful SVG-gradient equivalent (conic + layered). For these
// we embed an exact PNG raster so Figma shows the real shape instead of a
// linear approximation. Vector-expressible types stay editable SVG gradients.
const RASTER_TYPES: ReadonlySet<GradientType> = new Set(['angular', 'square', 'fan'])

// The Palette payload rides inside the SVG as a <metadata> CDATA block tagged
// with this marker. Figma/Illustrator ignore <metadata>, so the same SVG
// string serves both as the vector paste and as Palette's exact round-trip.
const PAYLOAD_PREFIX = 'palette:'
const PAYLOAD_RE = /<!\[CDATA\[palette:([\s\S]*?)\]\]>/

/** Embed the Palette JSON in the SVG's <metadata> so a copy is both a vector
 * (for design tools) and a lossless Palette payload. CDATA carries the JSON
 * verbatim; JSON never contains the "]]>" terminator, so it stays valid XML. */
function embedPayload(svg: string, json: string): string {
  const metadata = `<metadata><![CDATA[${PAYLOAD_PREFIX}${json}]]></metadata>`
  // Insert right after the opening <svg ...> tag.
  return svg.replace(/(<svg[^>]*>)/, `$1${metadata}`)
}

function extractPayload(text: string): string | null {
  const match = text.match(PAYLOAD_RE)
  return match ? match[1] : null
}

/** Wrap a PNG data URL in an SVG <image> so a copied conic/layered gradient
 * pastes into Figma at full fidelity. xlink:href is set for broad importer
 * compatibility. */
function rasterSvg(dataUrl: string, size = 512): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image xlink:href="${dataUrl}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/></svg>`
}

/** Build the SVG that goes on the clipboard: a real vector gradient for types
 * SVG can express, an embedded raster for conic/layered types. Any failure in
 * the raster path (e.g. no canvas support) falls back to the vector SVG so a
 * copy always produces something. */
function buildClipboardSvg(gradient: Gradient): string {
  if (RASTER_TYPES.has(gradient.type)) {
    try {
      return rasterSvg(gradientToPngDataUrl(gradient))
    } catch {
      // Fall through to the vector approximation.
    }
  }
  return gradientToSvg(gradient)
}

/** Write the focused gradient to the clipboard. text/plain and image/svg+xml
 * both carry the SVG markup: Figma imports SVG from the plain-text slot, and
 * the SVG embeds the Palette JSON in <metadata> so another Palette session
 * round-trips it exactly. Conic/layered types (angular/square/fan) embed a PNG
 * raster so their real shape survives; vector-expressible types stay editable
 * gradients. We deliberately do NOT set text/html — Figma
 * prioritizes it and parses the <svg> as rich text, producing an empty text
 * frame instead of a vector. Called from a native `copy` event so the formats
 * are set synchronously with no permission prompt. */
export function writeGradientToClipboard(e: ClipboardEvent, gradient: Gradient): void {
  const data = e.clipboardData
  if (!data) return
  const json = toExportJson({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  const svg = embedPayload(buildClipboardSvg(gradient), json)
  data.setData('text/plain', svg)
  data.setData('image/svg+xml', svg)
  e.preventDefault()
}

/** Read Palette gradients from a native `paste` event. Prefers the JSON
 * embedded in a copied SVG, and falls back to raw Palette JSON (older copies /
 * pasted JSON exports). Returns fresh Gradient objects (new ids), or null when
 * the clipboard has no recognizable Palette payload. */
export function readGradientsFromClipboard(e: ClipboardEvent): Gradient[] | null {
  const text = e.clipboardData?.getData('text/plain')
  if (!text) return null
  const json = extractPayload(text) ?? text
  const payload = fromImportJson(json)
  if (!payload) return null
  return payload.gradients.map(importGradient)
}
