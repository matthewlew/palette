import { describe, it, expect } from 'vitest'
import { slideFilename } from './carouselExport'

describe('slideFilename', () => {
  it('numbers from 1, not 0', () => {
    expect(slideFilename(0, 3, 'composite')).toBe('1-composite.png')
  })

  it('pads so a zip sorts in slide order', () => {
    // The reason padding exists: unpadded, a lexical sort gives 1, 10, 2 —
    // and a zip has no order of its own, so the filename is the order.
    const total = 10
    const names = Array.from({ length: total }, (_, i) => slideFilename(i, total, 'composite'))
    expect(names[0]).toBe('01-composite.png')
    expect(names[9]).toBe('10-composite.png')
    expect([...names].sort()).toEqual(names)
  })

  it('does not pad when it is not needed', () => {
    expect(slideFilename(4, 9, 'composite')).toBe('5-composite.png')
  })

  it('labels the caption tile distinctly', () => {
    expect(slideFilename(5, 6, 'caption')).toBe('6-caption.png')
  })
})
