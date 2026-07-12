import type { Gradient } from '../store/types'
import {
  fromImportJson,
  importGradient,
  toExportJson,
  toSharePayloadGradient,
} from './gradientCodec'
import { gradientToSvg } from './gradientSvg'

/** Write the focused gradient to the clipboard in three formats: Palette JSON
 * (text/plain, read back by another Palette session), and an SVG under both
 * image/svg+xml and text/html so design tools (Figma/Illustrator) paste a
 * vector gradient. Called from a native `copy` event so all formats are set
 * synchronously with no permission prompt. */
export function writeGradientToClipboard(e: ClipboardEvent, gradient: Gradient): void {
  const data = e.clipboardData
  if (!data) return
  const json = toExportJson({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  const svg = gradientToSvg(gradient)
  data.setData('text/plain', json)
  data.setData('image/svg+xml', svg)
  data.setData('text/html', svg)
  e.preventDefault()
}

/** Read Palette gradients from a native `paste` event. Returns fresh Gradient
 * objects (new ids) on a valid Palette payload, or null when the clipboard has
 * no recognizable Palette JSON. */
export function readGradientsFromClipboard(e: ClipboardEvent): Gradient[] | null {
  const text = e.clipboardData?.getData('text/plain')
  if (!text) return null
  const payload = fromImportJson(text)
  if (!payload) return null
  return payload.gradients.map(importGradient)
}
