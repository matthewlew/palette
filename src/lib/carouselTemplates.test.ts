import { describe, it, expect } from 'vitest'
import {
  barRects,
  bandRects,
  gridRects,
  heroRects,
  featureRects,
  wheatpasteRects,
  arrange,
  buildCarousel,
  bodySlides,
  coverStylesForCount,
  getCoverStyle,
  maxPicksFor,
  COVER_STYLES,
  MAX_SLIDES,
  TILING_ARRANGEMENTS,
  WHEATPASTE_MAX,
  WHEATPASTE_CENTRE_RECT,
  type SliceRect,
} from './carouselTemplates'

/** Total area of a set of fractional rects. A full-cover arrangement is 1. */
function area(rects: SliceRect[]): number {
  return rects.reduce((sum, r) => sum + r.w * r.h, 0)
}

/** Whether a rect contains a point, honouring the rect's own rotation: the
 * point is rotated back into the rect's frame about the rect's centre. */
function covers(rect: SliceRect, px: number, py: number): boolean {
  const EPS = 1e-9
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const theta = ((rect.rotate ?? 0) * Math.PI) / 180
  const dx = px - cx
  const dy = py - cy
  const localX = dx * Math.cos(-theta) - dy * Math.sin(-theta)
  const localY = dx * Math.sin(-theta) + dy * Math.cos(-theta)
  return Math.abs(localX) <= rect.w / 2 + EPS && Math.abs(localY) <= rect.h / 2 + EPS
}

function overlaps(a: SliceRect, b: SliceRect): boolean {
  const EPS = 1e-9
  return (
    a.x + a.w > b.x + EPS &&
    b.x + b.w > a.x + EPS &&
    a.y + a.h > b.y + EPS &&
    b.y + b.h > a.y + EPS
  )
}

describe('tiling arrangements', () => {
  // Driven off TILING_ARRANGEMENTS rather than a local list, so a new tiling
  // arrangement is covered by these invariants the moment it is registered.
  for (const name of TILING_ARRANGEMENTS) {
    const fn = (n: number) => arrange(name, n)
    describe(name, () => {
      it('returns exactly one rect per gradient', () => {
        for (let n = 2; n <= 10; n++) {
          expect(fn(n)).toHaveLength(n)
        }
      })

      it('covers the whole slide with no overlap', () => {
        for (let n = 2; n <= 10; n++) {
          const rects = fn(n)
          // A gap shows as background bleeding through; an overlap means one
          // gradient is silently painted over another.
          expect(area(rects)).toBeCloseTo(1, 8)
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              expect(overlaps(rects[i], rects[j])).toBe(false)
            }
          }
        }
      })

      it('stays inside the slide', () => {
        for (const rect of fn(7)) {
          expect(rect.x).toBeGreaterThanOrEqual(0)
          expect(rect.y).toBeGreaterThanOrEqual(0)
          expect(rect.x + rect.w).toBeLessThanOrEqual(1 + 1e-9)
          expect(rect.y + rect.h).toBeLessThanOrEqual(1 + 1e-9)
        }
      })

      it('is square to the slide', () => {
        // Rotation belongs to the pasted arrangements; a tilted bar is a bug.
        for (const rect of fn(5)) expect(rect.rotate).toBeUndefined()
      })
    })
  }

  it('bars reach the right edge exactly', () => {
    const rects = barRects(3)
    const last = rects[rects.length - 1]
    expect(last.x + last.w).toBeCloseTo(1, 12)
  })

  it('bands are bars with the axes swapped', () => {
    const bars = barRects(4)
    const bands = bandRects(4)
    bands.forEach((band, i) => {
      expect(band.y).toBeCloseTo(bars[i].x, 12)
      expect(band.h).toBeCloseTo(bars[i].w, 12)
      expect(band.w).toBe(1)
    })
  })

  it('lays a perfect square out as a true grid', () => {
    // 4 -> 2x2, 9 -> 3x3: the counts that also tile an Instagram profile row.
    expect(new Set(gridRects(4).map((r) => r.x)).size).toBe(2)
    expect(new Set(gridRects(4).map((r) => r.y)).size).toBe(2)
    expect(new Set(gridRects(9).map((r) => r.y)).size).toBe(3)
  })

  it('stretches a short final row rather than leaving a hole', () => {
    // 5 is 3 columns then 2 — the two stretch to half-width each.
    const rects = gridRects(5)
    const lastRow = rects.filter((r) => r.y > 0.4)
    expect(lastRow).toHaveLength(2)
    expect(lastRow[0].w).toBeCloseTo(0.5, 8)
  })

  it('gives the hero the larger share', () => {
    const rects = heroRects(4)
    expect(rects[0].w).toBeGreaterThan(0.5)
    expect(rects[0].h).toBe(1)
    rects.slice(1).forEach((r) => expect(r.x).toBeCloseTo(rects[0].w, 8))
  })

  it('gives a single gradient the whole slide in hero', () => {
    expect(heroRects(1)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }])
    expect(featureRects(1)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }])
  })

  it('gives the feature the top band and the rest a row beneath', () => {
    const rects = featureRects(4)
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 1, h: 0.62 })
    // The remaining three share one row, all starting at the split.
    rects.slice(1).forEach((r) => {
      expect(r.y).toBeCloseTo(0.62, 8)
      expect(r.h).toBeCloseTo(0.38, 8)
    })
    expect(new Set(rects.slice(1).map((r) => r.x)).size).toBe(3)
  })

  it('lays hero and feature out as the same split on opposite axes', () => {
    // Both are "one large, the rest small"; only the axis differs.
    expect(heroRects(3)[0].h).toBe(1)
    expect(featureRects(3)[0].w).toBe(1)
  })
})

describe('wheatpaste', () => {
  it('places the centre poster last, and centred', () => {
    for (let n = 3; n <= WHEATPASTE_MAX; n++) {
      const rects = wheatpasteRects(n)
      const centre = rects[rects.length - 1]
      expect(centre).toBe(WHEATPASTE_CENTRE_RECT)
      expect(centre.x + centre.w / 2).toBeCloseTo(0.5, 1)
      expect(centre.y + centre.h / 2).toBeCloseTo(0.5, 1)
    }
    // Deliberately NOT asserting the centre is the largest rect. Once the
    // surround has to cover the wall, three sheets means each is huge — a
    // background sheet can out-measure the centre and it still reads right,
    // because paint order, not area, is what makes the centre the subject.
  })

  it('returns one rect per gradient', () => {
    for (let n = 3; n <= WHEATPASTE_MAX; n++) {
      expect(wheatpasteRects(n)).toHaveLength(n)
    }
  })

  it('overhangs every edge of the slide', () => {
    // The peeking-out is the effect: sheets that stopped at the frame would
    // read as a badly aligned collage instead of a paste-up.
    const sheets = wheatpasteRects(WHEATPASTE_MAX).slice(0, -1)
    expect(sheets.some((r) => r.x < 0)).toBe(true)
    expect(sheets.some((r) => r.y < 0)).toBe(true)
    expect(sheets.some((r) => r.x + r.w > 1)).toBe(true)
    expect(sheets.some((r) => r.y + r.h > 1)).toBe(true)
  })

  it('covers the whole slide at every count, tilts included', () => {
    // The guarantee the grid-derived surround exists to provide: no wall
    // showing through, ever. Sampled against the ROTATED sheets, since a tilt
    // is exactly what could open a corner that the untilted maths closes.
    for (let n = 3; n <= WHEATPASTE_MAX; n++) {
      const rects = wheatpasteRects(n)
      for (let i = 0; i <= 40; i++) {
        for (let j = 0; j <= 40; j++) {
          const px = i / 40
          const py = j / 40
          expect(
            rects.some((r) => covers(r, px, py)),
            `n=${n} leaves (${px.toFixed(3)}, ${py.toFixed(3)}) uncovered`
          ).toBe(true)
        }
      }
    }
  })

  it('tilts every poster, and never by the same angle twice', () => {
    const rotations = wheatpasteRects(WHEATPASTE_MAX).map((r) => r.rotate)
    for (const rotation of rotations) {
      expect(rotation).toBeTypeOf('number')
      expect(Math.abs(rotation as number)).toBeGreaterThan(0)
      // Small enough to read as hand-pasted rather than as a scattered deck.
      expect(Math.abs(rotation as number)).toBeLessThan(10)
    }
    expect(new Set(rotations).size).toBe(rotations.length)
  })

  it('gives the first pick the centre poster', () => {
    const slide = getCoverStyle('wheatpaste')!.build(6)
    // Paint order puts the centre last; pick order puts it first. Both are
    // true at once, and that is the point.
    expect(slide.slices[slide.slices.length - 1].index).toBe(0)
    expect(slide.slices.map((s) => s.index).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('marks the slide as overlapping, and declares no paper ground', () => {
    const slide = getCoverStyle('wheatpaste')!.build(5)
    expect(slide.overlap).toBe(true)
    // The sheets cover the slide themselves, so there is no wall to paint —
    // and a sliver of white between sheets would be louder than one of black.
    expect(slide.ground).toBeUndefined()
  })

  it('tops out at the number of pasting slots it has', () => {
    expect(getCoverStyle('wheatpaste')!.maxCount).toBe(WHEATPASTE_MAX)
    // Past its ceiling the cover is dropped, not forced — the picks are the
    // carousel, and losing them all to a bookend would be the wrong trade.
    const slides = buildCarousel(WHEATPASTE_MAX + 1, { cover: 'wheatpaste', summary: false })
    expect(slides.every((s) => s.role === 'body')).toBe(true)
  })
})

describe('buildCarousel', () => {
  it('is one slide per pick, with a summary tile closing it by default', () => {
    const slides = buildCarousel(4)
    expect(slides.map((s) => s.role)).toEqual(['body', 'body', 'body', 'body', 'summary'])
    expect(slides[4].kind).toBe('caption')
    expect(slides[4].slices).toEqual([])
  })

  it('omits the summary tile when turned off', () => {
    const slides = buildCarousel(4, { summary: false })
    expect(slides).toHaveLength(4)
    expect(slides.every((s) => s.role === 'body')).toBe(true)
  })

  it('opens with a cover composed of every pick when asked', () => {
    const slides = buildCarousel(4, { cover: 'grid', summary: false })
    expect(slides.map((s) => s.role)).toEqual(['cover', 'body', 'body', 'body', 'body'])
    // The cover holds all four; the body still shows them one at a time.
    expect(slides[0].slices.map((s) => s.index)).toEqual([0, 1, 2, 3])
  })

  it('numbers body slices by pick order', () => {
    const slides = buildCarousel(4, { summary: false })
    slides.forEach((slide, i) => {
      expect(slide.slices).toEqual([{ x: 0, y: 0, w: 1, h: 1, index: i }])
    })
  })

  it('drops a cover the count has outgrown rather than emitting nothing', () => {
    // Grid tops out at 9. The picks are the carousel; the bookend is not.
    const slides = buildCarousel(12, { cover: 'grid', summary: false })
    expect(slides).toHaveLength(12)
    expect(slides.every((s) => s.role === 'body')).toBe(true)
  })

  it('drops a cover the count is too small for', () => {
    // Grid needs three; two picks get the body alone, not a broken mosaic.
    const slides = buildCarousel(2, { cover: 'grid', summary: false })
    expect(slides.every((s) => s.role === 'body')).toBe(true)
  })

  it('returns nothing when nothing is picked', () => {
    expect(buildCarousel(0)).toEqual([])
    expect(buildCarousel(0, { cover: 'stack', summary: true })).toEqual([])
  })

  it('never exceeds Instagram’s slide limit, whatever the bookends', () => {
    for (const cover of [null, 'stack', 'grid', 'wheatpaste'] as const) {
      for (const summary of [true, false]) {
        expect(buildCarousel(40, { cover, summary }).length).toBeLessThanOrEqual(MAX_SLIDES)
      }
    }
  })

  it('spends the slide budget on bookends before picks', () => {
    // Turning both on costs two picks, and the ceiling is Instagram's, not
    // ours — so the studio can warn instead of silently truncating.
    expect(maxPicksFor({})).toBe(MAX_SLIDES - 1)
    expect(maxPicksFor({ cover: 'stack', summary: true })).toBe(MAX_SLIDES - 2)
    expect(maxPicksFor({ cover: null, summary: false })).toBe(MAX_SLIDES)
  })
})

describe('bodySlides', () => {
  it('gives every pick a full-bleed slide of its own', () => {
    const slides = bodySlides(3)
    expect(slides).toHaveLength(3)
    expect(slides.every((s) => s.role === 'body' && s.kind === 'composite')).toBe(true)
  })
})

describe('coverStylesForCount', () => {
  it('offers only styles that fit the count', () => {
    for (const style of coverStylesForCount(5)) {
      expect(5).toBeGreaterThanOrEqual(style.minCount)
      expect(5).toBeLessThanOrEqual(style.maxCount)
    }
  })

  it('offers grid at every count it can hold, ragged rows included', () => {
    // The live preview in the picker means a ragged last row no longer has to
    // be hidden from the user — they can see it and decide.
    for (const n of [4, 5, 7, 9]) {
      expect(coverStylesForCount(n).map((s) => s.id)).toContain('grid')
    }
  })

  it('offers every style at nine picks', () => {
    const ids = coverStylesForCount(9).map((s) => s.id)
    for (const id of COVER_STYLES.map((s) => s.id)) {
      expect(ids).toContain(id)
    }
  })

  it('offers nothing at one pick, since there is nothing to compose', () => {
    expect(coverStylesForCount(1)).toEqual([])
  })
})
