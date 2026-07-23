import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAnimatedStops } from './useAnimatedStops'
import type { GradientStop } from '../lib/gradient'

const A: GradientStop[] = [
  { hex: '#ff0000', position: 0 },
  { hex: '#0000ff', position: 100 },
]
// Same layout, swapped colors — the shape a canvas-handle swap produces.
const B: GradientStop[] = [
  { hex: '#0000ff', position: 0 },
  { hex: '#ff0000', position: 100 },
]
// Different layout (extra stop): must apply instantly, no animation.
const C: GradientStop[] = [
  { hex: '#00ff00', position: 0 },
  { hex: '#ffffff', position: 50 },
  { hex: '#000000', position: 100 },
]

describe('useAnimatedStops', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    let now = 0
    vi.stubGlobal('performance', { now: () => now })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => {
        now += 16
        cb(now)
      }, 16) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('crossfades colors over the duration when only the color order changes', () => {
    const { result, rerender } = renderHook(({ stops }) => useAnimatedStops(stops), {
      initialProps: { stops: A },
    })
    rerender({ stops: B })
    // Mid-flight: colors are blending, not yet equal to the target.
    act(() => {
      vi.advanceTimersByTime(48)
    })
    expect(result.current.map((s) => s.hex)).not.toEqual(B.map((s) => s.hex))
    expect(result.current.map((s) => s.hex)).not.toEqual(A.map((s) => s.hex))
    // Positions never animate — they are the target's from the first frame.
    expect(result.current.map((s) => s.position)).toEqual([0, 100])
    // Settled: exactly the target colors.
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.map((s) => s.hex)).toEqual(B.map((s) => s.hex))
  })

  it('applies layout changes (different stop count) instantly', () => {
    const { result, rerender } = renderHook(({ stops }) => useAnimatedStops(stops), {
      initialProps: { stops: A },
    })
    rerender({ stops: C })
    expect(result.current).toEqual(C)
  })

  it('returns the input unchanged when nothing changed', () => {
    const { result, rerender } = renderHook(({ stops }) => useAnimatedStops(stops), {
      initialProps: { stops: A },
    })
    rerender({ stops: A })
    expect(result.current.map((s) => s.hex)).toEqual(A.map((s) => s.hex))
  })
})
