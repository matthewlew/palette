import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useStopDrift } from './useStopDrift'
import type { Gradient } from '../store/types'

/* The browser preview pane runs with document.hidden === true, which suspends
 * requestAnimationFrame entirely — so the animation cannot be observed there.
 * These tests drive the clock by hand instead, which is stricter anyway: they
 * assert the exact frames rather than eyeballing motion. */

let pending: FrameRequestCallback[] = []
let nextId = 1

function paint(atMs: number) {
  const due = pending
  pending = []
  act(() => { due.forEach((cb) => cb(atMs)) })
}

beforeEach(() => {
  pending = []
  nextId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { pending.push(cb); return nextId++ })
  vi.stubGlobal('cancelAnimationFrame', () => { pending = [] })
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    addListener() {}, removeListener() {},
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const gradient = (type: Gradient['type'] = 'linear'): Gradient => ({
  id: 'g', type,
  stops: [
    { hex: '#622b00', position: 0 },
    { hex: '#00897e', position: 40 },
    { hex: '#798184', position: 80 },
  ],
})

const STATIC_CSS = 'linear-gradient(180deg, #622b00 0%, #798184 80%)'
/** jsdom rewrites hex to rgb() when a style is set, so the literal above is not
 *  what comes back out. Read the normalised form off a freshly rendered node. */
let STATIC_NORMALISED = ''

function Harness({ g, enabled }: { g: Gradient; enabled: boolean }) {
  const ref = useStopDrift(g, enabled)
  return <div data-testid="surface" ref={ref} style={{ backgroundImage: STATIC_CSS }} />
}

// Scoped to this render's own container — getByTestId searches the whole body,
// so two renders in one test would collide.
const surfaceOf = (c: { container: HTMLElement }) =>
  c.container.querySelector('[data-testid="surface"]') as HTMLElement

describe('useStopDrift', () => {
  it('leaves the static background alone when disabled', () => {
    const c = render(<Harness g={gradient()} enabled={false} />)
    const el = surfaceOf(c)
    STATIC_NORMALISED = el.style.backgroundImage
    expect(STATIC_NORMALISED).toContain('linear-gradient')
    expect(STATIC_NORMALISED).toContain('80%')
    expect(el.dataset.drift).toBe('off')
  })

  /** The static background as the DOM reports it. */
  const staticCss = () => {
    const probe = render(<Harness g={gradient()} enabled={false} />)
    const css = surfaceOf(probe).style.backgroundImage
    probe.unmount()
    return css
  }

  it('writes a new background on each frame when enabled', () => {
    const c = render(<Harness g={gradient()} enabled />)
    const el = surfaceOf(c)
    expect(el.dataset.drift).toBe('on')

    paint(0)
    const f1 = el.style.backgroundImage
    paint(2000)
    const f2 = el.style.backgroundImage
    paint(5000)
    const f3 = el.style.backgroundImage

    expect(f1).not.toBe(staticCss())
    expect(new Set([f1, f2, f3]).size).toBe(3)
  })

  it('never changes a colour, only the positions', () => {
    const c = render(<Harness g={gradient()} enabled />)
    const el = surfaceOf(c)
    const hexes = (css: string) => (css.match(/rgb\([^)]*\)/g) || []).join(',')
    paint(0)
    const first = hexes(el.style.backgroundImage)
    paint(3000)
    paint(7000)
    expect(hexes(el.style.backgroundImage)).toBe(first)
  })

  it('restores the exact static background when stopped', () => {
    const c = render(<Harness g={gradient()} enabled />)
    const el = surfaceOf(c)
    paint(0)
    paint(1500)
    const original = staticCss()
    expect(el.style.backgroundImage).not.toBe(original)
    c.rerender(<Harness g={gradient()} enabled={false} />)
    expect(el.style.backgroundImage).toBe(original)
    expect(el.dataset.drift).toBe('off')
  })

  it('does not run for a geometry that ignores stop positions', () => {
    const c = render(<Harness g={gradient('angular')} enabled />)
    const el = surfaceOf(c)
    expect(el.dataset.drift).toBe('unsupported-type:angular')
    expect(pending).toHaveLength(0)
    expect(el.style.backgroundImage).toBe(staticCss())
  })

  it('does not run when the user has asked for reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true, addEventListener() {}, removeEventListener() {},
    }))
    const c = render(<Harness g={gradient()} enabled />)
    const el = surfaceOf(c)
    expect(el.dataset.drift).toBe('reduced-motion')
    expect(el.style.backgroundImage).toContain('linear-gradient')
  })

  it('does not leap forward after the tab was hidden', () => {
    // rAF is suspended while a tab is backgrounded, so the next timestamp can
    // be minutes later. An absolute clock would snap the gradient; the
    // accumulated clock clamps the gap to one frame's worth.
    const c = render(<Harness g={gradient()} enabled />)
    const el = surfaceOf(c)
    paint(0)
    paint(16)
    const beforeHide = el.style.backgroundImage
    paint(600_000) // ten minutes later
    const afterHide = el.style.backgroundImage

    // Compare against what a normal 100ms step would have produced.
    const c2 = render(<Harness g={gradient()} enabled />)
    const el2 = surfaceOf(c2)
    paint(0)
    paint(16)
    paint(116)
    expect(afterHide).toBe(el2.style.backgroundImage)
    expect(afterHide).not.toBe(beforeHide)
  })
})
