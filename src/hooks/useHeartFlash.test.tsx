import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHeartFlash } from './useHeartFlash'

describe('useHeartFlash', () => {
  it('starts not visible', () => {
    const { result } = renderHook(() => useHeartFlash())
    expect(result.current.visible).toBe(false)
  })

  it('becomes visible after flash() and hides again after 500ms', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useHeartFlash())
    act(() => result.current.flash())
    expect(result.current.visible).toBe(true)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.visible).toBe(false)
    vi.useRealTimers()
  })
})
