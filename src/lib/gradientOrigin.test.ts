import { describe, it, expect } from 'vitest'
import { defaultAngleForType, angleForTypeChange, getRadialConfig } from './gradient'
import type { GradientType } from './gradient'

const ORIGIN: GradientType[] = ['radial', 'square']
const DIRECTIONAL: GradientType[] = ['linear', 'angular', 'mirror', 'fan']

describe('where a shape starts', () => {
  it('centres radial and Turrell', () => {
    // undefined IS centre for these two — see getRadialConfig.
    for (const type of ORIGIN) {
      expect(defaultAngleForType(type)).toBeUndefined()
    }
    expect(getRadialConfig(defaultAngleForType('radial')).css).toBe('center')
    expect(getRadialConfig(defaultAngleForType('square')).css).toBe('center')
  })

  it('starts the directional shapes at 0', () => {
    for (const type of DIRECTIONAL) {
      expect(defaultAngleForType(type)).toBe(0)
    }
  })

  it('resets the origin when the shape crosses the boundary', () => {
    // 0 means two different things. For linear it is the default DIRECTION;
    // for radial it is "origin at the top edge". Carrying it across silently
    // reinterpreted it, so switching a linear gradient to Radial or Turrell
    // produced a burst pinned to the top rather than a centred one.
    expect(angleForTypeChange('linear', 'radial', 0)).toBeUndefined()
    expect(angleForTypeChange('linear', 'square', 0)).toBeUndefined()
    expect(angleForTypeChange('angular', 'radial', 90)).toBeUndefined()
    expect(getRadialConfig(angleForTypeChange('linear', 'radial', 0)).css).toBe('center')

    // And back the other way: an origin type's undefined would read as
    // "no angle" to a linear gradient, which is not the same as its default.
    expect(angleForTypeChange('radial', 'linear', undefined)).toBe(0)
    expect(angleForTypeChange('square', 'fan', 135)).toBe(0)
  })

  it('keeps a deliberately rotated origin within the family', () => {
    // Rotate a radial to the top-left, switch to Turrell: it stays there.
    expect(angleForTypeChange('radial', 'square', 315)).toBe(315)
    expect(angleForTypeChange('square', 'radial', undefined)).toBeUndefined()
  })

  it('keeps a direction within the directional family', () => {
    expect(angleForTypeChange('linear', 'angular', 90)).toBe(90)
    expect(angleForTypeChange('fan', 'linear', 225)).toBe(225)
  })
})
