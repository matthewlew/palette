import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LikeButton } from './LikeButton'

describe('LikeButton', () => {
  it('shows a hollow heart and "Like" label when not liked', () => {
    render(<LikeButton liked={false} onToggle={vi.fn()} />)
    const button = screen.getByTestId('like-button')
    expect(button.getAttribute('aria-label')).toBe('Like this gradient')
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows a filled heart and "Unlike" label when liked', () => {
    render(<LikeButton liked={true} onToggle={vi.fn()} />)
    const button = screen.getByTestId('like-button')
    expect(button.getAttribute('aria-label')).toBe('Unlike this gradient')
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onToggle and stops the click from bubbling to a parent tap handler', () => {
    const onToggle = vi.fn()
    const onParentTap = vi.fn()
    render(
      <div onPointerUp={onParentTap}>
        <LikeButton liked={false} onToggle={onToggle} />
      </div>
    )
    fireEvent.click(screen.getByTestId('like-button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onParentTap).not.toHaveBeenCalled()
  })
})
