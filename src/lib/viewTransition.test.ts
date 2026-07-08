import { describe, it, expect, vi, afterEach } from 'vitest'
import { withViewTransition } from './viewTransition'

const flushSyncMock = vi.fn((cb: () => void) => cb())
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return { ...actual, flushSync: (cb: () => void) => flushSyncMock(cb) }
})

afterEach(() => {
  vi.unstubAllGlobals()
  flushSyncMock.mockClear()
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

  it('runs the update inside flushSync, from within the startViewTransition callback', () => {
    const callOrder: string[] = []
    const startViewTransition = vi.fn((cb: () => void) => {
      callOrder.push('startViewTransition:callback-invoked')
      cb()
    })
    ;(document as any).startViewTransition = startViewTransition
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    flushSyncMock.mockImplementation((cb: () => void) => {
      callOrder.push('flushSync:called')
      cb()
    })

    const update = vi.fn(() => callOrder.push('update:applied'))
    withViewTransition(update)

    expect(flushSyncMock).toHaveBeenCalledTimes(1)
    expect(flushSyncMock).toHaveBeenCalledWith(update)
    // Order matters: the DOM must be fully committed (flushSync) before the
    // transition snapshot, not asynchronously after.
    expect(callOrder).toEqual([
      'startViewTransition:callback-invoked',
      'flushSync:called',
      'update:applied',
    ])
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
