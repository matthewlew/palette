import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { GradientPage } from './GradientPage'
import { useAppStore } from '../store/useAppStore'
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

describe('GradientPage destination-aware save', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
  })

  it('adds the freshly-saved gradient to the active collection on Save', () => {
    const cid = useAppStore.getState().createCollection('Kiln')
    useAppStore.getState().setActiveCollection(cid)
    // onToggleLike mirrors the feed's behavior: it saves the shown gradient.
    const onToggleLike = () => useAppStore.getState().saveGradient(gradient)

    render(<GradientPage gradient={gradient} liked={false} onToggleLike={onToggleLike} onEdit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('like-button'))

    const savedId = useAppStore.getState().saved[0].id
    expect(useAppStore.getState().collections[0].gradientIds).toContain(savedId)
  })

  it('does not touch collections when no collection is active', () => {
    const cid = useAppStore.getState().createCollection('Kiln')
    // Not active.
    const onToggleLike = () => useAppStore.getState().saveGradient(gradient)

    render(<GradientPage gradient={gradient} liked={false} onToggleLike={onToggleLike} onEdit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('like-button'))

    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(useAppStore.getState().collections.find((c) => c.id === cid)!.gradientIds).toEqual([])
  })
})
