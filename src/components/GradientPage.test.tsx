import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { GradientPage } from './GradientPage'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}

describe('GradientPage', () => {
  it('renders the gradient as a background style', () => {
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.backgroundImage).toContain('linear-gradient')
    expect(page.style.backgroundImage).toContain('rgb(255, 0, 0)')
  })

  it('calls onEdit immediately on a single tap, with no debounce wait', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    fireEvent.pointerUp(screen.getByTestId('gradient-page'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('sets touch-action manipulation to suppress native zoom', () => {
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.touchAction).toBe('manipulation')
  })

  it('does not call onEdit when pointerup lands more than 10px from pointerdown (scroll, not tap)', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')
    fireEvent.pointerDown(page, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(page, { clientX: 100, clientY: 300 })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('still calls onEdit for a single tap with movement under 10px', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')
    fireEvent.pointerDown(page, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(page, { clientX: 103, clientY: 102 })
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('renders a LikeButton reflecting the liked prop and wires onToggleLike', () => {
    const onToggleLike = vi.fn()
    render(<GradientPage gradient={gradient} liked={true} onToggleLike={onToggleLike} onEdit={vi.fn()} />)
    const likeButton = screen.getByTestId('like-button')
    expect(likeButton.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(likeButton)
    expect(onToggleLike).toHaveBeenCalledTimes(1)
  })

  it('does not call onEdit when the tap lands on the like button', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    const likeButton = screen.getByTestId('like-button')
    fireEvent.pointerDown(likeButton, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(likeButton, { clientX: 10, clientY: 10 })
    expect(onEdit).not.toHaveBeenCalled()
  })
})
