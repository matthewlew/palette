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

  it('emphasizes the selected tick well beyond its neighbors', () => {
    render(<ScrollTicker index={10} />)
    const active = screen.getByTestId('ticker-tick-active')
    expect(active.style.opacity).toBe('1')
    expect(active.style.transform).toContain('scaleX(1.7)')
    // Thickness is uniform across all ticks — only width and opacity vary.
    expect(active.style.transform).not.toContain('scaleY')

    const ticks = screen.getAllByTestId('ticker-tick')
    // Window is index-10..index+10 (WINDOW=10). Ticks shrink and fade with
    // distance but never vanish entirely (min opacity 0.2, min scaleX 0.35).
    const opacities = ticks.map((t) => parseFloat(t.style.opacity))
    expect(Math.min(...opacities)).toBeCloseTo(0.2, 5) // edge tick, distance 10
    // Even the nearest neighbor stays visibly dimmer than the active tick.
    expect(Math.max(...opacities)).toBeLessThan(0.85)
    const edgeTick = ticks.find((t) => parseFloat(t.style.opacity) === Math.min(...opacities))!
    expect(edgeTick.style.transform).toContain('scaleX(0.35)')
  })

  it('is aria-hidden (purely decorative)', () => {
    render(<ScrollTicker index={3} />)
    expect(screen.getByTestId('scroll-ticker').getAttribute('aria-hidden')).toBe('true')
  })

  it('renders a counter next to the selected tick showing the 1-based position', () => {
    render(<ScrollTicker index={12} />)
    const count = screen.getByTestId('ticker-count')
    expect(count.textContent).toBe('13')
    expect(screen.queryByText('11')).not.toBeInTheDocument()
  })
})
