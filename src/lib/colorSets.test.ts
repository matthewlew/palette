import { describe, it, expect } from 'vitest'
import { DEFAULT_COLOR_SET } from './colorSets'

describe('DEFAULT_COLOR_SET', () => {
  it('has exactly 36 colors', () => {
    expect(DEFAULT_COLOR_SET.colors).toHaveLength(36)
  })

  it('has unique names', () => {
    const names = DEFAULT_COLOR_SET.colors.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has valid OKLCH ranges for every color', () => {
    for (const { value } of DEFAULT_COLOR_SET.colors) {
      expect(value.l).toBeGreaterThanOrEqual(0)
      expect(value.l).toBeLessThanOrEqual(1)
      expect(value.c).toBeGreaterThanOrEqual(0)
      expect(value.c).toBeLessThanOrEqual(0.4)
      expect(value.h).toBeGreaterThanOrEqual(0)
      expect(value.h).toBeLessThan(360)
    }
  })
})
