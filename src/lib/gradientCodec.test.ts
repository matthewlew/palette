import { describe, it, expect } from 'vitest'
import {
  encodeToFragment,
  decodeFromFragment,
  toExportJson,
  fromImportJson,
  importGradient,
  type SharePayload,
  type SharePayloadGradient,
} from './gradientCodec'

const gradientA = {
  type: 'linear' as const,
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  name: 'Test Gradient',
}

const gradientB = {
  type: 'radial' as const,
  stops: [
    { hex: '#00ff00', position: 0 },
    { hex: '#ffff00', position: 50 },
    { hex: '#ff00ff', position: 100 },
  ],
  reversed: true,
  name: 'Second Gradient',
}

describe('gradientCodec fragment round-trip', () => {
  it('round-trips a single gradient payload', () => {
    const payload: SharePayload = { kind: 'gradient', gradients: [gradientA] }
    const fragment = encodeToFragment(payload)
    expect(decodeFromFragment(fragment)).toEqual(payload)
  })

  it('round-trips a board payload with multiple gradients', () => {
    const payload: SharePayload = { kind: 'board', gradients: [gradientA, gradientB] }
    const fragment = encodeToFragment(payload)
    expect(decodeFromFragment(fragment)).toEqual(payload)
  })

  it('returns null for a malformed fragment instead of throwing', () => {
    expect(decodeFromFragment('d=not-valid-base64!!!')).toBeNull()
  })

  it('returns null for a fragment with no d= param', () => {
    expect(decodeFromFragment('')).toBeNull()
  })
})

describe('gradientCodec JSON round-trip', () => {
  it('round-trips a board payload through JSON text', () => {
    const payload: SharePayload = { kind: 'board', gradients: [gradientA, gradientB] }
    const json = toExportJson(payload)
    expect(fromImportJson(json)).toEqual(payload)
  })

  it('returns null for invalid JSON text', () => {
    expect(fromImportJson('{not json')).toBeNull()
  })

  it('returns null for well-formed JSON missing required shape', () => {
    expect(fromImportJson(JSON.stringify({ foo: 'bar' }))).toBeNull()
    expect(fromImportJson(JSON.stringify({ kind: 'gradient' }))).toBeNull()
    expect(fromImportJson(JSON.stringify({ kind: 'nonsense', gradients: [] }))).toBeNull()
  })
})

describe('importGradient', () => {
  it('assigns a fresh id and copies the known wire fields', () => {
    const g = importGradient({ ...gradientA, reversed: true, hardStops: true })
    expect(g.id).toBeTruthy()
    expect(g).toMatchObject({ ...gradientA, reversed: true, hardStops: true })
    expect(importGradient(gradientA).id).not.toBe(g.id)
  })

  it('omits optional flags that are absent instead of writing undefined keys', () => {
    const g = importGradient(gradientA)
    expect('reversed' in g).toBe(false)
    expect('repeatEnabled' in g).toBe(false)
    expect('hardStops' in g).toBe(false)
  })

  it('strips unknown legacy fields from old payloads (e.g. smoothEnabled/flutedEnabled)', () => {
    const legacy = {
      ...gradientA,
      smoothEnabled: true,
      flutedEnabled: true,
    } as SharePayloadGradient
    const g = importGradient(legacy)
    expect('smoothEnabled' in g).toBe(false)
    expect('flutedEnabled' in g).toBe(false)
  })
})
