import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Feed, resetFeedSession } from './Feed'
import { useAppStore } from '../store/useAppStore'
import * as paletteLib from '../lib/palette'
import * as haptics from '../lib/haptics'

const STEP_PX = 60

beforeEach(() => {
  resetFeedSession()
  useAppStore.setState(useAppStore.getInitialState())
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Feed', () => {
  it('generates an initial gradient on mount if none exists', () => {
    render(<Feed />)
    expect(useAppStore.getState().current).not.toBeNull()
  })

  it('renders exactly one GradientPage (no double-buffer)', () => {
    render(<Feed />)
    expect(screen.getAllByTestId('gradient-page')).toHaveLength(1)
  })

  it('crosses the step threshold via accumulated wheel deltaY and shows a new gradient', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')

    fireEvent.wheel(container, { deltaY: STEP_PX })

    expect(generateSpy).toHaveBeenCalled()
    expect(useAppStore.getState().current).not.toEqual(first)
  })

  it('scrolling backward after moving forward returns to the exact same previous gradient', () => {
    render(<Feed />)
    const first = useAppStore.getState().current

    const container = screen.getByTestId('feed-container')

    // Advance forward one step.
    fireEvent.wheel(container, { deltaY: STEP_PX })
    const second = useAppStore.getState().current
    expect(second).not.toEqual(first)

    // Advance forward another step.
    fireEvent.wheel(container, { deltaY: STEP_PX })
    const third = useAppStore.getState().current
    expect(third).not.toEqual(second)

    // Now scroll back one step: should return to `second`, not a fresh gradient.
    fireEvent.wheel(container, { deltaY: -STEP_PX })
    expect(useAppStore.getState().current).toEqual(second)

    // Scroll back again: should return to `first`.
    fireEvent.wheel(container, { deltaY: -STEP_PX })
    expect(useAppStore.getState().current).toEqual(first)
  })

  it('does not go below index 0 when scrolling backward past the first gradient', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')

    fireEvent.wheel(container, { deltaY: -STEP_PX })
    fireEvent.wheel(container, { deltaY: -STEP_PX })

    expect(useAppStore.getState().current).toEqual(first)
    expect(generateSpy).not.toHaveBeenCalled()
  })

  it('accumulates sub-threshold wheel deltas without changing the gradient until the threshold is crossed', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    fireEvent.wheel(container, { deltaY: STEP_PX / 2 })
    expect(useAppStore.getState().current).toEqual(first)

    fireEvent.wheel(container, { deltaY: STEP_PX / 2 })
    expect(useAppStore.getState().current).not.toEqual(first)
  })

  it('syncs an externally-set store.current (e.g. Drawer selection) by overwriting the current slot without generating a new gradient', () => {
    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    // Advance forward once so we're at index 1.
    fireEvent.wheel(container, { deltaY: STEP_PX })
    const atIndexOne = useAppStore.getState().current

    const externalGradient = {
      id: 'external-id',
      type: 'linear' as const,
      stops: [
        { hex: '#000000', position: 0 },
        { hex: '#ffffff', position: 100 },
      ],
    }

    useAppStore.getState().setCurrentGradient(externalGradient)

    expect(useAppStore.getState().current).toEqual(externalGradient)
    expect(useAppStore.getState().current).not.toEqual(atIndexOne)

    // Scrolling backward one step should now return to the ORIGINAL first
    // gradient (index 0), not `atIndexOne`, confirming the external gradient
    // overwrote the slot at the current index rather than shifting it.
    fireEvent.wheel(container, { deltaY: -STEP_PX })
    expect(screen.getAllByTestId('gradient-page')).toHaveLength(1)
  })

  it('keeps the same gradient shape/type across multiple forward-generated gradients in one mount', () => {
    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    const first = useAppStore.getState().current
    expect(first).not.toBeNull()
    const lockedType = first!.type

    for (let i = 0; i < 4; i++) {
      fireEvent.wheel(container, { deltaY: STEP_PX })
      expect(useAppStore.getState().current!.type).toBe(lockedType)
    }
  })

  it('locks the geometry type from the pre-existing store gradient at mount, not a random pick', () => {
    const preExisting = {
      id: 'pre-existing-id',
      type: 'square' as const,
      stops: [
        { hex: '#123456', position: 0 },
        { hex: '#abcdef', position: 100 },
      ],
    }
    useAppStore.getState().setCurrentGradient(preExisting)

    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.wheel(container, { deltaY: STEP_PX })

    expect(useAppStore.getState().current).not.toEqual(preExisting)
    expect(useAppStore.getState().current!.type).toBe('square')
  })

  it('vibrates once per real step crossed via wheel scrubbing', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
    })

    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.wheel(container, { deltaY: STEP_PX })
    expect(vibrateMock).toHaveBeenCalledTimes(1)
    expect(vibrateMock).toHaveBeenCalledWith(10)

    fireEvent.wheel(container, { deltaY: STEP_PX })
    expect(vibrateMock).toHaveBeenCalledTimes(2)
  })

  it('does not vibrate when scrolling backward is a no-op at the floor (index 0)', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
    })

    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.wheel(container, { deltaY: -STEP_PX })
    fireEvent.wheel(container, { deltaY: -STEP_PX })

    expect(vibrateMock).not.toHaveBeenCalled()
  })

  it('does not vibrate when store.current changes externally (Drawer selection), only on actual scrub steps', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
    })

    render(<Feed />)

    const externalGradient = {
      id: 'external-id-2',
      type: 'linear' as const,
      stops: [
        { hex: '#111111', position: 0 },
        { hex: '#eeeeee', position: 100 },
      ],
    }

    useAppStore.getState().setCurrentGradient(externalGradient)

    expect(vibrateMock).not.toHaveBeenCalled()
  })

  it('primes the iOS haptic actuator on touchstart, before the first tick', () => {
    const primeSpy = vi.spyOn(haptics, 'primeHaptics')
    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.touchStart(container, { touches: [{ clientY: 400 }] })

    expect(primeSpy).toHaveBeenCalledTimes(1)
  })

  it('crosses the step threshold via accumulated touchmove drag (dragging up = forward)', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')

    fireEvent.touchStart(container, { touches: [{ clientY: 400 }] })
    // Drag up in two increments totaling STEP_PX of upward movement.
    fireEvent.touchMove(container, { touches: [{ clientY: 400 - STEP_PX / 2 }] })
    fireEvent.touchMove(container, { touches: [{ clientY: 400 - STEP_PX }] })

    expect(generateSpy).toHaveBeenCalled()
    expect(useAppStore.getState().current).not.toEqual(first)
  })

  it('drags down via touchmove to move backward through history', () => {
    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    // Move forward one step via wheel first, to have history to go back through.
    fireEvent.wheel(container, { deltaY: STEP_PX })
    const second = useAppStore.getState().current

    fireEvent.wheel(container, { deltaY: STEP_PX })
    expect(useAppStore.getState().current).not.toEqual(second)

    // Now drag DOWN (increasing clientY) via touch to move backward.
    fireEvent.touchStart(container, { touches: [{ clientY: 200 }] })
    fireEvent.touchMove(container, { touches: [{ clientY: 200 + STEP_PX }] })

    expect(useAppStore.getState().current).toEqual(second)
  })

  it('resets tracked touch position on touchend, so a later gesture is not affected by a prior aborted one', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    // First gesture: move partway (not enough to cross threshold), then abort via touchend
    // WITHOUT a subsequent touchstart resetting the tracked position naturally.
    fireEvent.touchStart(container, { touches: [{ clientY: 500 }] })
    fireEvent.touchMove(container, { touches: [{ clientY: 500 - STEP_PX / 4 }] })
    fireEvent.touchEnd(container)
    expect(useAppStore.getState().current).toEqual(first)

    // Simulate the next gesture as a "naked" touchmove without a preceding
    // touchstart in between (e.g. a stray/duplicate move event, or a browser
    // that doesn't always fire touchstart cleanly). If touchend had reset
    // lastTouchYRef to null, this move is ignored (per the touchY == null ||
    // lastTouchYRef.current == null guard) rather than computing a delta
    // from the stale prior gesture's last position (500 - STEP_PX/4).
    fireEvent.touchMove(container, { touches: [{ clientY: 500 - STEP_PX / 4 - STEP_PX }] })

    // With correct reset behavior, this move is dropped (treated as a new
    // gesture start), so the gradient should NOT have changed.
    expect(useAppStore.getState().current).toEqual(first)
  })

  it('a slow drag (60px over 500ms) advances exactly 1 step and does not trigger extra momentum steps', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)

    fireEvent.touchStart(container, { touches: [{ clientY: 500 }] })
    now = 250
    fireEvent.touchMove(container, { touches: [{ clientY: 470 }] })
    now = 500
    fireEvent.touchMove(container, { touches: [{ clientY: 440 }] })
    fireEvent.touchEnd(container)

    expect(useAppStore.getState().current).not.toEqual(first)

    nowSpy.mockRestore()
  })

  it('a fast swipe (300px in 100ms) advances the index by at least 8 total once momentum settles', () => {
    let now = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const rafCallbacks: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')

    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.touchStart(container, { touches: [{ clientY: 500 }] })
    now = 50
    fireEvent.touchMove(container, { touches: [{ clientY: 350 }] })
    now = 100
    fireEvent.touchMove(container, { touches: [{ clientY: 200 }] })
    fireEvent.touchEnd(container)

    let frameTime = 100
    let iterations = 0
    while (rafCallbacks.length > 0 && iterations < 500) {
      const cb = rafCallbacks.shift()!
      frameTime += 16.67
      now = frameTime
      cb(frameTime)
      iterations++
    }

    expect(generateSpy.mock.calls.length).toBeGreaterThanOrEqual(7) // 8 total steps - 1 initial mount

    nowSpy.mockRestore()
    rafSpy.mockRestore()
  })

  it('calls withViewTransition when entering edit mode via single tap', async () => {
    const viewTransitionModule = await import('../lib/viewTransition')
    const spy = vi.spyOn(viewTransitionModule, 'withViewTransition').mockImplementation((update) => update())

    render(<Feed />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().mode).toBe('edit')

    spy.mockRestore()
  })

  it('toggles the saved state of the current gradient via a click on the LikeButton', () => {
    render(<Feed />)
    const current = useAppStore.getState().current!

    expect(useAppStore.getState().isGradientSaved(current)).toBe(false)

    fireEvent.click(screen.getByTestId('like-button'))
    expect(useAppStore.getState().isGradientSaved(current)).toBe(true)

    fireEvent.click(screen.getByTestId('like-button'))
    expect(useAppStore.getState().isGradientSaved(current)).toBe(false)
  })

  it('shows the scroll hint on mount and dismisses it on the first wheel gesture', () => {
    render(<Feed />)
    expect(screen.getByRole('status').textContent).toBe('Scroll to explore palettes ↓')

    const container = screen.getByTestId('feed-container')
    fireEvent.wheel(container, { deltaY: STEP_PX })

    expect(localStorage.getItem('palette-hint-scroll')).toBe('1')
  })

  it('does not show the scroll hint again once already dismissed', () => {
    localStorage.setItem('palette-hint-scroll', '1')
    render(<Feed />)
    expect(screen.queryByText('Scroll to explore palettes ↓')).not.toBeInTheDocument()
  })

  it('shows the like hint only after the scroll hint has been dismissed', () => {
    localStorage.setItem('palette-hint-scroll', '1')
    render(<Feed />)
    expect(screen.getByText('Tap ♥ to save')).toBeInTheDocument()
  })

  it('preserves scroll position across an unmount/remount (e.g. entering and exiting edit mode)', () => {
    const { unmount } = render(<Feed />)
    const container = screen.getByTestId('feed-container')

    fireEvent.wheel(container, { deltaY: STEP_PX * 3 })
    const gradientAfterScrolling = useAppStore.getState().current

    unmount()
    // Note: intentionally NOT calling resetFeedSession() here — this
    // simulates App.tsx swapping Feed out for EditMode and back, which
    // does not reset the module-level session.
    render(<Feed />)

    expect(useAppStore.getState().current).toEqual(gradientAfterScrolling)
  })

  it('shows the scroll ticker while scrubbing and it tracks the feed index', () => {
    render(<Feed />)
    const container = screen.getByTestId('feed-container')

    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('0')

    fireEvent.wheel(container, { deltaY: STEP_PX })
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('1')
    expect(screen.getByTestId('ticker-tick-active')).toBeInTheDocument()
  })

  it('adopts an edit-mode-modified gradient (same id, new shape) on remount', () => {
    const { unmount } = render(<Feed />)
    const original = useAppStore.getState().current!
    unmount()

    // Simulate an edit-mode commit: same id, different type/stops object.
    const editedType = original.type === 'square' ? ('linear' as const) : ('square' as const)
    const edited = { ...original, type: editedType, stops: [...original.stops] }
    useAppStore.getState().setCurrentGradient(edited)

    render(<Feed />)
    if (editedType === 'square') {
      expect(screen.getByTestId('turrell-square')).toBeInTheDocument()
    } else {
      expect(screen.queryByTestId('turrell-square')).not.toBeInTheDocument()
    }
    expect(useAppStore.getState().current).toBe(edited)
  })
})
