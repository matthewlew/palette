import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NoiseOverlay } from './NoiseOverlay'
import { GradientPage } from './GradientPage'
import { EditMode } from './EditMode'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  reversed: false,
}

beforeEach(() => {
  cleanup()
  useAppStore.setState(useAppStore.getInitialState())
  localStorage.clear()
})

describe('NoiseOverlay', () => {
  it('renders nothing when not visible', () => {
    render(<NoiseOverlay visible={false} />)
    expect(screen.queryByTestId('noise-overlay')).not.toBeInTheDocument()
  })

  it('renders a mono SVG-noise background when visible', () => {
    render(<NoiseOverlay visible={true} />)
    const el = screen.getByTestId('noise-overlay')
    expect(el.style.backgroundImage).toContain('data:image/svg+xml')
    expect(el.style.backgroundImage).toContain('feTurbulence')
    // Mono: color channels are zeroed, only alpha carries the noise.
    expect(el.style.backgroundImage).toContain('feColorMatrix')
  })
})

describe('grain toggle', () => {
  it('store defaults to noise off and toggleNoise flips it', () => {
    expect(useAppStore.getState().noiseEnabled).toBe(false)
    useAppStore.getState().toggleNoise()
    expect(useAppStore.getState().noiseEnabled).toBe(true)
  })

  it('the grain button in GradientPage toggles the overlay on', () => {
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.queryByTestId('noise-overlay')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('grain-button'))
    expect(screen.getByTestId('noise-overlay')).toBeInTheDocument()
  })

  it('tapping the grain button does not enter edit mode', () => {
    const onEdit = vi.fn()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={onEdit} />)
    const button = screen.getByTestId('grain-button')
    fireEvent.pointerDown(button, { clientX: 5, clientY: 5 })
    fireEvent.pointerUp(button, { clientX: 5, clientY: 5 })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('EditMode renders the overlay when noise is enabled and its button does not exit', () => {
    useAppStore.getState().toggleNoise()
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    expect(screen.getByTestId('noise-overlay')).toBeInTheDocument()
    const button = screen.getByTestId('grain-button')
    fireEvent.pointerDown(button, { clientX: 5, clientY: 5 })
    fireEvent.pointerUp(button, { clientX: 5, clientY: 5 })
    fireEvent.click(button)
    expect(onExit).not.toHaveBeenCalled()
    expect(useAppStore.getState().noiseEnabled).toBe(false)
  })
})
