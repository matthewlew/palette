import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeartButton, LikeCountBadge, formatLikeCount } from './HeartButton'

describe('formatLikeCount', () => {
  it('shows exact counts below a thousand', () => {
    expect(formatLikeCount(0)).toBe('0')
    expect(formatLikeCount(7)).toBe('7')
    expect(formatLikeCount(999)).toBe('999')
  })

  it('abbreviates thousands, dropping a trailing .0', () => {
    expect(formatLikeCount(1000)).toBe('1k')
    expect(formatLikeCount(1240)).toBe('1.2k')
  })

  it('drops the decimal past ten thousand, where a tenth means nothing', () => {
    expect(formatLikeCount(12400)).toBe('12k')
  })
})

describe('HeartButton', () => {
  it('names the palette and the count, so a grid of hearts is not a row of “Like”', () => {
    render(<HeartButton liked={false} count={3} label="Alpha" onToggle={vi.fn()} />)
    const button = screen.getByTestId('heart-button')
    expect(button).toHaveAttribute('aria-label', 'Like Alpha, 3 likes')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers to undo the like once it is pressed', () => {
    render(<HeartButton liked count={1} label="Alpha" onToggle={vi.fn()} />)
    const button = screen.getByTestId('heart-button')
    expect(button).toHaveAttribute('aria-label', 'Unlike Alpha, 1 like')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides a zero count rather than printing it on every tile', () => {
    render(<HeartButton liked={false} count={0} onToggle={vi.fn()} />)
    expect(screen.getByTestId('heart-button').textContent).toBe('')
  })

  it('toggles on click', () => {
    const onToggle = vi.fn()
    render(<HeartButton liked={false} count={0} onToggle={onToggle} />)
    fireEvent.click(screen.getByTestId('heart-button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not reach the surface underneath, which would open or close it', () => {
    // The gallery tile opens the viewer on click; the viewer backdrop closes on
    // click; GradientPage-style surfaces act on pointerup. A like must do none
    // of those, so all three are stopped.
    const onSurface = vi.fn()
    render(
      <div onClick={onSurface} onPointerUp={onSurface} onPointerDown={onSurface}>
        <HeartButton liked={false} count={0} onToggle={vi.fn()} />
      </div>
    )
    const button = screen.getByTestId('heart-button')
    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(onSurface).not.toHaveBeenCalled()
  })
})

describe('LikeCountBadge', () => {
  it('renders nothing at zero — a wall of “0” reads as rejected, not new', () => {
    const { container } = render(<LikeCountBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count once there is one', () => {
    render(<LikeCountBadge count={42} />)
    expect(screen.getByTestId('like-count-badge')).toHaveTextContent('42')
  })
})
