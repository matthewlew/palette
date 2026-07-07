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

  it('is aria-hidden (purely decorative)', () => {
    render(<ScrollTicker index={3} />)
    expect(screen.getByTestId('scroll-ticker').getAttribute('aria-hidden')).toBe('true')
  })
})
