import { describe, it, expect } from 'vitest'
import {
  boundaryInwardBearing,
  cropRadialExtent,
  radialCropAxes,
  linearCompressionCircle,
  linearCompressionOval,
  compressStopsForCrop,
  fanRefit,
  cropClipPath,
  cropSurfaceSize,
  buildCroppedGradientCss,
  squishBearing,
  squishConicStops,
} from './gradientCrop'
import { FAN_ANCHOR_CONFIG } from './gradient'

describe('cropRadialExtent', () => {
  it('is 0.5 for a centred origin on every crop', () => {
    expect(cropRadialExtent('rectangle', 0.5, 0.5)).toBeCloseTo(0.5)
    expect(cropRadialExtent('circle', 0.5, 0.5)).toBeCloseTo(0.5)
    expect(cropRadialExtent('oval', 0.5, 0.5)).toBeCloseTo(0.5, 3)
  })

  it('reaches the far side of a circle from a top-centre origin', () => {
    expect(cropRadialExtent('circle', 0.5, 0)).toBeCloseTo(1)
  })

  it('keeps circle isolines circular (rx === ry) from any origin', () => {
    for (const [px, py] of [[0.5, 0.5], [0.5, 0], [0, 0.5], [1, 1], [0.15, 0.85], [0.75, 0.25]]) {
      const { rx, ry } = radialCropAxes('circle', px, py)
      expect(rx).toBe(ry)
      // Tangent to the far side: origin-to-centre distance plus the radius.
      expect(rx).toBeCloseTo(Math.hypot(px - 0.5, py - 0.5) + 0.5, 10)
    }
  })

  it('covers every boundary point of an oval from an off-centre origin', () => {
    const px = 0.5
    const py = 0
    const extent = cropRadialExtent('oval', px, py)
    expect(extent).toBeGreaterThan(0.5)
    const { rx, ry } = radialCropAxes('oval', px, py)
    expect(rx).toBe(ry)
    // In normalized box coordinates the oval's boundary is the unit circle, so
    // every boundary point must sit inside the isoline of radius `extent`
    // centred on the origin.
    for (let i = 0; i < 720; i++) {
      const theta = (i / 720) * 2 * Math.PI
      const dx = 0.5 + 0.5 * Math.cos(theta) - px
      const dy = 0.5 + 0.5 * Math.sin(theta) - py
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(extent + 1e-9)
    }
  })

  it('gives circle and oval the same extent, the box being the only difference', () => {
    for (const [px, py] of [[0.5, 0.5], [0.5, 0], [0, 0], [0.2, 0.9]]) {
      expect(cropRadialExtent('oval', px, py)).toBeCloseTo(cropRadialExtent('circle', px, py), 12)
    }
  })
})

describe('linear/mirror compression', () => {
  it('circle and oval agree when w === h', () => {
    for (const angle of [0, 30, 45, 90, 137]) {
      expect(linearCompressionOval(angle, 1, 1)).toBeCloseTo(linearCompressionCircle(angle), 10)
    }
  })

  it('is 1 along the axes (no compression on-axis) and >= 1 elsewhere', () => {
    expect(linearCompressionCircle(0)).toBeCloseTo(1)
    expect(linearCompressionCircle(90)).toBeCloseTo(1)
    expect(linearCompressionCircle(45)).toBeGreaterThan(1)
  })

  it('compressStopsForCrop leaves rectangle untouched and folds circle stops toward 50', () => {
    const stops = [{ hex: '#fff', position: 0 }, { hex: '#000', position: 100 }]
    expect(compressStopsForCrop(stops, 'rectangle', 45)).toEqual(stops)
    const compressed = compressStopsForCrop(stops, 'circle', 45)
    const k = Math.SQRT2
    expect(compressed[0].position).toBeCloseTo(50 + (0 - 50) / k)
    expect(compressed[1].position).toBeCloseTo(50 + (100 - 50) / k)
  })
})

describe('fanRefit', () => {
  it('matches the existing rectangle FAN_ANCHOR_CONFIG bearings', () => {
    // Not a literal equivalence (fanRefit assumes a curved, not square,
    // boundary) but the four compass anchors are all on-axis, where a
    // boundary curve and its bounding box agree.
    for (const [anchor, cfg] of Object.entries(FAN_ANCHOR_CONFIG)) {
      const refit = fanRefit(cfg.px, cfg.py)
      expect(refit.from, anchor).toBeCloseTo(cfg.from, 5)
      expect(refit.span).toBe(0.5)
    }
  })

  it('follows the boundary normal off-axis, where a box corner would not', () => {
    // Bottom-right corner: the inward normal of a circle there points back at
    // the centre, up-left at 315 degrees on this compass. `from` is the fan's
    // start edge, a quarter turn behind the normal it is centred on.
    expect(boundaryInwardBearing(2, 1, 1)).toBeCloseTo(315, 5)
    expect(fanRefit(1, 1).from).toBeCloseTo(225, 5)
  })
})

describe('cropClipPath', () => {
  it('is undefined for rectangle/none', () => {
    expect(cropClipPath(undefined)).toBeUndefined()
    expect(cropClipPath('rectangle')).toBeUndefined()
  })
  it('is an exact circle() for circle crop', () => {
    expect(cropClipPath('circle')).toBe('circle(50%)')
  })
  it('is an exact ellipse() for oval, taking its aspect from the box', () => {
    // Not a polygon approximation of a squircle, and no aspect argument: the
    // two percentages resolve against the box's own width and height.
    expect(cropClipPath('oval')).toBe('ellipse(50% 50%)')
  })
})

describe('cropSurfaceSize', () => {
  it('gives a circle a square box capped by the shorter axis', () => {
    expect(cropSurfaceSize('circle', '100dvh')).toEqual({
      width: 'min(100%, 100dvh)',
      height: 'auto',
      aspectRatio: '1 / 1',
    })
  })

  it('lets oval and rectangle take the whole available box', () => {
    expect(cropSurfaceSize('oval', '100dvh')).toEqual({ width: '100%', height: '100%' })
    expect(cropSurfaceSize('rectangle', '100dvh')).toEqual({ width: '100%', height: '100%' })
    expect(cropSurfaceSize(undefined, '100dvh')).toEqual({ width: '100%', height: '100%' })
  })
})

describe('buildCroppedGradientCss applies the list filters', () => {
  const stops = [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 50 },
    { hex: '#0000ff', position: 100 },
  ]
  const count = (css: string) => (css.match(/#[0-9a-f]{6}/gi) ?? []).length

  // Repeat and Hard rebuild the stop list, and this builder re-derives geometry
  // for radial and fan rather than delegating to buildGradientCss — so it used
  // to drop both of them on the floor for exactly those two types.
  for (const type of ['radial', 'fan'] as const) {
    it(`honours Repeat x2 for ${type} under a circle crop`, () => {
      const plain = buildCroppedGradientCss(type, stops, false, {}, 'circle')!
      const repeated = buildCroppedGradientCss(type, stops, false, { repeat: true }, 'circle')!
      expect(count(repeated)).toBeGreaterThan(count(plain))
    })

    it(`honours Hard for ${type} under a circle crop`, () => {
      const plain = buildCroppedGradientCss(type, stops, false, {}, 'circle')!
      const hard = buildCroppedGradientCss(type, stops, false, { hard: true }, 'circle')!
      expect(hard).not.toBe(plain)
    })
  }

  it('repeats a cropped linear without discarding the crop compression', () => {
    // Repeat rebuilds positions from hex order, so running it after the refit
    // would overwrite the compressed positions and silently un-crop the ramp.
    // 45 degrees: the circle compression factor is sqrt(2) there, where at 0 it
    // is exactly 1 and a dropped refit would be indistinguishable.
    const filters = { repeat: true, angle: 45 }
    const rect = buildCroppedGradientCss('linear', stops, false, filters, 'rectangle')!
    const circle = buildCroppedGradientCss('linear', stops, false, filters, 'circle')!
    expect(count(circle)).toBe(count(rect))
    expect(circle).not.toBe(rect)
  })
})

describe('squishBearing', () => {
  it('is the identity on a square box, at every bearing', () => {
    for (const b of [0, 30, 45, 90, 137, 180, 270, 359]) {
      expect(squishBearing(b, 1, 1)).toBe(b)
    }
  })

  it('leaves the two axes fixed — they are the squish axes', () => {
    // A ray straight up or straight along the box cannot move: scaling x and y
    // independently maps each axis onto itself. If these drift, the gradient
    // has been rotated rather than squished.
    for (const b of [0, 90, 180, 270]) {
      expect(squishBearing(b, 2, 1)).toBeCloseTo(b, 6)
    }
  })

  it('pulls rays toward the long axis of the box', () => {
    // Bearings are clockwise from up, so 45 is the up-right diagonal. Widen
    // the box and that diagonal lies down toward the horizontal: past 45.
    expect(squishBearing(45, 2, 1)).toBeCloseTo(63.435, 3)
    // Exactly the diagonal of the box, which is what the squish maps 45 to.
    expect(squishBearing(45, 2, 1)).toBeCloseTo((Math.atan2(2, 1) * 180) / Math.PI, 6)
    // A tall box does the mirror of it.
    expect(squishBearing(45, 1, 2)).toBeCloseTo(26.565, 3)
  })

  it('is its own inverse under swapped axes', () => {
    for (const b of [17, 45, 88, 200, 310]) {
      expect(squishBearing(squishBearing(b, 3, 1), 1, 3)).toBeCloseTo(b, 6)
    }
  })

  it('stays continuous across the half-turn, where atan2 would jump', () => {
    // The principal value flips sign at 180. Un-branched, the stop just past
    // it would come back ~360 lower and sort ahead of the whole list.
    expect(squishBearing(179, 2, 1)).toBeGreaterThan(90)
    expect(squishBearing(181, 2, 1)).toBeGreaterThan(squishBearing(179, 2, 1))
    expect(squishBearing(359, 2, 1)).toBeCloseTo(360 - squishBearing(1, 2, 1), 6)
  })

  it('is strictly increasing all the way round', () => {
    let previous = -Infinity
    for (let b = 0; b <= 360; b += 3) {
      const moved = squishBearing(b, 1, 2.5)
      expect(moved).toBeGreaterThan(previous)
      previous = moved
    }
  })
})

describe('squishConicStops', () => {
  const stops = [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 50 },
    { hex: '#ffffff', position: 100 },
  ]

  it('returns the list untouched on a square box', () => {
    expect(squishConicStops(stops, 0, 1, 1)).toBe(stops)
  })

  it('keeps offsets ascending', () => {
    const out = squishConicStops(stops, 0, 1, 3)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].position).toBeGreaterThanOrEqual(out[i - 1].position)
    }
  })

  it('pins the ends, so the ramp still spans exactly one turn', () => {
    const out = squishConicStops(stops, 0, 2, 1)
    expect(out[0].position).toBeCloseTo(0, 6)
    expect(out[out.length - 1].position).toBeCloseTo(100, 6)
  })

  it('moves the half-turn stop only when `from` takes it off an axis', () => {
    // At from=0 the 50% stop is pointing straight down — an axis, so fixed.
    expect(squishConicStops(stops, 0, 2, 1)[25].position).toBeCloseTo(50, 1)
    // Rotate the gradient 45 degrees inside the same oval and it is on the
    // diagonal, which is where the squish bites. This is the case that would
    // silently render as if the oval had rotated too.
    expect(squishConicStops(stops, 45, 2, 1)[25].position).not.toBeCloseTo(50, 1)
  })

  it('subdivides, so the interior of a wedge follows the curve too', () => {
    // Endpoints alone would be squished correctly with a straight chord
    // between them — right at the edges, wrong in the middle.
    expect(squishConicStops(stops, 0, 2, 1).length).toBeGreaterThan(stops.length)
  })
})

describe('angular under an oval crop', () => {
  const stops = [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 50 },
    { hex: '#0000ff', position: 100 },
  ]

  it('squishes with the oval once the box is not square', () => {
    const square = buildCroppedGradientCss('angular', stops, false, {}, 'oval', 1)
    const wide = buildCroppedGradientCss('angular', stops, false, {}, 'oval', 2)
    expect(wide).not.toBe(square)
    expect(wide.startsWith('conic-gradient(')).toBe(true)
  })

  it('leaves the circle crop alone — every ray there is the same length', () => {
    expect(buildCroppedGradientCss('angular', stops, false, {}, 'circle', 2)).toBe(
      buildCroppedGradientCss('angular', stops, false, {}, 'circle', 1),
    )
  })

  it('defaults to the unsquished output, so callers with no box are unchanged', () => {
    expect(buildCroppedGradientCss('angular', stops, false, {}, 'oval')).toBe(
      buildCroppedGradientCss('angular', stops, false, {}, 'oval', 1),
    )
  })

  it('keeps the gradient a rotation apart from itself, not a reshaping', () => {
    // Rotating inside a FIXED oval is a different picture at every angle. If
    // `from` were dropped from the squish these two would differ only by the
    // `from` term, i.e. the oval would appear to rotate with the gradient.
    const a = buildCroppedGradientCss('angular', stops, false, { angle: 0 }, 'oval', 2)
    const b = buildCroppedGradientCss('angular', stops, false, { angle: 30 }, 'oval', 2)
    expect(a.replace('from 0deg', 'from 30deg')).not.toBe(b)
  })
})
