import { describe, it, expect, vi, afterEach } from 'vitest'
import { withViewTransition } from './viewTransition'

afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error cleanup test-only property
  delete (document as any).startViewTransition
})

describe('withViewTransition', () => {
  it('calls document.startViewTransition when supported and motion is not reduced', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb())
    ;(document as any).startViewTransition = startViewTransition
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))

    const update = vi.fn()
    withViewTransition(update)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('calls update directly (no transition) when prefers-reduced-motion is set', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb())
    ;(document as any).startViewTransition = startViewTransition
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))

    const update = vi.fn()
    withViewTransition(update)

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('calls update directly when startViewTransition is not supported', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const update = vi.fn()

    withViewTransition(update)

    expect(update).toHaveBeenCalledTimes(1)
  })
})
