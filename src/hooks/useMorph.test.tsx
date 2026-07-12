import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMorph } from './useMorph'
import type { Gradient } from '../store/types'

const g = (id: string, hexes: string[]): Gradient => ({
  id,
  type: 'linear',
  stops: hexes.map((hex, i) => ({ hex, position: i * 100 })),
  reversed: false,
})

const A = g('a', ['#2e7d32', '#1565c0'])
const B = g('b', ['#66bb6a', '#42a5f5'])

describe('useMorph', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    let now = 0
    vi.stubGlobal('performance', { now: () => now })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => { now += 16; cb(now) }, 16) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns the target immediately when skip is true', () => {
    const { result, rerender } = renderHook(({ target, skip }) => useMorph(target, skip), {
      initialProps: { target: A, skip: true },
    })
    rerender({ target: B, skip: true })
    expect(result.current.stops.map((s) => s.hex)).toEqual(B.stops.map((s) => s.hex))
  })

  it('animates from A to B over the duration when not skipping', () => {
    const { result, rerender } = renderHook(({ target, skip }) => useMorph(target, skip), {
      initialProps: { target: A, skip: false },
    })
    rerender({ target: B, skip: false })
    act(() => { vi.advanceTimersByTime(48) })
    expect(result.current.stops.map((s) => s.hex)).not.toEqual(B.stops.map((s) => s.hex))
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current.stops.map((s) => s.hex)).toEqual(B.stops.map((s) => s.hex))
  })

  it('falls back to instant swap on stop-count mismatch', () => {
    const C = g('c', ['#ff0000', '#00ff00', '#0000ff'])
    const { result, rerender } = renderHook(({ target, skip }) => useMorph(target, skip), {
      initialProps: { target: A, skip: false },
    })
    rerender({ target: C, skip: false })
    expect(result.current.stops.map((s) => s.hex)).toEqual(C.stops.map((s) => s.hex))
  })
})
