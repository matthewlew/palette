import { describe, it, expect } from 'vitest'
import { buildGradientCss, gradientColorAt, nextRotationAngle, prismStops, PRISM_SAMPLES_PER_SEGMENT, resolvedCssStops, sampleStopsCss, SELECTABLE_GEOMETRY, smoothStops, SMOOTH_SAMPLES_PER_SEGMENT, ringStops, turrellExtent, type GradientStop } from './gradient'
import { hexToOklch } from './oklch'

/** Circular hue distance — the short way round the wheel either direction. */
function hueDelta(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2)
  return Math.min(d, 360 - d)
}

const stops: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#00ff00', position: 50 },
  { hex: '#0000ff', position: 100 },
]

describe('buildGradientCss', () => {
  it('builds a linear-gradient string', () => {
    const css = buildGradientCss('linear', stops)
    expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a radial-gradient string', () => {
    const css = buildGradientCss('radial', stops)
    // Explicit ellipse size, not the `circle` keyword — at the default aspect
    // (1, a square box) the two axes are equal, so this renders identically
    // to a plain `circle`. See buildGradientCss's aspect param: an unsized
    // `circle` stretches with the box's diagonal on a non-square box, making
    // the same ring/radial stops render visibly denser on a square masonry
    // tile than on a tall full-screen viewer.
    expect(css).toBe('radial-gradient(70.71% 70.71% at center, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('sizes a radial-gradient to the box\'s shorter side on a non-square aspect', () => {
    // Wide box (aspect > 1): rx shrinks (relative to the wider width), ry
    // stays at the full square-box radius (relative to the shorter height) —
    // so the absolute radius stays pinned to the shorter side either way.
    const wide = buildGradientCss('radial', stops, false, {}, 2)
    expect(wide).toBe('radial-gradient(35.36% 70.71% at center, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
    // Tall box (aspect < 1): mirror image.
    const tall = buildGradientCss('radial', stops, false, {}, 0.5)
    expect(tall).toBe('radial-gradient(70.71% 35.36% at center, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
  })

  it('builds a conic-gradient string for angular type that blends the seam back to the first color', () => {
    const css = buildGradientCss('angular', stops)
    // 3 stops spread evenly by index (i/n) -> 0%,33%,67%, then the first color
    // repeated at 100% wraps the seam smoothly — every wedge is 360/3=120deg wide
    // instead of a hard 360deg->0deg cut.
    expect(css).toBe('conic-gradient(from 0deg, #ff0000 0%, #00ff00 33.33%, #0000ff 66.67%, #ff0000 100%)')
  })

  it('renders angular hard as solid wedges (crisp double-stop boundaries)', () => {
    const css = buildGradientCss('angular', stops, false, { hard: true })
    // 3 colors -> three equal wedges, each cutting to the next at its exact boundary
    expect(css).toBe(
      'conic-gradient(from 0deg, #ff0000 0% 33%, #00ff00 33% 67%, #0000ff 67% 100%)',
    )
  })

  it('builds a bottom-centered 180° fan (conic from 270deg) for fan type', () => {
    // Bottom is angle 180 on the re-based compass (0 = top, clockwise).
    const css = buildGradientCss('fan', stops, false, { angle: 180 })
    // Palette compressed into the visible top semicircle (0-50%), last color
    // held across the off-screen lower half so the fan shows no seam.
    expect(css).toBe(
      'conic-gradient(from 270deg at 50% 100%, #ff0000 0%, #00ff00 25%, #0000ff 50%, #0000ff 100%)'
    )
    // A fan saved with the legacy anchor renders identically.
    expect(buildGradientCss('fan', stops, false, { fanAnchor: 'bottom' })).toBe(css)
  })

  it('leaves an un-rotated fan at the bottom, exactly as before', () => {
    expect(buildGradientCss('fan', stops)).toBe(
      buildGradientCss('fan', stops, false, { angle: 180 })
    )
  })

  it('fan sampling maps the horizons to the ends and straight-up to the middle', () => {
    // Left horizon → first color, right horizon → last, straight up → middle.
    // Bottom pivot is angle 180 now; a bare fan pivots at the centre.
    const bottom = { angle: 180 }
    expect(gradientColorAt('fan', stops, 0, 1, false, bottom)).toBe('#ff0000')
    expect(gradientColorAt('fan', stops, 1, 1, false, bottom)).toBe('#0000ff')
    expect(gradientColorAt('fan', stops, 0.5, 0, false, bottom)).toBe('#00ff00')
    // The legacy anchor samples the same, so old saves are untouched.
    expect(gradientColorAt('fan', stops, 0, 1, false, { fanAnchor: 'bottom' })).toBe('#ff0000')
  })

  it('rotates the fan pivot and start angle to the chosen anchor edge', () => {
    expect(buildGradientCss('fan', stops, false, { fanAnchor: 'top' })).toContain(
      'conic-gradient(from 90deg at 50% 0%,'
    )
    expect(buildGradientCss('fan', stops, false, { fanAnchor: 'left' })).toContain(
      'conic-gradient(from 0deg at 0% 50%,'
    )
    expect(buildGradientCss('fan', stops, false, { fanAnchor: 'right' })).toContain(
      'conic-gradient(from 180deg at 100% 50%,'
    )
  })

  it('samples the fan about the anchor-edge pivot', () => {
    // Top anchor (pivot 50% 0%): the two lower-corner horizons hit the ends
    // and straight-down hits the middle, mirroring the bottom-anchor case.
    expect(gradientColorAt('fan', stops, 1, 0, false, { fanAnchor: 'top' })).toBe('#ff0000')
    expect(gradientColorAt('fan', stops, 0, 0, false, { fanAnchor: 'top' })).toBe('#0000ff')
    expect(gradientColorAt('fan', stops, 0.5, 1, false, { fanAnchor: 'top' })).toBe('#00ff00')
  })

  it('builds a nested conic-gradient with hard stops sized to the stop count for square type', () => {
    const css = buildGradientCss('square', stops)
    expect(css).toContain('conic-gradient(')
    expect(css).toContain('#ff0000 0deg 120deg')
    expect(css).toContain('#00ff00 120deg 240deg')
    expect(css).toContain('#0000ff 240deg 360deg')
  })

  it('supports a variable number of stops for square type (e.g. 6 stops -> 60deg wedges)', () => {
    const sixStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#ff9900', position: 20 },
      { hex: '#00ff00', position: 40 },
      { hex: '#00ffff', position: 60 },
      { hex: '#0000ff', position: 80 },
      { hex: '#ff00ff', position: 100 },
    ]
    const css = buildGradientCss('square', sixStops)
    expect(css).toContain('#ff0000 0deg 60deg')
    expect(css).toContain('#ff9900 60deg 120deg')
    expect(css).toContain('#00ff00 120deg 180deg')
    expect(css).toContain('#00ffff 180deg 240deg')
    expect(css).toContain('#0000ff 240deg 300deg')
    expect(css).toContain('#ff00ff 300deg 360deg')
  })

  it('throws for fewer than 2 stops', () => {
    expect(() => buildGradientCss('linear', [stops[0]])).toThrow()
  })
})

describe('nextRotationAngle', () => {
  it('cycles radial origin through center (undefined) plus the 8 edges', () => {
    // center -> top -> ... -> top-left -> back to center
    expect(nextRotationAngle('radial', undefined)).toBe(0)
    expect(nextRotationAngle('radial', 0)).toBe(45)
    expect(nextRotationAngle('radial', 270)).toBe(315)
    expect(nextRotationAngle('radial', 315)).toBeUndefined()
  })

  it('cycles square (Turrell) origin through center too, like radial', () => {
    expect(nextRotationAngle('square', undefined)).toBe(0)
    expect(nextRotationAngle('square', 0)).toBe(45)
    expect(nextRotationAngle('square', 315)).toBeUndefined()
  })

  it('wraps other geometries 0-360 with no center state', () => {
    expect(nextRotationAngle('linear', undefined)).toBe(45)
    expect(nextRotationAngle('linear', 315)).toBe(0)
    expect(nextRotationAngle('angular', 90)).toBe(135)
  })
})

describe('SELECTABLE_GEOMETRY', () => {
  it('is the full cycle order the keyboard and tabs share, including mirror and fan', () => {
    expect(SELECTABLE_GEOMETRY).toEqual(['linear', 'radial', 'angular', 'square', 'mirror', 'fan'])
  })
})

describe('buildGradientCss reversed flag', () => {
  it('reverses stop order when reversed=true, for a type that is otherwise order-sensitive', () => {
    const forward = buildGradientCss('linear', stops, false)
    const reversed = buildGradientCss('linear', stops, true)
    expect(forward).toBe('linear-gradient(180deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)')
    expect(reversed).toBe('linear-gradient(180deg, #0000ff 0%, #00ff00 50%, #ff0000 100%)')
  })

  it('defaults to reversed=false when the third argument is omitted', () => {
    expect(buildGradientCss('linear', stops)).toBe(buildGradientCss('linear', stops, false))
  })
})

describe('buildGradientCss mirror type', () => {
  it('builds a true palindrome (A,B,C,B,A) without duplicating the midpoint stop', () => {
    const css = buildGradientCss('mirror', stops)
    // 3 input stops -> mirrored to 5: A, B, C, B, A. A true reflection starts
    // AND ends at the same color (A); C is the single axis of symmetry in the
    // middle, not at either end.
    expect(css).toContain('linear-gradient(180deg,')
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(5)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[2]).toBe('#0000ff 50%')
    expect(matches[4]).toBe('#ff0000 100%')
  })

  it('respects the reversed flag for mirror type', () => {
    const forward = buildGradientCss('mirror', stops, false)
    const reversed = buildGradientCss('mirror', stops, true)
    expect(forward).not.toBe(reversed)
  })
})

describe('buildGradientCss repeat filter', () => {
  it('cycles the stop sequence twice within 0-100 when filters.repeat is true', () => {
    const css = buildGradientCss('linear', stops, false, { repeat: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    // 3 stops doubled -> 6 evenly spaced stops (0/20/40/60/80/100), so the
    // hand-off from the last color back to the first blends over the same
    // step width as every other transition instead of cutting hard at 50.
    expect(matches).toHaveLength(6)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[2]).toBe('#0000ff 40%')
    expect(matches[3]).toBe('#ff0000 60%')
    expect(matches[5]).toBe('#0000ff 100%')
  })

  it('has no effect when filters.repeat is false/omitted', () => {
    expect(buildGradientCss('linear', stops, false, { repeat: false })).toBe(buildGradientCss('linear', stops))
  })

  it('is a no-op for square (already solid blocks) and mirror (builds its own sequence)', () => {
    expect(buildGradientCss('square', stops, false, { repeat: true })).toBe(buildGradientCss('square', stops))
    expect(buildGradientCss('mirror', stops, false, { repeat: true })).toBe(buildGradientCss('mirror', stops))
  })
})

describe('buildGradientCss hard filter', () => {
  it('renders each color as a band with a hard cut at the midpoint to its neighbor', () => {
    const css = buildGradientCss('linear', stops, false, { hard: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    // 3 stops -> 3 bands = 6 position markers (start/end pairs).
    expect(matches).toHaveLength(6)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[1]).toBe('#ff0000 25%')
    expect(matches[2]).toBe('#00ff00 25%')
    expect(matches[3]).toBe('#00ff00 75%')
    expect(matches[4]).toBe('#0000ff 75%')
    expect(matches[5]).toBe('#0000ff 100%')
  })

  it('combines with repeat: hardened bands, then cycled twice', () => {
    const css = buildGradientCss('linear', stops, false, { hard: true, repeat: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(12)
  })

  it('does not throw at the minimum valid stop count (2 stops)', () => {
    const twoStops: GradientStop[] = [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ]
    const css = buildGradientCss('linear', twoStops, false, { hard: true })
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toEqual(['#ff0000 0%', '#ff0000 50%', '#0000ff 50%', '#0000ff 100%'])
  })
})

describe('buildGradientCss repeat type (legacy dedicated type)', () => {
  it('builds a linear-gradient that repeats the stop sequence exactly twice', () => {
    const css = buildGradientCss('repeat', stops)
    expect(css).toContain('linear-gradient(180deg,')
    // 3 stops repeated twice, no synthetic seam stop = 6 total stops.
    const matches = css.match(/#[0-9a-f]{6} \d+%/g)!
    expect(matches).toHaveLength(6)
    expect(matches[0]).toBe('#ff0000 0%')
    expect(matches[5]).toBe('#0000ff 100%')
  })

  it('contains only colors from the input palette (no invented seam hue)', () => {
    const css = buildGradientCss('repeat', stops)
    const matches = css.match(/#[0-9a-f]{6}/g)!
    const palette = new Set(stops.map((s) => s.hex))
    for (const hex of matches) {
      expect(palette.has(hex), `${hex} should be an input color`).toBe(true)
    }
  })
})

describe('smoothStops', () => {
  const bw = [
    { hex: '#000000', position: 0 },
    { hex: '#ffffff', position: 100 },
  ]

  it('keeps the original endpoints exactly', () => {
    const out = smoothStops(bw)
    expect(out[0]).toEqual({ hex: '#000000', position: 0 })
    expect(out[out.length - 1]).toEqual({ hex: '#ffffff', position: 100 })
  })

  it('inserts SMOOTH_SAMPLES_PER_SEGMENT interior stops per segment', () => {
    // 1 leading endpoint + (samples interior + 1 trailing) per segment
    expect(smoothStops(bw)).toHaveLength(1 + (SMOOTH_SAMPLES_PER_SEGMENT + 1))
  })

  it('produces monotonically non-decreasing positions', () => {
    const out = smoothStops([
      { hex: '#ff0000', position: 0 },
      { hex: '#00ff00', position: 50 },
      { hex: '#0000ff', position: 100 },
    ])
    for (let i = 1; i < out.length; i++) {
      expect(out[i].position).toBeGreaterThanOrEqual(out[i - 1].position)
    }
  })

  it('returns lists shorter than 2 unchanged', () => {
    const one = [{ hex: '#ffffff', position: 0 }]
    expect(smoothStops(one)).toHaveLength(1)
  })
})

describe('buildGradientCss smooth filter', () => {
  const bw = [
    { hex: '#000000', position: 0 },
    { hex: '#ffffff', position: 100 },
  ]
  const countHashes = (s: string) => (s.match(/#/g) || []).length

  it('densifies a linear gradient when smooth is on', () => {
    const plain = buildGradientCss('linear', bw)
    const smooth = buildGradientCss('linear', bw, false, { smooth: true })
    expect(smooth.startsWith('linear-gradient(')).toBe(true)
    expect(countHashes(smooth)).toBeGreaterThan(countHashes(plain))
  })

  it('lets hard win when both hard and smooth are set', () => {
    const both = buildGradientCss('linear', bw, false, { smooth: true, hard: true })
    const hardOnly = buildGradientCss('linear', bw, false, { hard: true })
    expect(both).toBe(hardOnly)
  })

  it('ignores smooth for square (solid blocks)', () => {
    expect(buildGradientCss('square', bw, false, { smooth: true })).toBe(
      buildGradientCss('square', bw)
    )
  })
})

/* Stop positions have to actually move the gradient.
 *
 * Three geometries used to discard or damp them, each for its own reason, and
 * the shared symptom was that dragging a stop leftward on mirror or angular
 * did not move the ramp the way it does on linear, radial or fan. */
describe('every geometry responds to a dragged stop', () => {
  const at = (...positions: number[]): GradientStop[] =>
    positions.map((position, i) => ({ hex: ['#ff0000', '#00ff00', '#0000ff'][i], position }))

  it('gives DIFFERENT css for a shifted ramp, in every selectable geometry', () => {
    // square renders through TurrellSquare rather than this CSS, so it is
    // covered by its own component test instead.
    for (const type of SELECTABLE_GEOMETRY.filter((t) => t !== 'square')) {
      expect(
        buildGradientCss(type, at(0, 50, 100), false, {}),
        `${type} should respond to a moved stop`,
      ).not.toBe(buildGradientCss(type, at(0, 20, 100), false, {}))
    }
  })

  it('mirror is no longer invariant to shifting or stretching the whole ramp', () => {
    // It normalized min-max onto 0-100 before folding, so all three of these
    // produced byte-identical CSS and dragging either END stop did nothing.
    const shapes = [at(0, 50, 100), at(10, 50, 90), at(30, 65, 100)]
    const rendered = shapes.map((s) => buildGradientCss('mirror', s, false, {}))
    expect(new Set(rendered).size).toBe(3)
  })

  it('mirror still renders the classic ramp exactly as it always did', () => {
    // The reversal has to be a strict generalisation: a ramp that already fills
    // 0-100 is unchanged, so no saved gradient shifts under it.
    expect(buildGradientCss('mirror', at(0, 50, 100), false, {})).toBe(
      'linear-gradient(180deg, #ff0000 0%, #00ff00 25%, #0000ff 50%, #00ff00 75%, #ff0000 100%)',
    )
  })

  it('mirror holds the last colour flat across the fold when the ramp stops short', () => {
    // The old normalization existed to avoid a gap here. Reflecting the fold
    // stop closes it without stretching the ramp: blue runs 35% to 65%.
    const css = buildGradientCss('mirror', at(0, 50, 70), false, {})
    expect(css).toBe(
      'linear-gradient(180deg, #ff0000 0%, #00ff00 25%, #0000ff 35%, #0000ff 65%, #00ff00 75%, #ff0000 100%)',
    )
  })

  it('mirror stays a palindrome about the 50% line', () => {
    for (const shape of [at(0, 50, 100), at(10, 50, 90), at(0, 20, 70)]) {
      const css = buildGradientCss('mirror', shape, false, {})
      const positions = [...css.matchAll(/ (-?[\d.]+)%/g)].map((m) => parseFloat(m[1]))
      expect(positions).toEqual([...positions].reverse().map((p) => 100 - p))
    }
  })

  it('angular still renders the evenly spaced ramp exactly as it always did', () => {
    expect(buildGradientCss('angular', at(0, 50, 100), false, {})).toBe(
      'conic-gradient(from 0deg, #ff0000 0%, #00ff00 33.33%, #0000ff 66.67%, #ff0000 100%)',
    )
  })

  it('angular keeps its stops ascending and inside the seam', () => {
    for (const shape of [at(0, 50, 100), at(0, 20, 100), at(40, 60, 80)]) {
      const positions = [...buildGradientCss('angular', shape, false, {})
        .matchAll(/ (\d+)%/g)].map((m) => parseInt(m[1], 10))
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
      expect(Math.max(...positions)).toBe(100)
    }
  })

  it('hardened angular wedges track a dragged stop too', () => {
    expect(buildGradientCss('angular', at(0, 20, 100), false, { hard: true })).not.toBe(
      buildGradientCss('angular', at(0, 50, 100), false, { hard: true }),
    )
  })

  it('a Turrell stop travels nearly the whole range, like the other geometries', () => {
    // The extent floor was 0.2, so position 0 still filled a fifth of the
    // canvas and the control read as damped next to linear or radial.
    expect(turrellExtent(0, 3)).toBeCloseTo(0.1, 5)
    expect(turrellExtent(100, 3)).toBeCloseTo(1, 5)
  })
})

describe('prismStops', () => {
  const orangeBlue = [
    { hex: '#ff8800', position: 0 },
    { hex: '#0044ff', position: 100 },
  ]

  it('keeps the original endpoints exactly', () => {
    const out = prismStops(orangeBlue)
    expect(out[0]).toEqual({ hex: '#ff8800', position: 0 })
    expect(out[out.length - 1]).toEqual({ hex: '#0044ff', position: 100 })
  })

  it('inserts PRISM_SAMPLES_PER_SEGMENT interior stops per segment', () => {
    expect(prismStops(orangeBlue)).toHaveLength(1 + (PRISM_SAMPLES_PER_SEGMENT + 1))
  })

  it('returns lists shorter than 2 unchanged', () => {
    expect(prismStops([{ hex: '#ffffff', position: 0 }])).toHaveLength(1)
  })

  it('walks hue the polar way — round the wheel, not straight between the two', () => {
    // 56 deg to 264 deg: the SHORT way round the wheel runs backwards through
    // 0, so every interior hue lands OUTSIDE the numeric span between the two
    // endpoints. A non-polar interpolation cannot produce a single one.
    const hues = prismStops(orangeBlue).slice(1, -1).map((s) => hexToOklch(s.hex).h)
    expect(hues.length).toBeGreaterThan(0)
    for (const h of hues) {
      expect(h < 56 || h > 264).toBe(true)
    }
  })

  it('diverges far from the straight sRGB line CSS would walk', () => {
    const mid = prismStops(orangeBlue)[9].hex
    const straight = sampleStopsCss(orangeBlue, prismStops(orangeBlue)[9].position / 100)
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const delta = Math.max(...channels(mid).map((v, i) => Math.abs(v - channels(straight)[i])))
    expect(delta).toBeGreaterThan(60)
  })

  it('holds chroma up across the middle instead of dipping to the sRGB midpoint', () => {
    const mid = prismStops(orangeBlue)[Math.round((PRISM_SAMPLES_PER_SEGMENT + 1) / 2)]
    const a = hexToOklch('#ff8800')
    const b = hexToOklch('#0044ff')
    expect(hexToOklch(mid.hex).c).toBeGreaterThan(Math.min(a.c, b.c) * 0.6)
  })
})

describe('ringStops', () => {
  // Three original stops close together, so any seam at a boundary would be
  // dense enough to read as the "panel" artifact the per-pair-average version
  // produced.
  const tight: GradientStop[] = [
    { hex: '#123456', position: 0 },
    { hex: '#8a2b6f', position: 40 },
    { hex: '#0000ff', position: 100 },
  ]

  it('holds lightness constant across the whole ramp, not just within one segment', () => {
    // Not exact: a pinned lightness paired with a high chroma can fall outside
    // sRGB's gamut, and oklchToSrgb's clamp perturbs the round-tripped L
    // slightly. The tolerance here is still far tighter than the ~0.1+ jump
    // the old per-pair-average version produced right at a stop boundary.
    const ls = ringStops(tight).map((s) => hexToOklch(s.hex).l)
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThan(0.05)
  })

  it('has no bigger hue jump at an original stop boundary than anywhere else in the ramp', () => {
    // Regression: pinning lightness to each PAIR's own average (rather than
    // one reference for the whole gradient) re-anchored at every original
    // stop, producing a jump right at the boundary that dwarfed the smooth
    // per-sample steps either side of it.
    const hues = ringStops(tight).map((s) => hexToOklch(s.hex).h)
    const deltas: number[] = []
    for (let i = 1; i < hues.length; i++) deltas.push(hueDelta(hues[i - 1], hues[i]))
    const maxDelta = Math.max(...deltas)
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length
    expect(maxDelta).toBeLessThan(avgDelta * 3)
  })
})


describe('prism filter', () => {
  const ramp = [
    { hex: '#ff8800', position: 0 },
    { hex: '#0044ff', position: 100 },
  ]

  it('leaves output byte-identical to today when disabled', () => {
    for (const type of SELECTABLE_GEOMETRY) {
      expect(buildGradientCss(type, ramp, false, { prism: false })).toBe(buildGradientCss(type, ramp))
      expect(buildGradientCss(type, ramp, false, {})).toBe(buildGradientCss(type, ramp))
    }
  })

  it('changes the emitted CSS for every continuous geometry', () => {
    for (const type of SELECTABLE_GEOMETRY) {
      if (type === 'square') continue
      expect(buildGradientCss(type, ramp, false, { prism: true })).not.toBe(buildGradientCss(type, ramp))
    }
  })

  it('is ignored for Turrell squares, which have no blend to densify', () => {
    expect(buildGradientCss('square', ramp, false, { prism: true })).toBe(buildGradientCss('square', ramp))
  })

  it('yields to hard stops, exactly as smooth does', () => {
    const hard = buildGradientCss('linear', ramp, false, { hard: true })
    expect(buildGradientCss('linear', ramp, false, { hard: true, prism: true })).toBe(hard)
    expect(buildGradientCss('linear', ramp, false, { hard: true, smooth: true })).toBe(hard)
  })

  it('yields to smooth when both somehow arrive set', () => {
    expect(buildGradientCss('linear', ramp, false, { smooth: true, prism: true })).toBe(
      buildGradientCss('linear', ramp, false, { smooth: true }),
    )
  })

  it('composes with reversed and repeat', () => {
    for (const extra of [{ }, { repeat: true }]) {
      for (const reversed of [false, true]) {
        const plain = buildGradientCss('linear', ramp, reversed, extra)
        const prism = buildGradientCss('linear', ramp, reversed, { ...extra, prism: true })
        expect(prism).not.toBe(plain)
        expect(prism.startsWith('linear-gradient(')).toBe(true)
      }
    }
  })

  it('gives the layer renderers the same arc-travelled ramp the CSS path gets', () => {
    const dense = resolvedCssStops(ramp, false, { prism: true })
    expect(dense).toHaveLength(1 + (PRISM_SAMPLES_PER_SEGMENT + 1))
    const probe = prismStops(ramp)[9]
    expect(sampleStopsCss(dense, probe.position / 100)).toBe(probe.hex)
  })
})
