import type { FanAnchor, GradientType } from './gradient'
import { FAN_ANCHORS } from './gradient'
import type { GradientStop } from './gradient'
import type { Gradient } from '../store/types'

/** Drum's ink-coverage metadata, carried as one added key on the shared
 * gradient envelope (PRD §5.1). `inks` are ink names (drum-picker identity,
 * not hex — the catalogue that resolves a name to a hex doesn't exist in this
 * codebase yet), `coverage` is gradient-level and parallel to `stops`, one row
 * of per-ink percentages (0-100) per stop. */
export interface RisoData {
  inks: string[]
  coverage: number[][]
}

export interface SharePayloadGradient {
  type: GradientType
  stops: GradientStop[]
  reversed?: boolean
  repeatEnabled?: boolean
  hardStops?: boolean
  smoothEnabled?: boolean
  fanAnchor?: FanAnchor
  name: string
  riso?: RisoData
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
  if (gradient.smoothEnabled !== undefined) out.smoothEnabled = gradient.smoothEnabled
  if (gradient.fanAnchor !== undefined) out.fanAnchor = gradient.fanAnchor
  if (gradient.riso !== undefined) out.riso = gradient.riso
  return out
}

/** Builds a fresh Gradient from an imported wire payload, copying only the
 * known SharePayloadGradient fields — stale keys from old share links or
 * exports (e.g. the removed flutedEnabled) never reach app
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
  if (g.smoothEnabled !== undefined) out.smoothEnabled = g.smoothEnabled
  if (g.fanAnchor !== undefined) out.fanAnchor = g.fanAnchor
  // Rebuilt for the same reason `stops` is: a hand-crafted payload's `riso`
  // object could otherwise carry extra keys straight into persisted state.
  if (g.riso !== undefined) out.riso = { inks: [...g.riso.inks], coverage: g.riso.coverage.map((row) => [...row]) }
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
    v.stops.length <= 32 &&
    v.stops.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        isHexColor((s as Record<string, unknown>).hex) &&
        isStopPosition((s as Record<string, unknown>).position)
    ) &&
    typeof v.name === 'string' &&
    v.name.length <= 80 &&
    (v.reversed === undefined || typeof v.reversed === 'boolean') &&
    (v.repeatEnabled === undefined || typeof v.repeatEnabled === 'boolean') &&
    (v.hardStops === undefined || typeof v.hardStops === 'boolean') &&
    (v.smoothEnabled === undefined || typeof v.smoothEnabled === 'boolean') &&
    (v.fanAnchor === undefined || FAN_ANCHORS.includes(v.fanAnchor as FanAnchor)) &&
    (v.riso === undefined || isRisoData(v.riso, v.stops.length))
  )
}

// Generous ceiling on ink count — no drum picker UI allows anywhere near
// this many drums; it exists only to give a crafted payload's arrays a firm
// bound, same spirit as the 32-stop cap above.
const MAX_INKS = 8

/** Validates a `riso` block against the same discipline `isSharePayloadGradient`
 * already applies to hex strings (PRD §5.3): every field type- and range-
 * checked, `coverage` array-length-matched to `stopCount`, no unbounded
 * arrays. This does NOT check `coverage` against `stops[i].hex` for
 * consistency — that check needs an ink-name → hex catalogue, which doesn't
 * exist in this codebase yet (PRD §4, "ink catalogue" is separate, unbuilt
 * scope). Until it exists, `hex` stays the sole source of truth for
 * rendering and `riso` is informational only; a future PR that adds the
 * catalogue should flag a mismatch as an import error, not silently
 * recompute one side from the other (PRD §3.7). */
function isRisoData(value: unknown, stopCount: number): value is RisoData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.inks) || v.inks.length === 0 || v.inks.length > MAX_INKS) return false
  if (!v.inks.every((name) => typeof name === 'string' && name.length > 0 && name.length <= 60)) return false
  const inkCount = v.inks.length
  return (
    Array.isArray(v.coverage) &&
    v.coverage.length === stopCount &&
    v.coverage.every(
      (row) =>
        Array.isArray(row) &&
        row.length === inkCount &&
        row.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)
    )
  )
}

const GRADIENT_TYPES: GradientType[] = ['linear', 'radial', 'angular', 'square', 'mirror', 'repeat', 'fan']

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
    v.gradients.length <= 50 &&
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
