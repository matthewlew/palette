import type { Gradient } from '../store/types'
import {
  fromImportJson,
  importGradient,
  toExportJson,
  toSharePayloadGradient,
} from './gradientCodec'
import { gradientToSvg } from './gradientSvg'

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

/** Write the focused gradient to the clipboard. text/plain and image/svg+xml
 * both carry the SVG markup: Figma imports SVG from the plain-text slot, and
 * the SVG embeds the Palette JSON in <metadata> so another Palette session
 * round-trips it exactly. We deliberately do NOT set text/html — Figma
 * prioritizes it and parses the <svg> as rich text, producing an empty text
 * frame instead of a vector. Called from a native `copy` event so the formats
 * are set synchronously with no permission prompt. */
export function writeGradientToClipboard(e: ClipboardEvent, gradient: Gradient): void {
  const data = e.clipboardData
  if (!data) return
  const json = toExportJson({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  const svg = embedPayload(gradientToSvg(gradient), json)
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
