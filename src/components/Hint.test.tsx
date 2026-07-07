import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hint } from './Hint'

describe('Hint', () => {
  it('renders the text with role="status" when visible', () => {
    render(<Hint text="Scroll to explore palettes ↓" visible={true} />)
    const el = screen.getByRole('status')
    expect(el.textContent).toBe('Scroll to explore palettes ↓')
  })

  it('renders nothing interactive-blocking when hidden (still in DOM but not visible)', () => {
    render(<Hint text="Double-tap to like" visible={false} />)
    const el = screen.getByRole('status')
    expect(el.style.opacity).toBe('0')
  })

  it('has pointer-events none so it never intercepts taps', () => {
    render(<Hint text="Tap a swatch to edit" visible={true} />)
    const el = screen.getByRole('status')
    expect(el.style.pointerEvents).toBe('none')
  })
})
