import { describe, it, expect } from 'vitest'
import {
  encodeToFragment,
  decodeFromFragment,
  toExportJson,
  fromImportJson,
  type SharePayload,
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
