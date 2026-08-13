import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSheetFollow } from './useSheetFollow'

/**
 * The bug under test: a swipe TRANSLATES the sheet, so nothing resizes and the
 * gradient above it kept its old size until the gesture ended, then jumped.
 */

let frames: FrameRequestCallback[] = []

function flushFrame() {
  const due = frames
  frames = []
  act(() => {
    due.forEach((cb) => cb(performance.now()))
  })
}

/** Puts the sheet's top edge at `top`, as a drag down would. */
function positionSheet(el: HTMLElement, top: number, height = 300) {
  el.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
}

let el: HTMLDivElement

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  window.innerHeight = 800
  el = document.createElement('div')
  document.body.appendChild(el)
  positionSheet(el, 500)
})

afterEach(() => {
  vi.unstubAllGlobals()
  el.remove()
})

function pointerDown() {
  act(() => {
    el.dispatchEvent(new Event('pointerdown'))
  })
}

function pointerUp() {
  act(() => {
    window.dispatchEvent(new Event('pointerup'))
  })
}

describe('useSheetFollow', () => {
  it('reports nothing until the sheet is touched', () => {
    const { result } = renderHook(() => useSheetFollow(el, true))
    expect(result.current.visible).toBeNull()
    expect(result.current.following).toBe(false)
  })

  it('follows the sheet down mid-drag, before anything is released', () => {
    const { result } = renderHook(() => useSheetFollow(el, true))
    pointerDown()
    flushFrame()
    // 800 tall viewport, sheet top at 500 → 300px of it is on screen.
    expect(result.current.visible).toBe(300)
    expect(result.current.following).toBe(true)

    positionSheet(el, 650)
    flushFrame()
    expect(result.current.visible).toBe(150)
  })

  it('never reports more coverage than the sheet has height', () => {
    positionSheet(el, 100, 300)
    const { result } = renderHook(() => useSheetFollow(el, true))
    pointerDown()
    flushFrame()
    expect(result.current.visible).toBe(300)
  })

  it('reports zero once the sheet is dragged clear of the viewport', () => {
    const { result } = renderHook(() => useSheetFollow(el, true))
    pointerDown()
    flushFrame()
    positionSheet(el, 900)
    flushFrame()
    expect(result.current.visible).toBe(0)
  })

  it('keeps following through the release, then hands sizing back', () => {
    const { result } = renderHook(() => useSheetFollow(el, true))
    pointerDown()
    flushFrame()
    pointerUp()

    // The drawer animates home under its own steam; we mirror it.
    positionSheet(el, 560)
    flushFrame()
    expect(result.current.visible).toBe(240)
    expect(result.current.following).toBe(true)

    // Two frames at rest means it has settled — stop reading layout every
    // frame and let the measured height take over again.
    flushFrame()
    flushFrame()
    expect(result.current.visible).toBeNull()
    expect(result.current.following).toBe(false)
  })

  it('does not mistake a held, motionless finger for a settled sheet', () => {
    const { result } = renderHook(() => useSheetFollow(el, true))
    pointerDown()
    flushFrame()
    flushFrame()
    flushFrame()
    expect(result.current.following).toBe(true)
    expect(result.current.visible).toBe(300)
  })

  it('does nothing on the desktop layout, where the panel is an in-flow sibling', () => {
    const { result } = renderHook(() => useSheetFollow(el, false))
    pointerDown()
    expect(frames).toHaveLength(0)
    expect(result.current.visible).toBeNull()
  })
})
