import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScrollTicker } from './ScrollTicker'

afterEach(() => {
  vi.useRealTimers()
})

describe('ScrollTicker', () => {
  it('is hidden (opacity 0) on first render, before any scrolling', () => {
    render(<ScrollTicker index={0} />)
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('0')
  })

  it('becomes visible when the index changes, then fades out after 1s idle', () => {
    vi.useFakeTimers()
    const { rerender } = render(<ScrollTicker index={0} />)
    rerender(<ScrollTicker index={1} />)
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('1')

    vi.advanceTimersByTime(1000)
    expect(screen.getByTestId('scroll-ticker').style.opacity).toBe('0')
  })

  it('renders no tick for negative indices (start of history)', () => {
    render(<ScrollTicker index={0} />)
    const ticks = screen.getAllByTestId('ticker-tick')
    // Window is -10..10 around index 0, filtered to >=0: indices 0..10 (11 items).
    // Index 0 is the active tick (testid `ticker-tick-active`), leaving 10
    // plain `ticker-tick` elements for indices 1..10.
    expect(ticks).toHaveLength(10)
  })

  it('marks the tick for the current index as active', () => {
    render(<ScrollTicker index={7} />)
    const active = screen.getByTestId('ticker-tick-active')
    expect(active).toBeInTheDocument()
  })

  it('gives the active tick full opacity and fades ticks toward the ends of the window', () => {
    render(<ScrollTicker index={10} />)
    const active = screen.getByTestId('ticker-tick-active')
    expect(active.style.opacity).toBe('1')

    const ticks = screen.getAllByTestId('ticker-tick')
    // Window is index-10..index+10 (WINDOW=10). Tick right next to active
    // (distance 1) should fade less than one at the edge (distance 10).
    const opacities = ticks.map((t) => parseFloat(t.style.opacity))
    expect(Math.min(...opacities)).toBeCloseTo(0, 5) // edge tick, distance 10 -> fade 0
    expect(Math.max(...opacities)).toBeCloseTo(0.9, 5) // nearest tick, distance 1 -> fade 0.9
  })

  it('is aria-hidden (purely decorative)', () => {
    render(<ScrollTicker index={3} />)
    expect(screen.getByTestId('scroll-ticker').getAttribute('aria-hidden')).toBe('true')
  })

  it('does not render any numeric tick labels', () => {
    render(<ScrollTicker index={12} />)
    expect(screen.queryByText('13')).not.toBeInTheDocument()
    expect(screen.queryByText('11')).not.toBeInTheDocument()
  })
})
