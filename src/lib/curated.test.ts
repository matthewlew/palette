import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isCuratedEntry, parseCurated, loadCurated, toCuratedEntryJson } from './curated'
import type { Gradient } from '../store/types'

describe('curated loader and parser', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const validEntry = {
    id: 'test-id-1',
    note: 'Beautiful sunset orange',
    date: '2026-07-10',
    gradient: {
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
      name: 'Sunset Orange',
    },
  }

  const invalidEntry = {
    id: 123, // should be string
    note: 'Broken entry',
    date: '2026-07-10',
    gradient: {
      type: 'linear',
      stops: [],
    },
  }

  it('validates a correct curated entry', () => {
    expect(isCuratedEntry(validEntry)).toBe(true)
    expect(isCuratedEntry(invalidEntry)).toBe(false)
  })

  it('parses valid curated entries and sorts them newest first', () => {
    const olderEntry = { ...validEntry, id: 'older', date: '2026-07-01' }
    const newerEntry = { ...validEntry, id: 'newer', date: '2026-07-09' }
    const parsed = parseCurated([olderEntry, newerEntry])
    expect(parsed).toHaveLength(2)
    expect(parsed[0].id).toBe('newer')
    expect(parsed[1].id).toBe('older')
  })

  it('skips invalid entries with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const parsed = parseCurated([validEntry, invalidEntry])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe('test-id-1')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('toCuratedEntryJson produces a valid curated entry', () => {
    const gradient: Gradient = {
      id: 'g-raw',
      type: 'radial',
      stops: [
        { hex: '#aabbcc', position: 0 },
        { hex: '#ddeeff', position: 100 },
      ],
      name: 'Ceramic Blue',
    }

    const jsonText = toCuratedEntryJson(gradient)
    const parsedObj = JSON.parse(jsonText)
    expect(isCuratedEntry(parsedObj)).toBe(true)
    expect(parsedObj.gradient.name).toBe('Ceramic Blue')
    expect(parsedObj.note).toBe('') // Curator fills this in
    expect(parsedObj.date).toBe(new Date().toISOString().slice(0, 10))
  })

  it('loadCurated handles 404 as empty with no error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadCurated()
    expect(result.entries).toEqual([])
    expect(result.error).toBe(false)
  })

  it('loadCurated handles fetch network errors gracefully', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadCurated()
    expect(result.entries).toEqual([])
    expect(result.error).toBe(true)
  })

  it('loadCurated loads parsed entries successfully on 200 OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [validEntry],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadCurated()
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].id).toBe('test-id-1')
    expect(result.error).toBe(false)
  })
})
