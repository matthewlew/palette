import { describe, it, expect, vi } from 'vitest'
import { writeGradientToClipboard, readGradientsFromClipboard } from './clipboard'
import type { Gradient } from '../store/types'

function fakeEvent(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  const preventDefault = vi.fn()
  return {
    event: {
      preventDefault,
      clipboardData: {
        setData: (type: string, val: string) => store.set(type, val),
        getData: (type: string) => store.get(type) ?? '',
      },
    } as unknown as ClipboardEvent,
    store,
    preventDefault,
  }
}

const gradient: Gradient = {
  id: 'abc',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  name: 'Sunset',
}

describe('writeGradientToClipboard', () => {
  it('writes text/plain JSON, image/svg+xml, and text/html and prevents default', () => {
    const { event, store, preventDefault } = fakeEvent()
    writeGradientToClipboard(event, gradient)
    expect(preventDefault).toHaveBeenCalled()
    expect(store.get('text/plain')).toContain('"kind": "gradient"')
    expect(store.get('image/svg+xml')).toContain('<svg')
    expect(store.get('text/html')).toContain('<svg')
  })
})

describe('readGradientsFromClipboard', () => {
  it('round-trips a written gradient back into Gradient objects', () => {
    const { event: writeEv, store } = fakeEvent()
    writeGradientToClipboard(writeEv, gradient)
    const { event: readEv } = fakeEvent({ 'text/plain': store.get('text/plain')! })
    const result = readGradientsFromClipboard(readEv)
    expect(result).not.toBeNull()
    expect(result!).toHaveLength(1)
    expect(result![0].type).toBe('linear')
    expect(result![0].name).toBe('Sunset')
    expect(result![0].id).not.toBe('abc')
  })

  it('returns null for foreign / non-JSON clipboard text', () => {
    const { event } = fakeEvent({ 'text/plain': 'hello world' })
    expect(readGradientsFromClipboard(event)).toBeNull()
  })

  it('returns null when there is no clipboardData', () => {
    expect(readGradientsFromClipboard({} as ClipboardEvent)).toBeNull()
  })
})
