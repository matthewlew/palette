import type { GradientType } from './gradient'

/* Searching by shape.
 *
 * Search matched display names only, so the one attribute every palette
 * definitely has — its geometry — was unsearchable. Typing "radial" found the
 * handful of palettes whose generated NAME happened to contain the word, and
 * missed every actual radial gradient.
 *
 * This lives in its own module because both search paths need it and they run
 * in different places: the local pass filters an in-memory array, the community
 * pass builds a Supabase query. Every previous time this codebase expressed one
 * rule in two places (angular's compression, Turrell's extent, mirror's fold)
 * the copies drifted. One vocabulary, two consumers.
 */

/** What people actually type, per shape.
 *
 * Both singular and plural are listed rather than stemmed: stemming "lines" ->
 * "line" is easy, but "boxes" -> "box" and "rays" -> "ray" need real rules, and
 * a wrong stem silently matches nothing. A literal list is dull and correct.
 *
 * `repeat` is absent on purpose — it is not user-selectable (the Repeat x2
 * filter replaced it) so nothing new carries that shape, and offering it as a
 * search term would surface only legacy rows. */
const SHAPE_WORDS: Record<Exclude<GradientType, 'repeat'>, string[]> = {
  linear: ['linear', 'line', 'lines', 'stripe', 'stripes', 'striped', 'straight', 'band', 'bands'],
  radial: ['radial', 'circle', 'circles', 'circular', 'round', 'ring', 'rings', 'orb', 'halo'],
  angular: ['angular', 'conic', 'sweep', 'pinwheel', 'wheel', 'spiral'],
  square: ['square', 'squares', 'turrell', 'block', 'blocks', 'box', 'boxes', 'nested', 'rothko'],
  mirror: ['mirror', 'mirrored', 'reflect', 'reflected', 'reflection', 'symmetry', 'symmetric'],
  fan: ['fan', 'fanned', 'cone', 'ray', 'rays', 'beam', 'beams', 'wedge', 'wedges'],
}

const WORD_TO_SHAPE: Record<string, GradientType> = Object.fromEntries(
  Object.entries(SHAPE_WORDS).flatMap(([shape, words]) =>
    words.map((w) => [w, shape as GradientType]),
  ),
)

export interface ParsedQuery {
  /** Shapes named in the query. Empty when none were. */
  shapes: GradientType[]
  /** Everything that wasn't a shape word — matched against the name. */
  terms: string[]
}

/**
 * Splits a query into the shapes it names and the words left over.
 *
 * "warm radial" -> shapes [radial], terms ["warm"]
 * "radial circular" -> shapes [radial], terms []          (deduped)
 * "lines mirror" -> shapes [linear, mirror], terms []      (either, not both)
 * "clay" -> shapes [], terms ["clay"]
 *
 * Multiple shapes are treated as OR because a gradient has exactly one shape,
 * so requiring all of them could only ever return nothing.
 */
export function parseQuery(query: string): ParsedQuery {
  const shapes: GradientType[] = []
  const terms: string[] = []
  for (const word of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const shape = WORD_TO_SHAPE[word]
    if (shape) {
      if (!shapes.includes(shape)) shapes.push(shape)
    } else {
      terms.push(word)
    }
  }
  return { shapes, terms }
}

/** Every word the shape vocabulary knows, for tests and for anything that wants
 * to offer suggestions later. */
export function shapeVocabulary(): string[] {
  return Object.keys(WORD_TO_SHAPE)
}
