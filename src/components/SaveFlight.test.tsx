import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { SaveFlightLayer } from './SaveFlight'
import { LikeButton } from './LikeButton'
import { TabBar } from './TabBar'
import { onSaveFlightArrival } from '../lib/saveFlight'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  reversed: false,
}

/** jsdom lays nothing out and has no Web Animations, so both have to be stood
 * up by hand — the flight is entirely geometry plus `element.animate`. */
type FakeAnimation = {
  finish: () => void
  addEventListener: (type: string, fn: () => void) => void
  cancel: () => void
}
let animations: FakeAnimation[] = []

function stubLayout() {
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 44, width: 80, height: 44, toJSON: () => ({}) } as DOMRect
  }
}

beforeEach(() => {
  cleanup()
  animations = []
  stubLayout()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Element.prototype as any).animate = function () {
    const handlers: (() => void)[] = []
    const animation: FakeAnimation = {
      addEventListener: (type, fn) => {
        if (type === 'finish') handlers.push(fn)
      },
      finish: () => handlers.forEach((fn) => fn()),
      cancel: () => {},
    }
    animations.push(animation)
    return animation
  }
  vi.stubGlobal(
    'requestAnimationFrame',
    ((fn: FrameRequestCallback) => {
      fn(0)
      return 0
    }) as typeof requestAnimationFrame
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('save flight', () => {
  it('launches a travelling tile when a gradient is saved', () => {
    render(
      <>
        <LikeButton liked={false} onToggle={vi.fn()} gradient={gradient} />
        <TabBar mode="create" onChange={vi.fn()} recentGradients={[gradient]} savedCount={1} />
        <SaveFlightLayer />
      </>
    )
    expect(screen.queryByTestId('save-flight-tile')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('like-button'))
    expect(screen.getByTestId('save-flight-tile')).toBeInTheDocument()
  })

  it('does not fly when un-saving', () => {
    render(
      <>
        <LikeButton liked={true} onToggle={vi.fn()} gradient={gradient} />
        <TabBar mode="create" onChange={vi.fn()} recentGradients={[gradient]} savedCount={1} />
        <SaveFlightLayer />
      </>
    )
    fireEvent.click(screen.getByTestId('like-button'))
    expect(screen.queryByTestId('save-flight-tile')).not.toBeInTheDocument()
  })

  it('removes the tile and announces arrival when the flight finishes', () => {
    const arrived = vi.fn()
    const stop = onSaveFlightArrival(arrived)
    render(
      <>
        <LikeButton liked={false} onToggle={vi.fn()} gradient={gradient} />
        <TabBar mode="create" onChange={vi.fn()} recentGradients={[gradient]} savedCount={1} />
        <SaveFlightLayer />
      </>
    )
    fireEvent.click(screen.getByTestId('like-button'))
    act(() => {
      animations.forEach((a) => a.finish())
    })
    expect(arrived).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('save-flight-tile')).not.toBeInTheDocument()
    stop()
  })

  it('reveals the tab bar on launch even when it is hidden', () => {
    render(
      <>
        <LikeButton liked={false} onToggle={vi.fn()} gradient={gradient} />
        {/* panelOpen === the mobile edit sheet, where the bar is deliberately
            faded out — the destination still has to be visible to land in. */}
        <TabBar mode="create" onChange={vi.fn()} panelOpen recentGradients={[gradient]} savedCount={1} />
        <SaveFlightLayer />
      </>
    )
    const bar = screen.getByTestId('tab-bar')
    expect(bar.className).not.toMatch(/revealed/)
    fireEvent.click(screen.getByTestId('like-button'))
    expect(bar.className).toMatch(/revealed/)
  })

  it('bumps the thumbnail stack when a flight arrives', () => {
    render(
      <>
        <LikeButton liked={false} onToggle={vi.fn()} gradient={gradient} />
        <TabBar mode="create" onChange={vi.fn()} recentGradients={[gradient]} savedCount={1} />
        <SaveFlightLayer />
      </>
    )
    fireEvent.click(screen.getByTestId('like-button'))
    expect(screen.getByTestId('tab-gallery-thumb').className).not.toMatch(/landed/)
    act(() => {
      animations.forEach((a) => a.finish())
    })
    expect(screen.getByTestId('tab-gallery-thumb').className).toMatch(/landed/)
  })

  it('skips the flight entirely under prefers-reduced-motion, but still bumps', () => {
    vi.stubGlobal(
      'matchMedia',
      ((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
    )
    render(
      <>
        <LikeButton liked={false} onToggle={vi.fn()} gradient={gradient} />
        <TabBar mode="create" onChange={vi.fn()} recentGradients={[gradient]} savedCount={1} />
        <SaveFlightLayer />
      </>
    )
    fireEvent.click(screen.getByTestId('like-button'))
    expect(screen.queryByTestId('save-flight-tile')).not.toBeInTheDocument()
    expect(screen.getByTestId('tab-gallery-thumb').className).toMatch(/landed/)
  })
})
