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

  // Grain is a setting, not a piece of canvas chrome: the floating round
  // toggle is gone from both surfaces and lives as an Effect chip in the edit
  // sheet. The feed still RENDERS the overlay — it just doesn't offer the
  // control there.
  it('GradientPage renders the overlay when noise is on, with no floating toggle', () => {
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.queryByTestId('noise-overlay')).not.toBeInTheDocument()
    expect(screen.queryByTestId('grain-button')).not.toBeInTheDocument()

    cleanup()
    useAppStore.getState().toggleNoise()
    render(<GradientPage gradient={gradient} liked={false} onToggleLike={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.getByTestId('noise-overlay')).toBeInTheDocument()
  })

  it('the sheet Grain chip toggles the overlay without exiting edit mode', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    expect(screen.queryByTestId('noise-overlay')).not.toBeInTheDocument()
    expect(screen.queryByTestId('grain-button')).not.toBeInTheDocument()

    const chip = screen.getByTestId('filter-grain')
    expect(screen.getByTestId('edit-sheet')).toContainElement(chip)
    fireEvent.click(chip)
    expect(useAppStore.getState().noiseEnabled).toBe(true)
    expect(screen.getByTestId('noise-overlay')).toBeInTheDocument()
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(chip)
    expect(useAppStore.getState().noiseEnabled).toBe(false)
    // In the sheet, so it is nowhere near the preview's tap-to-exit.
    expect(onExit).not.toHaveBeenCalled()
  })
})
