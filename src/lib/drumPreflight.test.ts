import { describe, it, expect } from 'vitest'
import { checkCoverage, checkGradientCoverage } from './drumPreflight'

const inkNames = ['Black', 'Cornflower', 'Yellow']

describe('checkCoverage', () => {
  it('flags nothing for coverage within bounds', () => {
    expect(checkCoverage([50, 30, 20], inkNames)).toEqual([])
  })

  it('flags a single ink above the 80% ceiling', () => {
    const issues = checkCoverage([85, 0, 0], inkNames)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('single-ink-ceiling')
    expect(issues[0].message).toContain('Black')
    expect(issues[0].message).toContain('85%')
  })

  it('flags total ink above the 180% cross-layer ceiling', () => {
    const issues = checkCoverage([70, 70, 70], inkNames)
    expect(issues.some((i) => i.code === 'total-ink')).toBe(true)
    expect(issues.find((i) => i.code === 'total-ink')?.message).toContain('210%')
  })

  it('flags a nonzero ink below the 10% floor, but not an absent (0%) ink', () => {
    const issues = checkCoverage([5, 0, 50], inkNames)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('gradient-floor')
    expect(issues[0].message).toContain('Black')
  })

  it('can flag multiple issues on the same stop at once', () => {
    const issues = checkCoverage([90, 90, 5], inkNames)
    const codes = issues.map((i) => i.code).sort()
    expect(codes).toEqual(['gradient-floor', 'single-ink-ceiling', 'single-ink-ceiling', 'total-ink'])
  })
})

describe('checkGradientCoverage', () => {
  it('returns only the stops that actually have an issue, in order', () => {
    const stops = [
      { id: 'a', coverage: [50, 30, 20] },
      { id: 'b', coverage: [90, 0, 0] },
      { id: 'c', coverage: [40, 40, 40] },
    ]
    const result = checkGradientCoverage(stops, inkNames)
    expect(result.map((r) => r.stopId)).toEqual(['b'])
    expect(result[0].issues[0].code).toBe('single-ink-ceiling')
  })

  it('returns an empty array when every stop is clean', () => {
    const stops = [{ id: 'a', coverage: [50, 50] }]
    expect(checkGradientCoverage(stops, ['Black', 'Cornflower'])).toEqual([])
  })
})
