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

/** Builds a fresh Gradient from an imported wire payload, copying only the
 * known SharePayloadGradient fields — stale keys from old share links or
 * exports (e.g. the removed smoothEnabled/flutedEnabled) never reach app
 * state, which persists to localStorage. */
export function importGradient(g: SharePayloadGradient): Gradient {
  const out: Gradient = {
    id: crypto.randomUUID(),
    type: g.type,
    // Rebuilt (not copied by reference) so extra keys on stop objects from
    // hand-crafted payloads can't ride into persisted state.
    stops: g.stops.map((s) => ({ hex: s.hex, position: s.position })),
    name: g.name,
  }
  if (g.reversed !== undefined) out.reversed = g.reversed
  if (g.repeatEnabled !== undefined) out.repeatEnabled = g.repeatEnabled
  if (g.hardStops !== undefined) out.hardStops = g.hardStops
  return out
}

export function isSharePayloadGradient(value: unknown): value is SharePayloadGradient {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    GRADIENT_TYPES.includes(v.type as GradientType) &&
    Array.isArray(v.stops) &&
    // buildGradientCss asserts >= 2 stops, so anything shorter would render
    // fine in the import banner and then crash-loop the app once saved.
    v.stops.length >= 2 &&
    v.stops.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        isHexColor((s as Record<string, unknown>).hex) &&
        isStopPosition((s as Record<string, unknown>).position)
    ) &&
    typeof v.name === 'string'
  )
}

const GRADIENT_TYPES: GradientType[] = ['linear', 'radial', 'angular', 'square', 'mirror', 'repeat']

// Strict hex check: the value is interpolated into CSS backgroundImage, so a
// free-form string in a crafted share link could inject url() and leak the
// viewer's IP to a remote host.
function isHexColor(value: unknown): boolean {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
}

function isStopPosition(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
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
