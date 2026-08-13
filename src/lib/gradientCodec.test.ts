import { describe, it, expect } from 'vitest'
import {
  encodeToFragment,
  decodeFromFragment,
  toExportJson,
  fromImportJson,
  importGradient,
  toSharePayloadGradient,
  isSharePayloadGradient,
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

  it('strips unknown legacy fields from old payloads (e.g. flutedEnabled)', () => {
    const legacy = {
      ...gradientA,
      flutedEnabled: true,
    } as SharePayloadGradient
    const g = importGradient(legacy)
    expect('flutedEnabled' in g).toBe(false)
  })
})

describe('isSharePayloadGradient hardening (via fromImportJson)', () => {
  function boardWith(gradient: unknown): string {
    return JSON.stringify({ kind: 'gradient', gradients: [gradient] })
  }

  it('rejects gradients with fewer than 2 stops', () => {
    expect(fromImportJson(boardWith({ ...gradientA, stops: [] }))).toBeNull()
    expect(fromImportJson(boardWith({ ...gradientA, stops: [gradientA.stops[0]] }))).toBeNull()
  })

  it('rejects unknown gradient types', () => {
    expect(fromImportJson(boardWith({ ...gradientA, type: 'conic' }))).toBeNull()
  })

  it('rejects non-hex color strings (CSS injection guard)', () => {
    const evil = {
      ...gradientA,
      stops: [
        { hex: '#fff), url(https://evil.example/p), linear-gradient(#fff', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
    }
    expect(fromImportJson(boardWith(evil))).toBeNull()
  })

  it('rejects out-of-range or non-finite stop positions', () => {
    expect(
      fromImportJson(boardWith({ ...gradientA, stops: [{ hex: '#ff0000', position: -1 }, { hex: '#0000ff', position: 100 }] }))
    ).toBeNull()
    expect(
      fromImportJson(boardWith({ ...gradientA, stops: [{ hex: '#ff0000', position: 0 }, { hex: '#0000ff', position: 1e9 }] }))
    ).toBeNull()
  })

  it('rejects gradients with more than 32 stops', () => {
    const tooManyStops = Array.from({ length: 33 }, (_, i) => ({
      hex: '#ff0000',
      position: Math.floor((i / 33) * 100),
    }))
    expect(fromImportJson(boardWith({ ...gradientA, stops: tooManyStops }))).toBeNull()
  })

  it('rejects names longer than 80 characters', () => {
    const longName = 'a'.repeat(81)
    expect(fromImportJson(boardWith({ ...gradientA, name: longName }))).toBeNull()
  })

  it('rejects boards with more than 50 gradients', () => {
    const tooManyGradients = Array.from({ length: 51 }, () => gradientA)
    const boardPayload = JSON.stringify({ kind: 'board', gradients: tooManyGradients })
    expect(fromImportJson(boardPayload)).toBeNull()
  })

  it('rejects invalid optional flag types', () => {
    expect(fromImportJson(boardWith({ ...gradientA, reversed: 'yes' }))).toBeNull()
    expect(fromImportJson(boardWith({ ...gradientA, repeatEnabled: 1 }))).toBeNull()
    expect(fromImportJson(boardWith({ ...gradientA, hardStops: null }))).toBeNull()
  })

  it('still accepts a valid gradient', () => {
    expect(fromImportJson(boardWith(gradientA))).not.toBeNull()
  })
})

describe('importGradient stop sanitization', () => {
  it('rebuilds stop objects so extra keys are stripped', () => {
    const dirty = {
      ...gradientA,
      stops: [
        { hex: '#ff0000', position: 0, tracking: 'x' },
        { hex: '#0000ff', position: 100 },
      ],
    } as unknown as SharePayloadGradient
    const g = importGradient(dirty)
    expect(g.stops[0]).toEqual({ hex: '#ff0000', position: 0 })
    expect('tracking' in g.stops[0]).toBe(false)
  })
})

describe('smoothEnabled persistence', () => {
  const g = {
    id: 'x',
    type: 'linear' as const,
    stops: [
      { hex: '#000000', position: 0 },
      { hex: '#ffffff', position: 100 },
    ],
    smoothEnabled: true,
    name: 'n',
  }

  it('round-trips smoothEnabled through the share payload', () => {
    const round = importGradient(toSharePayloadGradient(g))
    expect(round.smoothEnabled).toBe(true)
  })

  it('validates smoothEnabled as an optional boolean', () => {
    const base = {
      type: 'linear',
      stops: [
        { hex: '#000000', position: 0 },
        { hex: '#ffffff', position: 100 },
      ],
      name: 'n',
    }
    expect(isSharePayloadGradient({ ...base, smoothEnabled: true })).toBe(true)
    expect(isSharePayloadGradient({ ...base, smoothEnabled: 'yes' })).toBe(false)
  })
})

describe('prismEnabled persistence', () => {
  const base = {
    type: 'linear' as const,
    stops: [
      { hex: '#ff8800', position: 0 },
      { hex: '#0044ff', position: 100 },
    ],
    name: 'n',
  }

  it('round-trips prismEnabled through the share payload', () => {
    const round = importGradient(toSharePayloadGradient({ id: 'x', ...base, prismEnabled: true }))
    expect(round.prismEnabled).toBe(true)
  })

  it('leaves prismEnabled absent when it was never set', () => {
    const round = importGradient(toSharePayloadGradient({ id: 'x', ...base }))
    expect('prismEnabled' in round).toBe(false)
  })

  it('validates prismEnabled as an optional boolean', () => {
    expect(isSharePayloadGradient({ ...base, prismEnabled: true })).toBe(true)
    expect(isSharePayloadGradient({ ...base, prismEnabled: 'yes' })).toBe(false)
  })
})

describe('riso persistence (Drum ink coverage metadata, PRD §5.1/§5.3)', () => {
  const risoGradient = {
    ...gradientA,
    riso: {
      inks: ['Fluorescent Pink', 'Cornflower', 'Yellow'],
      coverage: [
        [10, 5, 60],
        [70, 0, 35],
      ],
    },
  }

  it('round-trips riso through the share payload', () => {
    const round = importGradient(toSharePayloadGradient({ id: 'x', ...risoGradient }))
    expect(round.riso).toEqual(risoGradient.riso)
  })

  it('is absent on an ordinary palette gradient instead of writing an undefined key', () => {
    const g = importGradient(gradientA)
    expect('riso' in g).toBe(false)
  })

  it('rebuilds inks and coverage so extra keys are stripped', () => {
    const dirty = {
      ...risoGradient,
      riso: { ...risoGradient.riso, tracking: 'x' },
    } as unknown as SharePayloadGradient
    const g = importGradient(dirty)
    expect('tracking' in (g.riso as object)).toBe(false)
  })

  it('accepts a valid riso block', () => {
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [risoGradient] }))).not.toBeNull()
  })

  it('rejects a coverage row count that does not match stop count', () => {
    const bad = { ...risoGradient, riso: { ...risoGradient.riso, coverage: [[10, 5, 60]] } }
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [bad] }))).toBeNull()
  })

  it('rejects a coverage row width that does not match ink count', () => {
    const bad = { ...risoGradient, riso: { ...risoGradient.riso, coverage: [[10, 5], [70, 0]] } }
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [bad] }))).toBeNull()
  })

  it('rejects out-of-range coverage percentages', () => {
    const bad = { ...risoGradient, riso: { ...risoGradient.riso, coverage: [[10, 5, 160], [70, 0, 35]] } }
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [bad] }))).toBeNull()
  })

  it('rejects an empty or oversized ink list', () => {
    const empty = { ...risoGradient, riso: { inks: [], coverage: [[], []] } }
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [empty] }))).toBeNull()

    const tooManyInks = Array.from({ length: 9 }, (_, i) => `Ink ${i}`)
    const oversized = {
      ...risoGradient,
      riso: { inks: tooManyInks, coverage: risoGradient.riso.coverage.map(() => tooManyInks.map(() => 0)) },
    }
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [oversized] }))).toBeNull()
  })

  it('rejects non-string ink names', () => {
    const bad = { ...risoGradient, riso: { inks: ['Pink', 42], coverage: risoGradient.riso.coverage } }
    expect(fromImportJson(JSON.stringify({ kind: 'gradient', gradients: [bad] }))).toBeNull()
  })
})
