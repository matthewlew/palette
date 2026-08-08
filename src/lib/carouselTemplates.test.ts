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
  templatesForCount,
  getTemplate,
  CAROUSEL_TEMPLATES,
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
    const [slide] = buildCarousel('wheatpaste', 6, { captionTile: false })
    // Paint order puts the centre last; pick order puts it first. Both are
    // true at once, and that is the point.
    expect(slide.slices[slide.slices.length - 1].index).toBe(0)
    expect(slide.slices.map((s) => s.index).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('marks the slide as overlapping, and declares no paper ground', () => {
    const [slide] = buildCarousel('wheatpaste', 5, { captionTile: false })
    expect(slide.overlap).toBe(true)
    // The sheets cover the slide themselves, so there is no wall to paint —
    // and a sliver of white between sheets would be louder than one of black.
    expect(slide.ground).toBeUndefined()
  })

  it('tops out at the number of pasting slots it has', () => {
    expect(getTemplate('wheatpaste')!.maxCount).toBe(WHEATPASTE_MAX)
    expect(buildCarousel('wheatpaste', WHEATPASTE_MAX + 1)).toEqual([])
  })
})

describe('buildCarousel', () => {
  it('appends the caption tile as the final slide by default', () => {
    const slides = buildCarousel('bars', 5)
    expect(slides).toHaveLength(2)
    expect(slides[0].kind).toBe('composite')
    expect(slides[1].kind).toBe('caption')
    expect(slides[1].slices).toEqual([])
  })

  it('omits the caption tile when turned off', () => {
    const slides = buildCarousel('bars', 5, { captionTile: false })
    expect(slides).toHaveLength(1)
    expect(slides.every((s) => s.kind === 'composite')).toBe(true)
  })

  it('numbers slices by pick order', () => {
    const [slide] = buildCarousel('bars', 4, { captionTile: false })
    expect(slide.slices.map((s) => s.index)).toEqual([0, 1, 2, 3])
  })

  it('emits one full-bleed slide per gradient for singles', () => {
    const slides = buildCarousel('singles', 4, { captionTile: false })
    expect(slides).toHaveLength(4)
    // Each slide is full-bleed and names one gradient, in pick order.
    slides.forEach((slide, i) => {
      expect(slide.slices).toEqual([{ x: 0, y: 0, w: 1, h: 1, index: i }])
    })
  })

  it('returns nothing for a count the template cannot hold', () => {
    // Grid tops out at 9; asking for 12 must not produce a broken carousel.
    expect(buildCarousel('grid', 12)).toEqual([])
    expect(buildCarousel('bars', 1)).toEqual([])
  })

  it('returns nothing for an unknown template', () => {
    expect(buildCarousel('nope', 4)).toEqual([])
  })
})

describe('templatesForCount', () => {
  it('offers only templates that fit the count', () => {
    for (const template of templatesForCount(5)) {
      expect(5).toBeGreaterThanOrEqual(template.minCount)
      expect(5).toBeLessThanOrEqual(template.maxCount)
    }
  })

  it('offers grid at every count it can hold, ragged rows included', () => {
    // The live preview in the picker means a ragged last row no longer has to
    // be hidden from the user — they can see it and decide.
    for (const n of [4, 5, 7, 9]) {
      expect(templatesForCount(n).map((t) => t.id)).toContain('grid')
    }
  })

  it('offers every layout at nine picks', () => {
    const ids = templatesForCount(9).map((t) => t.id)
    for (const id of ['singles', 'bars', 'grid', 'wheatpaste']) {
      expect(ids).toContain(id)
    }
  })

  it('always offers singles, so no count is ever a dead end', () => {
    // Every other template has a floor or a ceiling. Singles is the one that
    // holds any workable count, which is why the picker can fall back to it.
    for (let n = 1; n <= 12; n++) {
      expect(templatesForCount(n).map((t) => t.id)).toContain('singles')
    }
  })

  it('never offers a carousel that would exceed Instagram’s slide limit', () => {
    for (let n = 1; n <= 12; n++) {
      for (const template of templatesForCount(n)) {
        expect(buildCarousel(template.id, n).length).toBeLessThanOrEqual(MAX_SLIDES)
      }
    }
  })

  it('always has something to offer between 2 and 9 picks', () => {
    for (let n = 2; n <= 9; n++) {
      expect(templatesForCount(n).length).toBeGreaterThan(0)
    }
  })
})

describe('template registry', () => {
  it('has unique ids that all resolve', () => {
    const ids = CAROUSEL_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(getTemplate(id)).toBeDefined()
  })

  it('places every gradient on some slide, at every supported count', () => {
    for (const template of CAROUSEL_TEMPLATES) {
      for (let n = template.minCount; n <= template.maxCount; n++) {
        const slides = template.build(n)
        const placed = new Set(slides.flatMap((s) => s.slices.map((slice) => slice.index)))
        // A gradient the user picked and never sees exported is a silent drop.
        expect(placed.size).toBe(n)
      }
    }
  })
})
