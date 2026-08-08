/**
 * Carousel templates: how an ordered pick of N gradients becomes an ordered
 * list of Instagram slides.
 *
 * The unit of composition is a *slice* — a rectangle inside one slide that a
 * single gradient is rendered into. A template says (a) how many slides to
 * emit and (b) for each slide, which gradients fill which slices. Rendering
 * (canvas) and the caption text live elsewhere; everything here is pure
 * arithmetic so the layouts can be tested without a canvas.
 *
 * Slice rects are returned in *fractions* of the slide, not pixels, so the
 * same template renders identically at 1080x1350, 1080x1080 and 1080x1920.
 */

/** Fractional rect inside a slide. x/y/w/h are all 0..1. */
export interface SliceRect {
  x: number
  y: number
  w: number
  h: number
}

/** One gradient placed in one slice of a slide. `index` is the gradient's
 * position in the user's pick order, which is what the caption numbering and
 * the export filenames key off. */
export interface SlicePlacement extends SliceRect {
  index: number
}

export type SlideKind = 'composite' | 'caption'

export interface CarouselSlide {
  kind: SlideKind
  /** Empty for a caption slide. */
  slices: SlicePlacement[]
}

/** How slices are arranged when a template packs several gradients into one
 * slide. Every arrangement covers the full slide; the framing gutter is
 * applied later by the renderer, not baked into these rects. */
export type ArrangementId = 'bars' | 'bands' | 'grid' | 'hero'

export interface CarouselTemplate {
  id: string
  label: string
  /** One line for the picker, describing what you get. */
  description: string
  /** Inclusive bounds on how many gradients this template accepts. */
  minCount: number
  maxCount: number
  /** Only counts satisfying this are offered — `grid` wants a count that
   * actually fills its rows. Absent means "any count in range". */
  prefers?: (n: number) => boolean
  build: (n: number) => CarouselSlide[]
}

/** Instagram refuses a carousel with more than 20 slides. Templates that emit
 * a cover plus one slide per gradient are capped so the caption tile still
 * fits. */
export const MAX_SLIDES = 20

/**
 * N vertical bars across the slide. The last bar absorbs the rounding
 * remainder so the arrangement always reaches x = 1 exactly — otherwise a
 * sub-pixel seam of background shows down the right edge.
 */
export function barRects(n: number): SliceRect[] {
  const rects: SliceRect[] = []
  for (let i = 0; i < n; i++) {
    const x = i / n
    const next = (i + 1) / n
    rects.push({ x, y: 0, w: next - x, h: 1 })
  }
  return rects
}

/** N horizontal bands down the slide — `barRects` with the axes swapped. */
export function bandRects(n: number): SliceRect[] {
  return barRects(n).map((r) => ({ x: r.y, y: r.x, w: r.h, h: r.w }))
}

/**
 * A near-square grid. Columns are ceil(sqrt(n)), so 4 -> 2x2 and 9 -> 3x3, the
 * two counts that also tile cleanly into an Instagram profile row.
 *
 * A count that doesn't fill its last row (5, 7, 8...) stretches the survivors
 * to span the full width rather than leaving a hole — a gap in a gradient
 * mosaic reads as a rendering bug, not as negative space.
 */
export function gridRects(n: number): SliceRect[] {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const rects: SliceRect[] = []
  for (let row = 0; row < rows; row++) {
    const first = row * cols
    const inRow = Math.min(cols, n - first)
    const y = row / rows
    const h = (row + 1) / rows - y
    for (let col = 0; col < inRow; col++) {
      const x = col / inRow
      const w = (col + 1) / inRow - x
      rects.push({ x, y, w, h })
    }
  }
  return rects
}

/**
 * The first gradient takes the left ~62% full height; the rest stack as bands
 * down the right. Reads as a lead image with a swatch rail beside it, which is
 * the layout that survives being scrolled past at thumbnail size.
 */
export function heroRects(n: number): SliceRect[] {
  if (n <= 1) return [{ x: 0, y: 0, w: 1, h: 1 }]
  const split = 0.618
  const rest = bandRects(n - 1).map((r) => ({
    x: split,
    y: r.y,
    w: 1 - split,
    h: r.h,
  }))
  return [{ x: 0, y: 0, w: split, h: 1 }, ...rest]
}

const ARRANGEMENTS: Record<ArrangementId, (n: number) => SliceRect[]> = {
  bars: barRects,
  bands: bandRects,
  grid: gridRects,
  hero: heroRects,
}

export function arrange(id: ArrangementId, n: number): SliceRect[] {
  return ARRANGEMENTS[id](n)
}

/** One slide holding all N gradients in the given arrangement. */
function compositeSlide(id: ArrangementId, n: number): CarouselSlide {
  return {
    kind: 'composite',
    slices: arrange(id, n).map((rect, i) => ({ ...rect, index: i })),
  }
}

/** One full-bleed slide per gradient, in pick order. */
function singleSlides(n: number): CarouselSlide[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'composite' as const,
    slices: [{ x: 0, y: 0, w: 1, h: 1, index: i }],
  }))
}

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: 'bars',
    label: 'Vertical Stack',
    description: 'All picks as vertical bars across one slide',
    minCount: 2,
    maxCount: 10,
    build: (n) => [compositeSlide('bars', n)],
  },
  {
    id: 'bands',
    label: 'Horizontal Bands',
    description: 'All picks as horizontal bands down one slide',
    minCount: 2,
    maxCount: 10,
    build: (n) => [compositeSlide('bands', n)],
  },
  {
    id: 'grid',
    label: 'Grid',
    description: 'A 2×2 / 3×3 mosaic on one slide',
    minCount: 4,
    maxCount: 9,
    // Only offered at counts that fill every row — a ragged mosaic is what
    // `bars` and `hero` are for.
    prefers: (n) => Number.isInteger(Math.sqrt(n)) || n === 6 || n === 8,
    build: (n) => [compositeSlide('grid', n)],
  },
  {
    id: 'hero',
    label: 'Hero + Rail',
    description: 'First pick large, the rest as a rail beside it',
    minCount: 3,
    maxCount: 8,
    build: (n) => [compositeSlide('hero', n)],
  },
  {
    id: 'singles',
    label: 'One Per Slide',
    description: 'Every pick full-bleed, one slide each',
    minCount: 1,
    maxCount: MAX_SLIDES - 1,
    build: (n) => singleSlides(n),
  },
  {
    id: 'stack-then-singles',
    label: 'Stack, then Singles',
    description: 'Vertical stack as the cover, then each pick full-bleed',
    minCount: 2,
    maxCount: 9,
    build: (n) => [compositeSlide('bars', n), ...singleSlides(n)],
  },
  {
    id: 'grid-then-singles',
    label: 'Grid, then Singles',
    description: 'Mosaic cover, then each pick full-bleed',
    minCount: 4,
    maxCount: 9,
    prefers: (n) => Number.isInteger(Math.sqrt(n)) || n === 6 || n === 8,
    build: (n) => [compositeSlide('grid', n), ...singleSlides(n)],
  },
]

export function getTemplate(id: string): CarouselTemplate | undefined {
  return CAROUSEL_TEMPLATES.find((t) => t.id === id)
}

/**
 * The templates worth showing for a given pick count — the whole point of
 * choosing a count first. A template that can't hold N, or that would blow the
 * 20-slide ceiling once the caption tile is added, is not offered rather than
 * offered-and-broken.
 */
export function templatesForCount(n: number): CarouselTemplate[] {
  return CAROUSEL_TEMPLATES.filter((t) => {
    if (n < t.minCount || n > t.maxCount) return false
    if (t.prefers && !t.prefers(n)) return false
    return t.build(n).length + 1 <= MAX_SLIDES
  })
}

export interface BuildCarouselOptions {
  /** Append the rendered caption tile as the final slide. */
  captionTile?: boolean
}

/**
 * The full ordered slide list for a pick count. Slide order IS export order —
 * files are numbered from this, and Instagram uploads in filename order.
 *
 * Returns an empty list for a count the template can't hold, so callers get
 * "nothing to export" rather than a malformed carousel.
 */
export function buildCarousel(
  templateId: string,
  n: number,
  options: BuildCarouselOptions = {}
): CarouselSlide[] {
  const template = getTemplate(templateId)
  if (!template || n < template.minCount || n > template.maxCount) return []
  const slides = template.build(n)
  if (options.captionTile === false) return slides
  return [...slides, { kind: 'caption', slices: [] }]
}
