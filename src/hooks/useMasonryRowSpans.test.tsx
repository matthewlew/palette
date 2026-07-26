import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import { useMasonryRowSpans } from './useMasonryRowSpans'

/* Pins the three defects behind the mobile create->gallery jitter:
 *   1. read/write phases were interleaved (a forced reflow per child)
 *   2. every child's resize re-ran the whole pass (n passes over n children)
 *   3. spans were written even when unchanged, so the loop fed itself
 */

const TILE_HEIGHTS = [204, 246, 259, 287, 163, 149]
const ROW_UNIT = 8
const GAP = 12
const spanOf = (h: number) => Math.max(1, Math.ceil((h + GAP) / (ROW_UNIT + GAP)))

let observerCb: ResizeObserverCallback | null = null
let observed: Element[] = []
let rafQueue: FrameRequestCallback[] = []
/** Every offsetHeight read and gridRowEnd write, in order. */
let journal: string[] = []

function flushFrame() {
  const due = rafQueue
  rafQueue = []
  due.forEach((cb) => cb(0))
}

beforeEach(() => {
  observerCb = null
  observed = []
  rafQueue = []
  journal = []

  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: ResizeObserverCallback) { observerCb = cb }
    observe(el: Element) { observed.push(el) }
    disconnect() {}
    unobserve() {}
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length })
  vi.stubGlobal('cancelAnimationFrame', () => { rafQueue = [] })
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ rowGap: `${GAP}px` } as CSSStyleDeclaration)
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function Grid({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useMasonryRowSpans(ref, enabled, ['fixed-deps'])
  return (
    <div ref={ref} data-testid="grid">
      {TILE_HEIGHTS.map((_, i) => <div key={i} data-tile={i} />)}
    </div>
  )
}

/** Instrument the tiles so reads and writes are recorded in order. */
function instrument(container: HTMLElement) {
  const tiles = [...container.querySelectorAll('[data-tile]')] as HTMLElement[]
  tiles.forEach((tile, i) => {
    Object.defineProperty(tile, 'offsetHeight', {
      get() { journal.push(`read:${i}`); return TILE_HEIGHTS[i] },
      configurable: true,
    })
    let current = ''
    Object.defineProperty(tile.style, 'gridRowEnd', {
      get() { return current },
      set(v: string) { journal.push(`write:${i}`); current = v },
      configurable: true,
    })
  })
  return tiles
}

describe('useMasonryRowSpans', () => {
  it('assigns each tile a span matching its measured height', () => {
    const { container } = render(<Grid />)
    const tiles = instrument(container)
    journal = []
    observerCb?.([], {} as ResizeObserver)
    flushFrame()
    tiles.forEach((tile, i) => {
      expect(tile.style.gridRowEnd).toBe(`span ${spanOf(TILE_HEIGHTS[i])}`)
    })
  })

  it('reads every height before writing any span', () => {
    // Interleaving them forces a synchronous layout per child, which is what
    // made the pass expensive enough to drop frames on mobile.
    const { container } = render(<Grid />)
    instrument(container)
    journal = []
    observerCb?.([], {} as ResizeObserver)
    flushFrame()

    const lastRead = journal.lastIndexOf(journal.filter((e) => e.startsWith('read')).at(-1)!)
    const firstWrite = journal.findIndex((e) => e.startsWith('write'))
    expect(firstWrite).toBeGreaterThan(lastRead)
  })

  it('coalesces a burst of resize callbacks into ONE pass', () => {
    const { container } = render(<Grid />)
    instrument(container)
    journal = []
    // One resize event per observed child, as a view transition produces.
    for (let i = 0; i < TILE_HEIGHTS.length; i++) observerCb?.([], {} as ResizeObserver)
    expect(rafQueue.length).toBe(1) // not one frame per child
    flushFrame()
    expect(journal.filter((e) => e.startsWith('read')).length).toBe(TILE_HEIGHTS.length)
  })

  it('skips writes when the span has not changed, so it cannot feed itself', () => {
    const { container } = render(<Grid />)
    instrument(container)
    observerCb?.([], {} as ResizeObserver)
    flushFrame()
    journal = []
    // Nothing resized; a second pass must write nothing at all.
    observerCb?.([], {} as ResizeObserver)
    flushFrame()
    expect(journal.filter((e) => e.startsWith('write'))).toHaveLength(0)
  })

  it('writes again when a tile genuinely changes height', () => {
    const { container } = render(<Grid />)
    const tiles = instrument(container)
    observerCb?.([], {} as ResizeObserver)
    flushFrame()
    Object.defineProperty(tiles[2], 'offsetHeight', { get: () => 400, configurable: true })
    journal = []
    observerCb?.([], {} as ResizeObserver)
    flushFrame()
    expect(journal.filter((e) => e.startsWith('write'))).toEqual(['write:2'])
    expect(tiles[2].style.gridRowEnd).toBe(`span ${spanOf(400)}`)
  })

  it('sets spans synchronously on mount, before any frame runs', () => {
    // Deferring the first pass would paint every tile in its default 8px slot.
    const { container } = render(<Grid />)
    const tiles = [...container.querySelectorAll('[data-tile]')] as HTMLElement[]
    expect(tiles.every((t) => t.style.gridRowEnd.startsWith('span '))).toBe(true)
  })

  it('clears spans when masonry is turned off', () => {
    const { container, rerender } = render(<Grid enabled />)
    rerender(<Grid enabled={false} />)
    const tiles = [...container.querySelectorAll('[data-tile]')] as HTMLElement[]
    expect(tiles.every((t) => t.style.gridRowEnd === '')).toBe(true)
  })
})
