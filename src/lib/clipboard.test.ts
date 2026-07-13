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
  it('writes SVG (with embedded payload) to text/plain and image/svg+xml, and prevents default', () => {
    const { event, store, preventDefault } = fakeEvent()
    writeGradientToClipboard(event, gradient)
    expect(preventDefault).toHaveBeenCalled()
    // text/plain is the SVG so Figma imports it as vector, with the Palette
    // JSON embedded in <metadata> for exact round-trips.
    expect(store.get('text/plain')).toContain('<svg')
    expect(store.get('text/plain')).toContain('<metadata>')
    expect(store.get('text/plain')).toContain('"kind": "gradient"')
    expect(store.get('image/svg+xml')).toContain('<svg')
  })

  it('does not set text/html (Figma would treat it as rich text)', () => {
    const { event, store } = fakeEvent()
    writeGradientToClipboard(event, gradient)
    expect(store.has('text/html')).toBe(false)
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

  it('still reads raw Palette JSON (older copies / pasted exports)', () => {
    const rawJson = JSON.stringify({
      kind: 'gradient',
      gradients: [
        {
          type: 'radial',
          stops: [
            { hex: '#000000', position: 0 },
            { hex: '#ffffff', position: 100 },
          ],
          name: 'Mono',
        },
      ],
    })
    const { event } = fakeEvent({ 'text/plain': rawJson })
    const result = readGradientsFromClipboard(event)
    expect(result).not.toBeNull()
    expect(result![0].type).toBe('radial')
  })

  it('returns null for foreign / non-JSON clipboard text', () => {
    const { event } = fakeEvent({ 'text/plain': 'hello world' })
    expect(readGradientsFromClipboard(event)).toBeNull()
  })

  it('returns null when there is no clipboardData', () => {
    expect(readGradientsFromClipboard({} as ClipboardEvent)).toBeNull()
  })
})
