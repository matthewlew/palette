import { describe, it, expect } from 'vitest'
import { renderSettingsOf, parseRenderSettings, sameRenderSettings } from './renderSettings'
import type { Gradient } from '../store/types'

function gradient(overrides: Partial<Gradient> = {}): Gradient {
  return {
    id: 'g1',
    type: 'linear',
    stops: [
      { hex: '#000000', position: 0 },
      { hex: '#ffffff', position: 100 },
    ],
    ...overrides,
  }
}

describe('renderSettingsOf', () => {
  it('stores nothing for a gradient that is all defaults', () => {
    expect(renderSettingsOf(gradient())).toBeNull()
  })

  it('treats an explicit rectangle and a bottom fan as defaults', () => {
    expect(renderSettingsOf(gradient({ crop: 'rectangle', fanAnchor: 'bottom' }))).toBeNull()
  })

  it('omits effects that are off rather than writing them out as false', () => {
    const settings = renderSettingsOf(gradient({ crop: 'circle', hardStops: false }))
    expect(settings).toEqual({ crop: 'circle' })
  })

  it('carries every non-default setting', () => {
    const settings = renderSettingsOf(
      gradient({
        crop: 'oval',
        reversed: true,
        hardStops: true,
        repeatEnabled: true,
        smoothEnabled: true,
        prismEnabled: true,
        fanAnchor: 'left',
      }),
    )
    expect(settings).toEqual({
      crop: 'oval',
      reversed: true,
      hardStops: true,
      repeatEnabled: true,
      smoothEnabled: true,
      prismEnabled: true,
      fanAnchor: 'left',
    })
  })
})

describe('parseRenderSettings', () => {
  it('reads a row published before the column existed as all defaults', () => {
    expect(parseRenderSettings(null)).toEqual({})
    expect(parseRenderSettings(undefined)).toEqual({})
  })

  it('round-trips what renderSettingsOf writes', () => {
    const g = gradient({ crop: 'circle', prismEnabled: true, fanAnchor: 'top' })
    expect(parseRenderSettings(renderSettingsOf(g))).toEqual({
      crop: 'circle',
      prismEnabled: true,
      fanAnchor: 'top',
    })
  })

  it('drops a crop nothing knows how to draw', () => {
    // jsonb holds anything, and an unknown crop reaches the render path as a
    // shape with no clip-path — worse than ignoring it.
    expect(parseRenderSettings({ crop: 'hexagon' })).toEqual({})
  })

  it('drops unknown keys and non-boolean flags', () => {
    expect(parseRenderSettings({ hardStops: 'yes', glow: true, reversed: true })).toEqual({
      reversed: true,
    })
  })

  it('ignores a blob that is not an object', () => {
    expect(parseRenderSettings('circle')).toEqual({})
    expect(parseRenderSettings(['circle'])).toEqual({})
  })
})

describe('sameRenderSettings', () => {
  it('treats null and an all-defaults blob as the same', () => {
    expect(sameRenderSettings(null, {})).toBe(true)
    expect(sameRenderSettings(undefined, null)).toBe(true)
  })

  it('does not care about key order, which jsonb does not preserve', () => {
    expect(
      sameRenderSettings({ crop: 'circle', reversed: true }, { reversed: true, crop: 'circle' }),
    ).toBe(true)
  })

  it('separates a cropped gradient from an uncropped one', () => {
    expect(sameRenderSettings({ crop: 'circle' }, null)).toBe(false)
  })
})
