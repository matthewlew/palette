import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Feed } from './Feed'
import { useAppStore } from '../store/useAppStore'
import * as paletteLib from '../lib/palette'

const STEP_PX = 80

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
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
})
