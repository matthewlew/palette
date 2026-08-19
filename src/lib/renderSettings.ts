import { FAN_ANCHORS, type FanAnchor } from './gradient'
import type { GradientCrop } from './gradientCrop'
import type { Gradient } from '../store/types'

/**
 * Everything about how a gradient renders that is not its colours, shape or
 * angle — the crop it is masked into and the effect toggles layered on top.
 *
 * These lived only in local storage and in share links. Anything that went
 * through the `palettes` table lost them, because `publishPalette` sent five
 * fields and none of these were among them: a circle-cropped gradient came
 * back a full-bleed rectangle with every effect off. Invisible for as long as
 * the shelf was purely local, then not: once saves round-trip through the
 * server (accounts plan §8 step 5), a sign-out and back in rebuilds the shelf
 * from rows, so the crop was lost on the user's own saved work too.
 *
 * One jsonb column rather than six typed ones. These are render flags that
 * nothing queries or sorts by, and they change as the render engine grows —
 * a column per toggle would mean a migration per effect.
 */
export interface RenderSettings {
  crop?: GradientCrop
  reversed?: boolean
  hardStops?: boolean
  repeatEnabled?: boolean
  smoothEnabled?: boolean
  prismEnabled?: boolean
  rainbowEnabled?: boolean
  ringEnabled?: boolean
  fanAnchor?: FanAnchor
}

const CROPS: GradientCrop[] = ['rectangle', 'circle', 'oval']

/**
 * The render settings worth persisting, or null when there are none.
 *
 * Defaults are omitted rather than written out as false, so a plain gradient
 * stores null and reads back exactly as rows published before this existed —
 * one behaviour for both, instead of "no settings" and "all settings off"
 * being different-looking states that have to agree.
 */
export function renderSettingsOf(gradient: Gradient): RenderSettings | null {
  const settings: RenderSettings = {}
  if (gradient.crop && gradient.crop !== 'rectangle') settings.crop = gradient.crop
  if (gradient.reversed) settings.reversed = true
  if (gradient.hardStops) settings.hardStops = true
  if (gradient.repeatEnabled) settings.repeatEnabled = true
  if (gradient.smoothEnabled) settings.smoothEnabled = true
  if (gradient.prismEnabled) settings.prismEnabled = true
  if (gradient.rainbowEnabled) settings.rainbowEnabled = true
  if (gradient.ringEnabled) settings.ringEnabled = true
  // Only when it differs from the historical default, which resolveFanConfig
  // already applies to a fan that names no anchor.
  if (gradient.fanAnchor && gradient.fanAnchor !== 'bottom') settings.fanAnchor = gradient.fanAnchor

  return Object.keys(settings).length > 0 ? settings : null
}

/**
 * A stored blob, back as settings. Validates rather than trusts: this is
 * jsonb, so the column can hold anything, and a bad `crop` string reaches the
 * render path as a shape nothing knows how to draw. Unknown keys and unknown
 * values are dropped, so an older client reading a newer row degrades to the
 * effects it understands instead of failing.
 */
export function parseRenderSettings(value: unknown): RenderSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const settings: RenderSettings = {}

  if (typeof raw.crop === 'string' && CROPS.includes(raw.crop as GradientCrop)) {
    settings.crop = raw.crop as GradientCrop
  }
  if (typeof raw.fanAnchor === 'string' && FAN_ANCHORS.includes(raw.fanAnchor as FanAnchor)) {
    settings.fanAnchor = raw.fanAnchor as FanAnchor
  }
  for (const flag of ['reversed', 'hardStops', 'repeatEnabled', 'smoothEnabled', 'prismEnabled', 'rainbowEnabled', 'ringEnabled'] as const) {
    if (raw[flag] === true) settings[flag] = true
  }

  return settings
}

/** True when two gradients would render identically given the same colours.
 *
 * Compares canonically — parsed, then key-sorted — because one side is
 * whatever came back from jsonb, where key order is not the order it was
 * written in and unknown keys may have crept in. */
export function sameRenderSettings(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}

function canonical(value: unknown): string {
  const parsed = parseRenderSettings(value) as Record<string, unknown>
  const keys = Object.keys(parsed).sort()
  return JSON.stringify(keys.map((k) => [k, parsed[k]]))
}
