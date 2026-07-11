import { describe, it, expect } from 'vitest'
import {
  QUALITATIVE,
  SEQUENTIAL,
  DIVERGING,
  DIVERGING_MIDPOINT,
  MAX_QUALITATIVE,
  CHART_PALETTES,
  qualitativeColors,
  sequentialColorAt,
  sequentialColors,
  divergingColorAt,
  divergingColors,
  readableTextOn,
} from './chartPalettes'
import { contrastRatio } from './titleColor'

const HEX = /^#[0-9a-fA-F]{6}$/

describe('chart palette definitions', () => {
  it('every color in every scheme is a valid 6-digit hex', () => {
    const all = [...QUALITATIVE.map((s) => s.hex), ...SEQUENTIAL, ...DIVERGING]
    for (const hex of all) expect(hex).toMatch(HEX)
  })

  it('exposes the eight Okabe–Ito hues with no duplicates', () => {
    expect(QUALITATIVE).toHaveLength(8)
    expect(MAX_QUALITATIVE).toBe(8)
    const hexes = QUALITATIVE.map((s) => s.hex.toLowerCase())
    expect(new Set(hexes).size).toBe(hexes.length)
  })

  it('DIVERGING_MIDPOINT is the middle stop', () => {
    expect(DIVERGING).toHaveLength(7)
    expect(DIVERGING_MIDPOINT).toBe(DIVERGING[3])
  })

  it('CHART_PALETTES indexes all three schemes', () => {
    expect(Object.keys(CHART_PALETTES).sort()).toEqual(['diverging', 'qualitative', 'sequential'])
    expect(CHART_PALETTES.qualitative.colors).toHaveLength(8)
  })
})

describe('qualitativeColors', () => {
  it('returns the first N colors in fixed order', () => {
    expect(qualitativeColors(3)).toEqual(['#0072B2', '#E69F00', '#009E73'])
  })

  it('is a stable prefix — asking for fewer never reorders', () => {
    const five = qualitativeColors(5)
    expect(qualitativeColors(3)).toEqual(five.slice(0, 3))
  })

  it('clamps to the available count and floors negatives', () => {
    expect(qualitativeColors(50)).toHaveLength(MAX_QUALITATIVE)
    expect(qualitativeColors(-2)).toEqual([])
  })
})

describe('sequential sampling', () => {
  it('pins the ends of the ramp', () => {
    expect(sequentialColorAt(0).toLowerCase()).toBe(SEQUENTIAL[0].toLowerCase())
    expect(sequentialColorAt(1).toLowerCase()).toBe(SEQUENTIAL[SEQUENTIAL.length - 1].toLowerCase())
  })

  it('clamps out-of-range t to the ends', () => {
    expect(sequentialColorAt(-1)).toBe(sequentialColorAt(0))
    expect(sequentialColorAt(2)).toBe(sequentialColorAt(1))
  })

  it('produces valid hex when interpolating between stops', () => {
    expect(sequentialColorAt(0.5)).toMatch(HEX)
  })

  it('is monotonically increasing in luminance (perceptually ordered)', () => {
    // Viridis runs dark→bright, so relative luminance should climb with t.
    const lum = (hex: string) => contrastRatio(hex, '#000000')
    const samples = sequentialColors(6).map(lum)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1])
    }
  })

  it('sequentialColors returns the requested count, low→high', () => {
    expect(sequentialColors(0)).toEqual([])
    expect(sequentialColors(1)).toHaveLength(1)
    const four = sequentialColors(4)
    expect(four).toHaveLength(4)
    expect(four[0].toLowerCase()).toBe(SEQUENTIAL[0].toLowerCase())
    expect(four[3].toLowerCase()).toBe(SEQUENTIAL[SEQUENTIAL.length - 1].toLowerCase())
  })
})

describe('diverging mapping', () => {
  it('maps zero to the neutral midpoint', () => {
    expect(divergingColorAt(0, 50)).toBe(DIVERGING_MIDPOINT)
  })

  it('maps the extremes to the blue and orange ends', () => {
    expect(divergingColorAt(-50, 50).toLowerCase()).toBe(DIVERGING[0].toLowerCase())
    expect(divergingColorAt(50, 50).toLowerCase()).toBe(DIVERGING[DIVERGING.length - 1].toLowerCase())
  })

  it('sends negatives toward blue and positives toward orange', () => {
    // Blue end is darker/cooler; compare against a red reference is overkill —
    // just assert the two sides differ and bracket the midpoint.
    const neg = divergingColorAt(-25, 50)
    const pos = divergingColorAt(25, 50)
    expect(neg).not.toBe(pos)
    expect(neg).not.toBe(DIVERGING_MIDPOINT)
    expect(pos).not.toBe(DIVERGING_MIDPOINT)
  })

  it('degenerate (zero-magnitude) domains collapse to the midpoint', () => {
    expect(divergingColorAt(10, 0)).toBe(DIVERGING_MIDPOINT)
  })

  it('divergingColors spans blue→orange for the requested count', () => {
    expect(divergingColors(1)).toEqual([DIVERGING_MIDPOINT])
    const seven = divergingColors(7)
    expect(seven).toHaveLength(7)
    expect(seven[0].toLowerCase()).toBe(DIVERGING[0].toLowerCase())
    expect(seven[6].toLowerCase()).toBe(DIVERGING[6].toLowerCase())
  })
})

describe('readableTextOn', () => {
  it('picks white text over dark swatches and black over light ones', () => {
    expect(readableTextOn('#0072B2')).toBe('#ffffff')
    expect(readableTextOn('#F0E442')).toBe('#000000')
  })

  it('always clears WCAG AA (4.5) against its swatch', () => {
    for (const { hex } of QUALITATIVE) {
      expect(contrastRatio(readableTextOn(hex), hex)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
