import { describe, it, expect } from 'vitest'
import {
  coverageToHex,
  toEditableStops,
  equalizeEditableStops,
  isEvenlyDistributed,
  reassignPositions,
  removeStopAt,
  addStop,
  moveStop,
  toGradientCoverageStops,
  generateGradientCoverage,
} from './riso'
import type { DrumEditableStop } from './riso'
import type { GradientStop } from './gradient'

describe('coverageToHex', () => {
  it('renders bare paper (all-zero coverage) as white', () => {
    expect(coverageToHex([0, 0, 0], ['#ff48b0', '#62a8e5', '#ffe800'])).toBe('#ffffff')
  })

  it('renders 100% coverage of a single ink as that ink verbatim', () => {
    expect(coverageToHex([100], ['#ff48b0'])).toBe('#ff48b0')
  })

  it('applies the lightest-first multiply formula for partial coverage', () => {
    // ink #ff0000 at 50%: r stays 255 (film=255), g/b film = 255-0.5*255=127.5 -> 255*127.5/255=127.5 -> rounds to 128
    expect(coverageToHex([50], ['#ff0000'])).toBe('#ff8080')
  })

  it('throws when coverage and ink arrays disagree in length', () => {
    expect(() => coverageToHex([10, 20], ['#ff0000'])).toThrow()
  })

  it('commutes: ink order does not affect the composited colour (PRD §3.4 correction)', () => {
    const inks = ['#ff48b0', '#62a8e5', '#ffe800']
    const coverage = [30, 60, 45]
    const forward = coverageToHex(coverage, inks)

    const reversedInks = [...inks].reverse()
    const reversedCoverage = [...coverage].reverse()
    const reversed = coverageToHex(reversedCoverage, reversedInks)

    const shuffledInks = [inks[1], inks[2], inks[0]]
    const shuffledCoverage = [coverage[1], coverage[2], coverage[0]]
    const shuffled = coverageToHex(shuffledCoverage, shuffledInks)

    expect(reversed).toBe(forward)
    expect(shuffled).toBe(forward)
  })
})

describe('toEditableStops', () => {
  it('pairs each stop with its parallel coverage row and assigns a unique id', () => {
    const stops: GradientStop[] = [
      { hex: '#111111', position: 0 },
      { hex: '#222222', position: 100 },
    ]
    const coverage = [
      [10, 20],
      [80, 90],
    ]
    const editable = toEditableStops(stops, coverage)
    expect(editable.map((s) => s.coverage)).toEqual(coverage)
    expect(editable.map((s) => s.position)).toEqual([0, 100])
    expect(editable[0].id).not.toBe(editable[1].id)
  })
})

describe('equalizeEditableStops', () => {
  it('spreads 4 stops evenly across 0-100', () => {
    const editable: DrumEditableStop[] = [
      { id: 'a', coverage: [10], position: 0 },
      { id: 'b', coverage: [20], position: 0 },
      { id: 'c', coverage: [30], position: 0 },
      { id: 'd', coverage: [40], position: 0 },
    ]
    const result = equalizeEditableStops(editable)
    expect(result.map((s) => s.position)).toEqual([0, 33, 67, 100])
    expect(result.map((s) => s.coverage)).toEqual([[10], [20], [30], [40]])
  })
})

describe('isEvenlyDistributed', () => {
  it('is true for a fresh even ladder and false once dragged', () => {
    const even: DrumEditableStop[] = [
      { id: 'a', coverage: [10], position: 0 },
      { id: 'b', coverage: [20], position: 50 },
      { id: 'c', coverage: [30], position: 100 },
    ]
    expect(isEvenlyDistributed(even)).toBe(true)
    const dragged = moveStop(even, 'b', 70)
    expect(isEvenlyDistributed(dragged)).toBe(false)
  })
})

describe('reassignPositions', () => {
  it('keeps the sorted position ladder and re-pairs coverage by array order', () => {
    const stops: DrumEditableStop[] = [
      { id: 'a', coverage: [10], position: 100 },
      { id: 'b', coverage: [20], position: 0 },
    ]
    const result = reassignPositions(stops)
    expect(result).toEqual([
      { id: 'a', coverage: [10], position: 0 },
      { id: 'b', coverage: [20], position: 100 },
    ])
  })
})

describe('removeStopAt', () => {
  it('removes the stop with the matching id and leaves the rest in order', () => {
    const stops: DrumEditableStop[] = [
      { id: 'a', coverage: [10], position: 0 },
      { id: 'b', coverage: [20], position: 50 },
      { id: 'c', coverage: [30], position: 100 },
    ]
    expect(removeStopAt(stops, 'b').map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('addStop', () => {
  it('inserts the new stop at the largest gap midpoint with the given coverage', () => {
    const stops: DrumEditableStop[] = [
      { id: 'a', coverage: [10], position: 0 },
      { id: 'b', coverage: [20], position: 100 },
    ]
    const result = addStop(stops, [55])
    expect(result).toHaveLength(3)
    const added = result[2]
    expect(added.position).toBe(50)
    expect(added.coverage).toEqual([55])
  })
})

describe('moveStop', () => {
  it('clamps to [0,100] and re-sorts by position', () => {
    const stops: DrumEditableStop[] = [
      { id: 'a', coverage: [10], position: 0 },
      { id: 'b', coverage: [20], position: 50 },
    ]
    const result = moveStop(stops, 'a', 200)
    expect(result.map((s) => s.id)).toEqual(['b', 'a'])
    expect(result.find((s) => s.id === 'a')!.position).toBe(100)
  })
})

describe('toGradientCoverageStops', () => {
  const inks = ['#ff0000', '#0000ff']

  it('sorts stops and coverage from the same single sort, keeping them paired', () => {
    const editable: DrumEditableStop[] = [
      { id: 'a', coverage: [100, 0], position: 100 },
      { id: 'b', coverage: [0, 100], position: 0 },
    ]
    const { stops, coverage } = toGradientCoverageStops(editable, inks)
    expect(stops.map((s) => s.position)).toEqual([0, 100])
    expect(coverage).toEqual([
      [0, 100],
      [100, 0],
    ])
    // stop 0 (position 0) is 100% of the blue ink, stop 1 (position 100) is
    // 100% of the red ink — confirms coverage[i] and stops[i] stayed paired
    // through the sort, not just independently sorted to the same order.
    expect(stops[0].hex).toBe('#0000ff')
    expect(stops[1].hex).toBe('#ff0000')
  })
})

describe('generateGradientCoverage', () => {
  const inks = ['#ff48b0', '#62a8e5', '#ffe800']

  it('produces 3-6 stops with coverage rows matching the ink count', () => {
    const { stops, coverage } = generateGradientCoverage(inks)
    expect(stops.length).toBeGreaterThanOrEqual(3)
    expect(stops.length).toBeLessThanOrEqual(6)
    expect(coverage).toHaveLength(stops.length)
    for (const row of coverage) {
      expect(row).toHaveLength(inks.length)
      for (const pct of row) {
        expect(pct).toBeGreaterThanOrEqual(0)
        expect(pct).toBeLessThanOrEqual(100)
      }
    }
  })

  it('derives every stop hex from its paired coverage row', () => {
    const { stops, coverage } = generateGradientCoverage(inks)
    stops.forEach((stop, i) => {
      expect(stop.hex).toBe(coverageToHex(coverage[i], inks))
    })
  })

  it('honours a coverage lock at the given index', () => {
    const locked = [80, 10, 0]
    const { coverage } = generateGradientCoverage(inks, { 0: locked })
    expect(coverage[0]).toEqual(locked)
  })

  it('honours a position lock at the given index', () => {
    const { stops } = generateGradientCoverage(inks, {}, { 1: 42 })
    expect(stops[1].position).toBe(42)
  })

  it('guarantees enough stops to hold the highest locked index', () => {
    const { stops, coverage } = generateGradientCoverage(inks, { 5: [50, 50, 50] })
    expect(stops.length).toBeGreaterThanOrEqual(6)
    expect(coverage[5]).toEqual([50, 50, 50])
  })
})
