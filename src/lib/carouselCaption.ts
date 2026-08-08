/**
 * Caption generation for a carousel of picked gradients.
 *
 * Two consumers, one source of truth: the plain-text caption you copy into
 * Instagram's caption field, and the rendered text tile that ships as the last
 * slide. They are built from the same `CaptionParts` so the tile can never
 * credit different colours than the caption does.
 *
 * Everything here is deterministic — the same picks in the same order always
 * produce the same caption, so re-opening the studio doesn't silently reword a
 * caption you already scheduled.
 */

import type { Gradient } from '../store/types'
import { SHAPE_LABELS } from './gradient'
import { namePalette } from './naming'

/** Instagram truncates the caption at 2,200 characters. */
export const CAPTION_MAX = 2200

export interface CaptionEntry {
  /** 1-based position in the carousel, matching the slide the gradient is on
   * (or its slice number within a composite slide). */
  position: number
  name: string
  shape: string
  hexes: string[]
}

export interface CaptionParts {
  title: string
  entries: CaptionEntry[]
  hashtags: string[]
}

/** The tags every palette post carries. Deliberately short and specific —
 * a wall of 30 generic tags reads as spam and suppresses reach. */
const BASE_HASHTAGS = [
  'gradient',
  'colorpalette',
  'colourinspiration',
  'designinspo',
  'colortheory',
  'abstractart',
]

/** Extra tags keyed on the shapes actually in the carousel, so a Turrell set
 * and a linear set don't post under identical tags. */
const SHAPE_HASHTAGS: Record<string, string> = {
  square: 'jamesturrell',
  angular: 'conicgradient',
  radial: 'radialgradient',
  linear: 'lineargradient',
  mirror: 'symmetry',
  fan: 'colorwheel',
  repeat: 'pattern',
}

function displayName(gradient: Gradient): string {
  return gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
}

/** Hex codes in the order the gradient renders them, uppercased — the form
 * people paste into a design tool. */
function hexList(gradient: Gradient): string[] {
  const ordered = [...gradient.stops].sort((a, b) => a.position - b.position)
  const hexes = ordered.map((s) => s.hex.toUpperCase())
  return gradient.reversed ? hexes.reverse() : hexes
}

export interface CaptionOptions {
  /** Overrides the generated title. Trimmed; blank falls back to the default. */
  title?: string
  /** Appended verbatim after the entries, before the hashtags. */
  note?: string
  hashtags?: boolean
}

/** Title when the user hasn't written one: names the set by its size and its
 * dominant shape, which is the only thing true of every pick. */
function defaultTitle(gradients: Gradient[]): string {
  const shapes = new Set(gradients.map((g) => g.type))
  const shapeWord =
    shapes.size === 1 ? SHAPE_LABELS[gradients[0].type] ?? gradients[0].type : 'Mixed'
  return `${gradients.length} ${shapeWord} Gradients`
}

export function captionParts(gradients: Gradient[], options: CaptionOptions = {}): CaptionParts {
  const title = options.title?.trim() || (gradients.length > 0 ? defaultTitle(gradients) : 'Palette')

  const entries = gradients.map((gradient, i) => ({
    position: i + 1,
    name: displayName(gradient),
    shape: SHAPE_LABELS[gradient.type] ?? gradient.type,
    hexes: hexList(gradient),
  }))

  const shapeTags = [...new Set(gradients.map((g) => SHAPE_HASHTAGS[g.type]).filter(Boolean))]
  const hashtags = options.hashtags === false ? [] : [...BASE_HASHTAGS, ...shapeTags]

  return { title, entries, hashtags }
}

/**
 * The copy-paste Instagram caption. Truncated at CAPTION_MAX on a line
 * boundary so a long set never produces a caption Instagram silently cuts
 * mid-hex.
 */
export function buildCaption(gradients: Gradient[], options: CaptionOptions = {}): string {
  if (gradients.length === 0) return ''
  const { title, entries, hashtags } = captionParts(gradients, options)

  const bodyLines: string[] = [title, '']
  for (const entry of entries) {
    bodyLines.push(`${entry.position}. ${entry.name} — ${entry.hexes.join(' · ')}`)
  }

  const note = options.note?.trim()
  if (note) bodyLines.push('', note)

  // Kept out of `bodyLines` so truncation can drop body lines while the tags —
  // the part that has to survive — stay attached.
  const tagBlock = hashtags.length > 0 ? `\n\n${hashtags.map((t) => `#${t}`).join(' ')}` : ''

  const caption = bodyLines.join('\n') + tagBlock
  if (caption.length <= CAPTION_MAX) return caption

  // Drop whole lines off the end until the body fits the remaining budget, so
  // a caption is never cut mid-hex.
  const budget = CAPTION_MAX - tagBlock.length
  const kept = [...bodyLines]
  while (kept.length > 1 && kept.join('\n').length > budget) kept.pop()
  return kept.join('\n') + tagBlock
}
