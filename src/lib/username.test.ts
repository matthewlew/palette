import { describe, expect, it } from 'vitest'
import { checkUsername, normalizeUsername } from './username'

describe('normalizeUsername', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  Ada  ')).toBe('ada')
  })
})

describe('checkUsername', () => {
  it('accepts a plain valid handle', () => {
    expect(checkUsername('ada')).toBeNull()
    expect(checkUsername('ada_lovelace1')).toBeNull()
  })

  it('rejects too short', () => {
    expect(checkUsername('ab')).toBe('too-short')
  })

  it('rejects too long', () => {
    expect(checkUsername('a'.repeat(21))).toBe('too-long')
  })

  it('rejects bad characters', () => {
    expect(checkUsername('ada!')).toBe('bad-characters')
    expect(checkUsername('a da')).toBe('bad-characters')
  })

  it('rejects leading or trailing underscore', () => {
    expect(checkUsername('_ada')).toBe('edge-underscore')
    expect(checkUsername('ada_')).toBe('edge-underscore')
  })

  it('rejects reserved words', () => {
    expect(checkUsername('admin')).toBe('reserved')
    expect(checkUsername('Palette')).toBe('reserved')
  })

  it('rejects profanity', () => {
    expect(checkUsername('fuck')).toBe('profane')
  })

  it('is case-insensitive for the shape/reserved checks', () => {
    expect(checkUsername('ADA')).toBeNull()
  })
})
