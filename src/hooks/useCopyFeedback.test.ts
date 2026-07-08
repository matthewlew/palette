import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCopyFeedback } from './useCopyFeedback'

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCopyFeedback', () => {
  it('starts with copied=false', () => {
    const { result } = renderHook(() => useCopyFeedback())
    expect(result.current.copied).toBe(false)
  })

  it('sets copied=true after a successful copy, then clears after the timeout', async () => {
    const { result } = renderHook(() => useCopyFeedback())
    await act(async () => {
      await result.current.copy('hello')
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(result.current.copied).toBe(false)
  })
})
