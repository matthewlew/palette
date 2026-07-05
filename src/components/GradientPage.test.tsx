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
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.backgroundImage).toContain('linear-gradient')
    expect(page.style.backgroundImage).toContain('rgb(255, 0, 0)')
  })

  it('calls onSave and shows a heart flash on double-tap', () => {
    const onSave = vi.fn()
    render(<GradientPage gradient={gradient} onSave={onSave} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    fireEvent.pointerUp(page)

    expect(onSave).toHaveBeenCalledWith(gradient)
    expect(screen.getByTestId('heart-flash')).toBeInTheDocument()
  })

  it('calls onEdit on a single tap after the debounce window', () => {
    vi.useFakeTimers()
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={onEdit} />)
    const page = screen.getByTestId('gradient-page')

    fireEvent.pointerUp(page)
    vi.advanceTimersByTime(350)

    expect(onEdit).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('sets touch-action manipulation to suppress native zoom', () => {
    render(<GradientPage gradient={gradient} onSave={vi.fn()} onEdit={vi.fn()} />)
    const page = screen.getByTestId('gradient-page')
    expect(page.style.touchAction).toBe('manipulation')
  })
})
