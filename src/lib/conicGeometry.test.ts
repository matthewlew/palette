import { describe, it, expect } from 'vitest'
import {
  angularSequence, fanSequence, resolveFanConfig,
  buildGradientCss, gradientColorAt,
} from './gradient'
import type { GradientStop } from './gradient'

const stops: GradientStop[] = [
  { hex: '#622b00', position: 0 },
  { hex: '#00897e', position: 50 },
  { hex: '#798184', position: 100 },
]

describe('angularSequence', () => {
  it('spreads by index and ignores stop positions', () => {
    const uneven: GradientStop[] = [
      { hex: '#622b00', position: 0 },
      { hex: '#00897e', position: 3 },
      { hex: '#798184', position: 97 },
    ]
    expect(angularSequence(uneven).map((s) => s.position)).toEqual(
      angularSequence(stops).map((s) => s.position),
    )
  })

  it('gives N equal wedges plus a seam back to the first colour', () => {
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
  it('samples a corner fan against its own 90 degree sector', () => {
    // angle 45 pivots at the bottom-left corner sweeping 0..90 degrees, so the
    // far corner (1,1) sits at exactly the end of the sector -> the LAST colour.
    const hex = gradientColorAt('fan', stops, 1, 1, false, { angle: 45 })
    expect(hex).toBe('#798184')
  })

  it('gives a different answer per fan angle', () => {
    const seen = new Set(
      [0, 45, 90, 135, 180, 225, 270, 315].map((angle) =>
        gradientColorAt('fan', stops, 0.5, 0.5, false, { angle }),
      ),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('still ignores positions when sampling an angular gradient', () => {
    const uneven: GradientStop[] = [
      { hex: '#622b00', position: 0 },
      { hex: '#00897e', position: 3 },
      { hex: '#798184', position: 97 },
    ]
    for (const [x, y] of [[0.5, 0.06], [0.93, 0.85], [0.1, 0.9]]) {
      expect(gradientColorAt('angular', uneven, x, y, false, {}))
        .toBe(gradientColorAt('angular', stops, x, y, false, {}))
    }
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
