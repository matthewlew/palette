import { describe, it, expect } from 'vitest'
import {
  barRects,
  bandRects,
  gridRects,
  heroRects,
  buildCarousel,
  templatesForCount,
  getTemplate,
  CAROUSEL_TEMPLATES,
  MAX_SLIDES,
  type SliceRect,
} from './carouselTemplates'

/** Total area of a set of fractional rects. A full-cover arrangement is 1. */
function area(rects: SliceRect[]): number {
  return rects.reduce((sum, r) => sum + r.w * r.h, 0)
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

describe('arrangements', () => {
  const ARRANGEMENTS = {
    bars: barRects,
    bands: bandRects,
    grid: gridRects,
    hero: heroRects,
  }

  for (const [name, fn] of Object.entries(ARRANGEMENTS)) {
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

  it('emits a cover plus one slide per gradient for the hybrid templates', () => {
    const slides = buildCarousel('stack-then-singles', 4, { captionTile: false })
    expect(slides).toHaveLength(5)
    expect(slides[0].slices).toHaveLength(4)
    // Each single slide is full-bleed and names one gradient, in pick order.
    slides.slice(1).forEach((slide, i) => {
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

  it('offers grid at 4 and 9 but not at 5', () => {
    expect(templatesForCount(4).map((t) => t.id)).toContain('grid')
    expect(templatesForCount(9).map((t) => t.id)).toContain('grid')
    expect(templatesForCount(5).map((t) => t.id)).not.toContain('grid')
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
