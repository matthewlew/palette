import { describe, it, expect } from 'vitest'
import {
  angularSequence, fanSequence, resolveFanConfig,
  buildGradientCss, gradientColorAt, getRadialConfig,
  nextRotationAngle, nextFanRotation,
} from './gradient'
import { sampleStops } from './gradient'
import type { GradientStop } from './gradient'

const stops: GradientStop[] = [
  { hex: '#622b00', position: 0 },
  { hex: '#00897e', position: 50 },
  { hex: '#798184', position: 100 },
]

describe('angularSequence', () => {
  it('honours stop positions', () => {
    // Positions used to be discarded entirely (colours spread by index), so
    // dragging a stop on an angular gradient emitted byte-identical CSS.
    const uneven: GradientStop[] = [
      { hex: '#622b00', position: 0 },
      { hex: '#00897e', position: 3 },
      { hex: '#798184', position: 97 },
    ]
    expect(angularSequence(uneven).map((s) => s.position)).not.toEqual(
      angularSequence(stops).map((s) => s.position),
    )
    expect(angularSequence(uneven).map((s) => s.position)).toEqual([0, 2, 65, 100])
  })

  it('still gives N equal wedges plus a seam for an evenly spaced ramp', () => {
    // The (n-1)/n scaling is chosen so this default is bit-identical to the old
    // index-based spread — the seam gets its own 360/n wedge for free.
    const seq = angularSequence(stops)
    expect(seq.map((s) => s.position)).toEqual([0, 33, 67, 100])
    expect(seq[seq.length - 1].hex).toBe(stops[0].hex)
  })
})

describe('fanSequence', () => {
  it('compresses into the sector and holds the last colour across the rest', () => {
    const quarter = fanSequence(stops, 0.25)
    expect(quarter.map((s) => s.position)).toEqual([0, 13, 25, 100])
    expect(quarter[quarter.length - 1].hex).toBe('#798184')
  })

  it('honours the span, so a corner fan differs from an edge fan', () => {
    expect(fanSequence(stops, 0.25)).not.toEqual(fanSequence(stops, 0.5))
  })
})

describe('resolveFanConfig', () => {
  it('lets an explicit angle win over the named anchor', () => {
    expect(resolveFanConfig('bottom', 45).span).toBe(0.25) // corner
    expect(resolveFanConfig('bottom', 90).span).toBe(0.5)  // edge
    expect(resolveFanConfig('bottom', undefined).span).toBe(0.5)
  })

  it('gives corners a 90 degree sector and sides 180', () => {
    for (const corner of [45, 135, 225, 315]) expect(resolveFanConfig('bottom', corner).span).toBe(0.25)
    for (const side of [0, 90, 180, 270]) expect(resolveFanConfig('bottom', side).span).toBe(0.5)
  })
})

describe('sampling agrees with rendering', () => {
  // The regression: gradientColorAt used to hardcode span 0.5 and read
  // FAN_ANCHOR_CONFIG, ignoring filters.angle. A corner fan was therefore
  // sampled against a 180 degree sector it does not occupy, so titleColorAt
  // picked the on-gradient ink against the wrong colour.
  it('samples a corner fan against its own 90 degree sector, not a 180 one', () => {
    // Derived from the config rather than hardcoded, so re-basing the compass
    // again cannot quietly invalidate it.
    const cfg = resolveFanConfig(undefined, 45)
    expect(cfg.span).toBe(0.25)
    const [x, y] = [0.5, 0.5]
    const deg = ((Math.atan2(x - cfg.px, -(y - cfg.py)) * 180) / Math.PI + 360) % 360
    const t = ((deg - cfg.from + 360) % 360) / 360

    const correct = sampleStops(fanSequence(stops, cfg.span), t)
    const oldBuggy = sampleStops(fanSequence(stops, 0.5), t)

    expect(gradientColorAt('fan', stops, x, y, false, { angle: 45 })).toBe(correct)
    // The regression this pins: the sampler used to assume a 0.5 span here.
    expect(correct).not.toBe(oldBuggy)
  })

  it('gives a different answer per fan angle', () => {
    const seen = new Set(
      [0, 45, 90, 135, 180, 225, 270, 315].map((angle) =>
        gradientColorAt('fan', stops, 0.5, 0.5, false, { angle }),
      ),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('honours positions when sampling an angular gradient too', () => {
    // The sampler shares angularSequence with the renderer, so moving a stop
    // has to change the sampled colour or the two have diverged again.
    const uneven: GradientStop[] = [
      { hex: '#622b00', position: 0 },
      { hex: '#00897e', position: 3 },
      { hex: '#798184', position: 97 },
    ]
    const differs = [[0.5, 0.06], [0.93, 0.85], [0.1, 0.9]].some(([x, y]) =>
      gradientColorAt('angular', uneven, x, y, false, {}) !==
      gradientColorAt('angular', stops, x, y, false, {}),
    )
    expect(differs).toBe(true)
  })

  it('renders and samples from the same sequence builders', () => {
    // If the CSS ever stops containing the sequence the sampler uses, the two
    // paths have diverged again.
    const css = buildGradientCss('fan', stops, false, { angle: 45 })
    for (const s of fanSequence(stops, resolveFanConfig('bottom', 45).span)) {
      expect(css).toContain(`${s.hex} ${s.position}%`)
    }
  })
})

describe('the fan compass matches radial', () => {
  it('puts every angle where getRadialConfig puts it — 0 is top, then clockwise', () => {
    const compass = [0, 45, 90, 135, 180, 225, 270, 315]
    const fan = compass.map((a) => { const c = resolveFanConfig(undefined, a); return `${c.px},${c.py}` })
    const radial = compass.map((a) => { const c = getRadialConfig(a); return `${c.px},${c.py}` })
    expect(fan).toEqual(radial)
    expect(fan[0]).toBe('0.5,0')  // top
    expect(fan[1]).toBe('1,0')    // top-right, i.e. clockwise
    expect(fan[4]).toBe('0.5,1')  // bottom sits opposite top
  })

  it('has no centre position, because a fan would tear there', () => {
    // radial and square include centre in their cycle; fan cannot. Its last
    // colour holds the remainder, so there is always a wrap point — pivoting on
    // the boundary hides it off-canvas. From the centre the whole circle is
    // visible and the wrap shows as a hard edge.
    expect(resolveFanConfig(undefined, undefined)).toEqual(resolveFanConfig(undefined, 180))
    expect(getRadialConfig(undefined)).toEqual({ css: 'center', px: 0.5, py: 0.5 })
  })

  it('gives every legacy anchor the angle that reproduces it', () => {
    for (const [anchor, angle] of [['top', 0], ['right', 90], ['bottom', 180], ['left', 270]] as const) {
      expect(resolveFanConfig(anchor, undefined)).toEqual(resolveFanConfig(undefined, angle))
    }
  })

  it('cycles fan through the eight compass points', () => {
    const seen: number[] = []
    let a = 0
    for (let i = 0; i < 8; i++) { seen.push(a); a = nextFanRotation(a).angle }
    expect(seen).toEqual([0, 45, 90, 135, 180, 225, 270, 315])
    expect(nextFanRotation(315).angle).toBe(0) // wraps, no centre
  })

  it('keeps centre in the radial and square cycle', () => {
    expect(nextRotationAngle('radial', 315)).toBeUndefined()
    expect(nextRotationAngle('square', 315)).toBeUndefined()
  })

  it('drops the legacy anchor on rotate so it cannot shadow the angle', () => {
    expect(nextFanRotation(0).fanAnchor).toBeUndefined()
  })
})
