import type { GradientType } from './gradient'
import type { GradientStop } from './gradient'
import type { Gradient } from '../store/types'

export interface SharePayloadGradient {
  type: GradientType
  stops: GradientStop[]
  reversed?: boolean
  repeatEnabled?: boolean
  hardStops?: boolean
  name: string
}

export interface SharePayload {
  kind: 'gradient' | 'board'
  gradients: SharePayloadGradient[]
}

/** Strips fields that shouldn't cross the wire (currently just `id`, which
 * is always regenerated on import) and drops `undefined` optional keys so
 * encoded payloads stay compact and round-trip through JSON.stringify
 * without producing spurious differences. */
export function toSharePayloadGradient(gradient: Gradient): SharePayloadGradient {
  const out: SharePayloadGradient = {
    type: gradient.type,
    stops: gradient.stops,
    name: gradient.name ?? '',
  }
  if (gradient.reversed !== undefined) out.reversed = gradient.reversed
  if (gradient.repeatEnabled !== undefined) out.repeatEnabled = gradient.repeatEnabled
  if (gradient.hardStops !== undefined) out.hardStops = gradient.hardStops
  return out
}

function isSharePayloadGradient(value: unknown): value is SharePayloadGradient {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    Array.isArray(v.stops) &&
    v.stops.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as Record<string, unknown>).hex === 'string' &&
        typeof (s as Record<string, unknown>).position === 'number'
    ) &&
    typeof v.name === 'string'
  )
}

function isSharePayload(value: unknown): value is SharePayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.kind === 'gradient' || v.kind === 'board') &&
    Array.isArray(v.gradients) &&
    v.gradients.every(isSharePayloadGradient)
  )
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return decodeURIComponent(escape(atob(padded)))
}

export function encodeToFragment(payload: SharePayload): string {
  return `d=${base64UrlEncode(JSON.stringify(payload))}`
}

/** Accepts either a raw fragment string ("d=...") or a full `location.hash`
 * value (which includes the leading "#"). Returns null on any decode
 * failure rather than throwing, so callers can treat "no valid share data"
 * as a single case. */
export function decodeFromFragment(fragment: string): SharePayload | null {
  const cleaned = fragment.startsWith('#') ? fragment.slice(1) : fragment
  const match = cleaned.match(/(?:^|&)d=([^&]+)/)
  if (!match) return null
  try {
    const json = base64UrlDecode(match[1])
    const parsed: unknown = JSON.parse(json)
    return isSharePayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function toExportJson(payload: SharePayload): string {
  return JSON.stringify(payload, null, 2)
}

export function fromImportJson(text: string): SharePayload | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return isSharePayload(parsed) ? parsed : null
  } catch {
    return null
  }
}
