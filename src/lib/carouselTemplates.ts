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

/** Fractional rect inside a slide. x/y/w/h are all 0..1.
 *
 * Tiling arrangements keep every rect inside 0..1 and never overlap. The
 * pasted arrangements (see `overlap`) deliberately do neither: their rects run
 * off the edges and sit on top of one another, which is the effect. */
export interface SliceRect {
  x: number
  y: number
  w: number
  h: number
  /** Degrees, clockwise, about the rect's own centre. Absent means square to
   * the slide, which is every tiling arrangement. */
  rotate?: number
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
  /** Empty for a caption slide.
   *
   * ARRAY ORDER IS PAINT ORDER. It matters only where slices overlap, and
   * there it is the whole trick: the wheatpaste's centre poster is last in
   * this array so it lands on top of the ones peeking out behind it. Which
   * gradient a slice shows is `index`, which is independent of paint order. */
  slices: SlicePlacement[]
  /** Slices intentionally overlap and hang off the edges, so the renderer
   * gives each one a paper edge and a drop shadow to read as a stack rather
   * than as a rendering error. */
  overlap?: boolean
  /** The ground the slices sit on. 'paper' for pasted layouts, which need a
   * wall to be pasted onto; absent means the usual full-bleed black, which no
   * tiling arrangement ever shows anyway. */
  ground?: 'paper'
}

/** How slices are arranged when a template packs several gradients into one
 * slide. Every arrangement covers the full slide; the framing gutter is
 * applied later by the renderer, not baked into these rects. */
export type ArrangementId = 'bars' | 'bands' | 'grid' | 'hero' | 'feature' | 'wheatpaste'

/** Arrangements that tile the slide edge to edge without overlapping. The
 * others (wheatpaste) are checked differently, since covering exactly once is
 * precisely what they do not do. */
export const TILING_ARRANGEMENTS: ArrangementId[] = ['bars', 'bands', 'grid', 'hero', 'feature']

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

/**
 * The first gradient across the top, the rest as a row of bars beneath it —
 * "1 + 2", "1 + 3", "1 + 4" and so on. `hero` puts the rest in a vertical rail
 * beside the lead; this puts them in a horizontal row under it, which is the
 * composition that holds up when the lead is landscape-ish rather than tall.
 *
 * The lead takes 62% of the height, matching the 0.618 split `hero` uses
 * horizontally, so the two read as the same idea turned on its side.
 */
export function featureRects(n: number): SliceRect[] {
  if (n <= 1) return [{ x: 0, y: 0, w: 1, h: 1 }]
  const split = 0.62
  const rest = barRects(n - 1).map((r) => ({
    x: r.x,
    y: split,
    w: r.w,
    h: 1 - split,
  }))
  return [{ x: 0, y: 0, w: 1, h: split }, ...rest]
}

/**
 * The centre poster, square-ish and near-centred with a whisper of rotation.
 * Everything else is pasted around and behind it.
 */
const WHEATPASTE_CENTRE: SliceRect = { x: 0.15, y: 0.16, w: 0.7, h: 0.68, rotate: -1.5 }

/**
 * Up to eight surrounding posters, in the order they get used.
 *
 * Every one of these deliberately breaks the rules the tiling arrangements
 * keep: each runs off an edge of the slide and each is overlapped by the
 * centre poster. That is what makes it read as paste-up rather than as a
 * layout — the eye completes the posters it can only partly see.
 *
 * Corners come first so a small count stays balanced (five posters shouldn't
 * all bunch along one side); the edge-centre slots fill in after. Rotations
 * are a few degrees either way and deliberately never equal, since a shared
 * angle reads as a transform applied to a group rather than as separate sheets
 * pasted by hand.
 */
const WHEATPASTE_AROUND: SliceRect[] = [
  // The four corners are each wide enough to reach past the middle, so any two
  // adjacent ones overlap. Sized that way deliberately: at 0.46 they met only
  // at the corners and left a symmetrical cross of bare wall showing at five
  // posters, which read as four sheets carefully placed rather than as a wall
  // that has been pasted over more than once.
  { x: -0.1, y: -0.14, w: 0.6, h: 0.62, rotate: -6.5 },
  { x: 0.52, y: 0.54, w: 0.62, h: 0.62, rotate: -4 },
  { x: 0.5, y: -0.16, w: 0.62, h: 0.64, rotate: 5.5 },
  { x: -0.12, y: 0.52, w: 0.6, h: 0.64, rotate: 7 },
  // Edge midpoints, layered over the seams the corners leave behind.
  { x: 0.24, y: -0.2, w: 0.52, h: 0.5, rotate: 2.5 },
  { x: 0.26, y: 0.72, w: 0.52, h: 0.5, rotate: -3.5 },
  { x: -0.2, y: 0.24, w: 0.48, h: 0.54, rotate: 4.5 },
  { x: 0.72, y: 0.22, w: 0.48, h: 0.54, rotate: -5.5 },
]

/** How many posters a wheatpaste can hold: the centre plus its surround. */
export const WHEATPASTE_MAX = WHEATPASTE_AROUND.length + 1

/**
 * A flyposted wall: one poster in the middle, the rest peeking out from behind
 * its edges, layered and slightly off-square.
 *
 * Returned in PAINT order — surround first, centre last — so the centre lands
 * on top. The caller re-attaches gradient indices, and does it by paint
 * position, so the first pick has to be the centre: see wheatpasteSlide.
 */
export function wheatpasteRects(n: number): SliceRect[] {
  const around = WHEATPASTE_AROUND.slice(0, Math.max(0, Math.min(n - 1, WHEATPASTE_AROUND.length)))
  return [...around, WHEATPASTE_CENTRE]
}

const ARRANGEMENTS: Record<ArrangementId, (n: number) => SliceRect[]> = {
  bars: barRects,
  bands: bandRects,
  grid: gridRects,
  hero: heroRects,
  feature: featureRects,
  wheatpaste: wheatpasteRects,
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

/**
 * The wheatpaste slide. Unlike every other arrangement, paint order and pick
 * order disagree: the first pick is the CENTRE poster, which has to be painted
 * last to sit on top of the ones behind it. So index 0 is attached to the
 * final rect and the surround takes 1..n-1 in order.
 */
function wheatpasteSlide(n: number): CarouselSlide {
  const rects = wheatpasteRects(n)
  const lastIndex = rects.length - 1
  return {
    kind: 'composite',
    overlap: true,
    ground: 'paper',
    slices: rects.map((rect, i) => ({
      ...rect,
      // The final rect is the centre and belongs to pick 1; the rest follow in
      // pick order behind it.
      index: i === lastIndex ? 0 : i + 1,
    })),
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
    description: 'A mosaic on one slide — 2×2, 3×3, or ragged',
    minCount: 3,
    maxCount: 9,
    // Every count in range is offered now that the picker shows a live preview
    // of the arrangement: a ragged last row stretches to full width and looks
    // fine, and with the layout on screen there is no reason to decide for the
    // user which counts are allowed to try it.
    build: (n) => [compositeSlide('grid', n)],
  },
  {
    id: 'hero',
    label: 'Hero + Rail',
    description: 'First pick large, the rest as a rail beside it',
    minCount: 2,
    maxCount: 9,
    build: (n) => [compositeSlide('hero', n)],
  },
  {
    id: 'feature',
    label: 'Feature + Row',
    description: 'First pick across the top, the rest in a row beneath',
    minCount: 2,
    maxCount: 9,
    build: (n) => [compositeSlide('feature', n)],
  },
  {
    id: 'wheatpaste',
    label: 'Wheatpaste',
    description: 'One poster centred, the rest pasted behind its edges',
    minCount: 3,
    maxCount: WHEATPASTE_MAX,
    build: (n) => [wheatpasteSlide(n)],
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
    id: 'wheatpaste-then-singles',
    label: 'Wheatpaste, then Singles',
    description: 'Pasted wall as the cover, then each pick full-bleed',
    minCount: 3,
    maxCount: WHEATPASTE_MAX,
    build: (n) => [wheatpasteSlide(n), ...singleSlides(n)],
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
    minCount: 3,
    maxCount: 9,
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
