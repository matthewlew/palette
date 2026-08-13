import { describe, it, expect } from 'vitest'
import {
  superellipseRadiusAt,
  cropRadialExtent,
  radialCropAxes,
  linearCompressionCircle,
  linearCompressionOval,
  compressStopsForCrop,
  fanRefit,
  cropClipPath,
  cropSurfaceSize,
  SUPERELLIPSE_N,
} from './gradientCrop'
import { FAN_ANCHOR_CONFIG } from './gradient'

describe('superellipseRadiusAt', () => {
  it('returns exactly 1.0 on both axes for every n', () => {
    for (const n of [2, 2.5, 3, 4, 8]) {
      expect(superellipseRadiusAt(0, n)).toBeCloseTo(1, 10)
      expect(superellipseRadiusAt(Math.PI / 2, n)).toBeCloseTo(1, 10)
      expect(superellipseRadiusAt(Math.PI, n)).toBeCloseTo(1, 10)
    }
  })

  it('is > 1.0 off-axis, growing toward the diagonal as n grows', () => {
    const theta = Math.PI / 4
    const r2 = superellipseRadiusAt(theta, 2)
    const r25 = superellipseRadiusAt(theta, 2.5)
    const r4 = superellipseRadiusAt(theta, 4)
    const r8 = superellipseRadiusAt(theta, 8)
    expect(r2).toBeCloseTo(1, 10) // a true circle is equidistant at every bearing
    expect(r25).toBeGreaterThan(r2)
    expect(r4).toBeGreaterThan(r25)
    expect(r8).toBeGreaterThan(r4)
  })

  it('at n=2 is the exact circle radius 1/max(|cos|,|sin|)... no, 1/sqrt(cos^2+sin^2)=1 everywhere for a true circle', () => {
    // A circle boundary (n=2) is the same distance from centre at every
    // bearing when measured in TRUE radius, but this formula measures radius
    // relative to the half-axis along that bearing, which for a circle is
    // 1/sqrt(cos^2+sin^2) = 1 identically.
    for (const theta of [0, 0.3, 0.7, 1.2, Math.PI / 2]) {
      expect(superellipseRadiusAt(theta, 2)).toBeCloseTo(1, 10)
    }
  })
})

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
    // Every boundary point must sit inside the outermost isoline: the isoline
    // is the same superellipse scaled to `extent` about the origin.
    for (let i = 0; i < 720; i++) {
      const theta = (i / 720) * 2 * Math.PI
      const r = superellipseRadiusAt(theta, SUPERELLIPSE_N)
      const dx = 0.5 + 0.5 * r * Math.cos(theta) - px
      const dy = 0.5 + 0.5 * r * Math.sin(theta) - py
      const norm =
        0.5 *
        Math.pow(
          Math.pow(Math.abs(dx / 0.5), SUPERELLIPSE_N) + Math.pow(Math.abs(dy / 0.5), SUPERELLIPSE_N),
          1 / SUPERELLIPSE_N,
        )
      expect(norm).toBeLessThanOrEqual(extent + 1e-3)
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
  it('matches the existing rectangle FAN_ANCHOR_CONFIG bearings at n=2 (circle)', () => {
    // Not a literal equivalence (fanRefit assumes a circular, not square,
    // boundary) but the four compass anchors are all on-axis, where the
    // superellipse and its bounding shape agree regardless of n.
    for (const [anchor, cfg] of Object.entries(FAN_ANCHOR_CONFIG)) {
      const refit = fanRefit('circle', cfg.px, cfg.py)
      expect(refit.from, anchor).toBeCloseTo(cfg.from, 5)
      expect(refit.span).toBe(0.5)
    }
  })

  it('oval agrees with circle on-axis too', () => {
    for (const [, cfg] of Object.entries(FAN_ANCHOR_CONFIG)) {
      const oval = fanRefit('oval', cfg.px, cfg.py)
      const circle = fanRefit('circle', cfg.px, cfg.py)
      expect(oval.from).toBeCloseTo(circle.from, 5)
      expect(oval.span).toBe(0.5)
    }
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
  it('is a polygon tracing the superellipse for oval', () => {
    const path = cropClipPath('oval', 1, 1)
    expect(path).toMatch(/^polygon\(/)
    expect(SUPERELLIPSE_N).toBe(2.5)
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
