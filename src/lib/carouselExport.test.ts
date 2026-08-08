import { describe, it, expect, vi, afterEach } from 'vitest'
import { slideFilename, exportCarousel, type CarouselSpec } from './carouselExport'
import type { Gradient } from '../store/types'

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

function gradient(id: string): Gradient {
  return {
    id,
    name: `G${id}`,
    type: 'linear',
    angle: 90,
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
  } as Gradient
}

const SPEC: CarouselSpec = {
  templateId: 'singles',
  gradients: [gradient('a'), gradient('b')],
  ratio: 'portrait',
  carousel: { captionTile: false },
}

/** jsdom canvases have no 2d surface and toBlob never calls back, so the render
 * loop is stubbed at the blob boundary. What's under test here is delivery —
 * which route the files take to the device — not the pixels. */
function stubRendering() {
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['x'], { type: 'image/png' }))
  }
}

function stubShare(canShare: boolean, share: (data: ShareData) => Promise<void>) {
  Object.assign(navigator, {
    canShare: () => canShare,
    share,
  })
}

describe('exportCarousel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'canShare')
    Reflect.deleteProperty(navigator, 'share')
  })

  it('hands every slide to the share sheet in one payload', async () => {
    // The whole point of the share route: iOS offers "Save N Images" only when
    // the files arrive together. One share call per slide would be N prompts.
    stubRendering()
    const share = vi.fn(async (_data: ShareData) => {})
    stubShare(true, share)

    const result = await exportCarousel(SPEC)

    expect(result).toEqual({ delivery: 'shared', count: 2 })
    const payload = share.mock.calls[0][0]
    expect(payload.files).toHaveLength(2)
    expect(payload.files?.map((f) => f.name)).toEqual(['1-composite.png', '2-composite.png'])
    expect(payload.files?.every((f) => f.type === 'image/png')).toBe(true)
  })

  it('carries the caption as text, not as a file', async () => {
    // A .txt in the payload makes iOS offer "Save to Files" instead of "Save
    // Images", which loses the one thing the share route is for.
    stubRendering()
    const share = vi.fn(async (_data: ShareData) => {})
    stubShare(true, share)

    await exportCarousel(SPEC)

    const payload = share.mock.calls[0][0]
    expect(payload.text).toBeTruthy()
    expect(payload.files?.some((f) => f.name.endsWith('.txt'))).toBe(false)
  })

  it('falls back to one download per slide where sharing files is unsupported', async () => {
    stubRendering()
    stubShare(false, vi.fn())
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await exportCarousel(SPEC)

    expect(result).toEqual({ delivery: 'downloaded', count: 2 })
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('treats a dismissed share sheet as a decision, not a failure', async () => {
    // Falling back to downloads here would dump N files on someone who just
    // backed out of the share sheet.
    stubRendering()
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    stubShare(true, vi.fn(async () => { throw abort }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await exportCarousel(SPEC)

    expect(result).toEqual({ delivery: 'cancelled', count: 0 })
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to downloads when sharing fails for any other reason', async () => {
    stubRendering()
    stubShare(true, vi.fn(async () => { throw new Error('nope') }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await exportCarousel(SPEC)

    expect(result).toEqual({ delivery: 'downloaded', count: 2 })
    expect(click).toHaveBeenCalledTimes(2)
  })
})
