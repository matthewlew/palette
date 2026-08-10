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

/** What a slide is for, which is what the sequence UI labels and what decides
 * whether a slide can be dragged. Body slides are the gradients and carry the
 * order; the cover and the summary are bookends that follow from it. */
export type SlideRole = 'cover' | 'body' | 'summary'

export interface CarouselSlide {
  kind: SlideKind
  role: SlideRole
  /** Empty for a caption slide.
   *
   * ARRAY ORDER IS PAINT ORDER. It matters only where slices overlap, and
   * there it is the whole trick: the wheatpaste's centre poster is last in
   * this array so it lands on top of the ones peeking out behind it. Which
   * gradient a slice shows is `index`, which is independent of paint order. */
  slices: SlicePlacement[]
  /** Slices intentionally overlap and hang off the edges, so the renderer
   * gives each one a drop shadow to read as a stack rather than as a
   * rendering error. */
  overlap?: boolean
  /** The ground the slices sit on. Absent means full-bleed black, which no
   * arrangement should ever actually show — a tiling one covers the slide
   * exactly, and a pasted one covers it by construction. */
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

/** How the optional cover slide packs every pick onto one image. */
export type CoverStyle = 'stack' | 'grid' | 'wheatpaste'

export interface CoverStyleSpec {
  id: CoverStyle
  label: string
  /** One line for the picker, describing what you get. */
  description: string
  /** Inclusive bounds on how many gradients this cover can hold. */
  minCount: number
  maxCount: number
  build: (n: number) => CarouselSlide
}

/** Instagram refuses a carousel with more than 20 slides, and a carousel is a
 * cover plus one slide per pick plus a summary. */
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
export const WHEATPASTE_CENTRE_RECT: SliceRect = { x: 0.15, y: 0.16, w: 0.7, h: 0.68, rotate: -1.5 }

/** How much the surround overhangs the slide on every side. The overhang is
 * what sells the paste-up: sheets that stop at the edge read as a layout. */
const WHEATPASTE_BLEED = 0.12

/** How much bigger than its share of the wall each sheet is drawn. Above 1
 * every neighbour overlaps, which is what closes the seams once the sheets are
 * tilted and nudged out of true. */
const WHEATPASTE_SPREAD = 1.34

/** Per-sheet tilt and nudge, indexed by position and cycled.
 *
 * Fixed tables rather than random: an export has to be reproducible, and a
 * carousel re-rendered tomorrow must not come back subtly rearranged. No two
 * adjacent tilts share a value or a sign — a repeated angle reads as one
 * transform applied to a group instead of sheets pasted up by hand. */
const WHEATPASTE_TILT = [-6.5, 5.5, -4, 7, 2.5, -5.5, 4.5, -3.5]
const WHEATPASTE_NUDGE_X = [0.022, -0.026, 0.014, -0.02, 0.03, -0.016, 0.024, -0.03]
const WHEATPASTE_NUDGE_Y = [-0.02, 0.026, 0.03, -0.028, 0.016, -0.022, -0.014, 0.024]

/** The centre poster plus eight sheets is as dense as the wall reads before
 * the surround is more edge than poster. */
export const WHEATPASTE_MAX = 9

/**
 * A flyposted wall: one poster in the middle, the rest pasted around and
 * behind it, layered and slightly off-square.
 *
 * The surround is derived from `gridRects`, not from a table of hand-placed
 * slots. A grid covers the wall exactly once by construction; pushing it out
 * past every edge by BLEED, inflating each cell by SPREAD, then tilting and
 * nudging each sheet turns that guaranteed cover into a paste-up while keeping
 * the guarantee — the wall is never visible through the gaps, at any count.
 * Hand-placed slots could not promise that: an earlier eight-slot table left a
 * cross of bare wall showing at five posters, because a fixed slot has no idea
 * how many of its neighbours actually got used.
 *
 * Returned in PAINT order — surround first, centre last — so the centre lands
 * on top. The caller re-attaches gradient indices by paint position, so the
 * first pick has to be the centre: see wheatpasteSlide.
 */
export function wheatpasteRects(n: number): SliceRect[] {
  const around = Math.max(0, Math.min(n - 1, WHEATPASTE_MAX - 1))
  if (around === 0) return [WHEATPASTE_CENTRE_RECT]

  const span = 1 + WHEATPASTE_BLEED * 2

  const sheets = gridRects(around).map((cell, i) => {
    // The cell's share of the wall, in the bled-out coordinate space.
    const w = cell.w * span * WHEATPASTE_SPREAD
    const h = cell.h * span * WHEATPASTE_SPREAD
    // Inflate about the cell's own centre so a sheet grows into its
    // neighbours rather than sliding away from its position.
    const cx = -WHEATPASTE_BLEED + (cell.x + cell.w / 2) * span
    const cy = -WHEATPASTE_BLEED + (cell.y + cell.h / 2) * span
    return {
      x: cx - w / 2 + WHEATPASTE_NUDGE_X[i % WHEATPASTE_NUDGE_X.length],
      y: cy - h / 2 + WHEATPASTE_NUDGE_Y[i % WHEATPASTE_NUDGE_Y.length],
      w,
      h,
      rotate: WHEATPASTE_TILT[i % WHEATPASTE_TILT.length],
    }
  })

  return [...sheets, WHEATPASTE_CENTRE_RECT]
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
    role: 'cover',
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
    role: 'cover',
    overlap: true,
    slices: rects.map((rect, i) => ({
      ...rect,
      // The final rect is the centre and belongs to pick 1; the rest follow in
      // pick order behind it.
      index: i === lastIndex ? 0 : i + 1,
    })),
  }
}

/**
 * The body: one full-bleed slide per gradient, in pick order.
 *
 * This is no longer one template among many — it IS the carousel, and the
 * cover and summary are optional bookends on it. That reshaping came from the
 * UI: once the running order and the slide preview became one list, "template"
 * stopped meaning anything a user could point at. What they can point at is a
 * sequence of slides, with two switches for whether it opens with a cover and
 * closes with a summary.
 */
export function bodySlides(n: number): CarouselSlide[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'composite' as const,
    role: 'body' as const,
    slices: [{ x: 0, y: 0, w: 1, h: 1, index: i }],
  }))
}

/**
 * The cover styles, each packing every pick onto one image.
 *
 * Three, because each is doing something the others cannot: bars for a set
 * meant to be read across, a mosaic for the counts that tile (4, 9), and the
 * flyposted wall for when the point is the pile. The layout maths for the
 * retired arrangements is kept above and still tested — adding one back is a
 * five-line entry here.
 */
export const COVER_STYLES: CoverStyleSpec[] = [
  {
    id: 'stack',
    label: 'Stack',
    description: 'Vertical bars across one slide',
    minCount: 2,
    maxCount: 10,
    build: (n) => compositeSlide('bars', n),
  },
  {
    id: 'grid',
    label: 'Grid',
    description: 'A mosaic — 2×2, 3×3, or ragged',
    minCount: 3,
    maxCount: 9,
    build: (n) => compositeSlide('grid', n),
  },
  {
    id: 'wheatpaste',
    label: 'Wheatpaste',
    description: 'One poster centred, the rest pasted behind its edges',
    minCount: 3,
    maxCount: WHEATPASTE_MAX,
    build: (n) => wheatpasteSlide(n),
  },
]

export function getCoverStyle(id: string): CoverStyleSpec | undefined {
  return COVER_STYLES.find((s) => s.id === id)
}

/** The cover styles that can hold this many picks. Empty is a real answer —
 * at one pick there is nothing to compose — and the caller drops the cover. */
export function coverStylesForCount(n: number): CoverStyleSpec[] {
  return COVER_STYLES.filter((s) => n >= s.minCount && n <= s.maxCount)
}

export interface BuildCarouselOptions {
  /** Open with a composite of every pick, in this style. Absent, or a style
   * that can't hold the count, means no cover slide. */
  cover?: CoverStyle | null
  /** Close with the rendered colophon tile. */
  summary?: boolean
}

/** How many picks still fit, given the bookends currently switched on. */
export function maxPicksFor(options: BuildCarouselOptions = {}): number {
  const bookends = (options.cover ? 1 : 0) + (options.summary === false ? 0 : 1)
  return MAX_SLIDES - bookends
}

/**
 * The full ordered slide list. Slide order IS export order — files are numbered
 * from this, and Instagram uploads in filename order.
 *
 * A cover style that can't hold the count is dropped rather than throwing or
 * emitting nothing: the picks are the carousel, and losing all of them because
 * a bookend no longer fits would be the wrong trade. The studio surfaces the
 * same fact by disabling that style's chip.
 */
export function buildCarousel(n: number, options: BuildCarouselOptions = {}): CarouselSlide[] {
  if (n <= 0) return []

  const summary = options.summary !== false
  const style = options.cover ? getCoverStyle(options.cover) : undefined
  const cover = style && n >= style.minCount && n <= style.maxCount ? style.build(n) : null

  const body = bodySlides(Math.min(n, maxPicksFor({ cover: cover ? options.cover : null, summary })))

  return [
    ...(cover ? [cover] : []),
    ...body,
    ...(summary ? [{ kind: 'caption' as const, role: 'summary' as const, slices: [] }] : []),
  ]
}
