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
    const surface = screen.getByTestId('gradient-surface')
    expect(surface.style.backgroundImage).toContain('linear-gradient')
    expect(surface.style.backgroundImage).toContain('rgb(255, 0, 0)')
  })

  it('lays a circle crop out in a square box that fits the viewport', () => {
    render(
      <GradientPage gradient={{ ...gradient, crop: 'circle' }} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />
    )
    const surface = screen.getByTestId('gradient-surface')
    expect(surface.style.clipPath).toBe('circle(50%)')
    expect(surface.style.aspectRatio).toBe('1 / 1')
    expect(surface.style.height).toBe('auto')
  })

  it('renders the layered oval renderer for a radial under an oval crop', () => {
    render(
      <GradientPage
        gradient={{ ...gradient, type: 'radial', crop: 'oval' }}
        liked={false}
        onToggleLike={vi.fn()}
        onEdit={vi.fn()}
      />
    )
    expect(screen.getByTestId('oval-radial-layers')).toBeTruthy()
    expect(screen.getByTestId('gradient-surface').style.backgroundImage).toBe('')
  })

  it('hands the crop down to the Turrell renderer so its layers follow the boundary', () => {
    render(
      <GradientPage
        gradient={{ ...gradient, type: 'square', crop: 'circle' }}
        liked={false}
        onToggleLike={vi.fn()}
        onEdit={vi.fn()}
      />
    )
    const layers = screen.getAllByTestId('turrell-layer')
    expect(layers.length).toBeGreaterThan(0)
    for (const layer of layers) expect(layer.style.clipPath).toBe('circle(50%)')
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


describe('GradientPage back to gallery', () => {
  it('leaves the full-screen view with a Close control, matching the gallery viewer', () => {
    // The gallery's full-screen viewer closes with a ✕ in this exact corner,
    // and these are the same kind of surface. A back chevron promised a step
    // backwards through history, which is not what it does.
    render(
      <GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.getByTestId('feed-back')).toHaveAttribute('aria-label', 'Close')
    expect(screen.queryByLabelText('Back to gallery')).toBeNull()
  })

  it('renders a back button only when a caller wires onBack', () => {
    // Other GradientPage surfaces have their own close chrome; they must not
    // grow a second back control just because the feed wanted one.
    const { queryByTestId } = render(
      <GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />
    )
    expect(queryByTestId('feed-back')).toBeNull()
  })

  it('calls onBack, and does NOT open the editor', () => {
    // Tapping the gradient anywhere opens the editor, so a control sitting on
    // top of it has to be excluded from that — the pointer handler filters
    // `button`, and this pins that the back chevron benefits from it.
    const onBack = vi.fn()
    const onEdit = vi.fn()
    render(
      <GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} onBack={onBack} />
    )
    const back = screen.getByTestId('feed-back')
    fireEvent.pointerDown(back, { clientX: 20, clientY: 20 })
    fireEvent.pointerUp(back, { clientX: 20, clientY: 20 })
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })
})
