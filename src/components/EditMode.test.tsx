import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditMode } from './EditMode'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#00ff00', position: 50 },
    { hex: '#0000ff', position: 100 },
  ],
  reversed: false,
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().setCurrentGradient(gradient)
})

afterEach(() => {
  cleanup()
})

describe('EditMode', () => {
  it('renders the preview, geometry tabs, block stack, and swatch tray', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('edit-mode-preview')).toBeInTheDocument()
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getAllByTestId('stack-block')).toHaveLength(3)
    expect(screen.getAllByTestId('swatch').length).toBe(36)
  })

  it('renders BlockWheel instead of BlockStack for angular/square types', () => {
    render(<EditMode gradient={{ ...gradient, type: 'square' }} onExit={vi.fn()} />)
    expect(screen.getAllByTestId('wheel-wedge')).toHaveLength(3)
    expect(screen.queryAllByTestId('stack-block')).toHaveLength(0)
  })

  it('switching tabs updates the store current gradient type without changing stop colors', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Radial'))
    const updated = useAppStore.getState().current!
    expect(updated.type).toBe('radial')
    expect(updated.stops.map((s) => s.hex)).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('tapping the already-active tab toggles reversed on the store', () => {
    const { rerender } = render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(useAppStore.getState().current!.reversed).toBe(true)

    rerender(<EditMode gradient={useAppStore.getState().current!} onExit={vi.fn()} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(useAppStore.getState().current!.reversed).toBe(false)
  })

  it('removing a block updates the store to have one fewer, re-equalized stop', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    fireEvent.click(screen.getAllByTestId('remove-block')[1])
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(2)
    expect(updated.stops.map((s) => s.position)).toEqual([0, 100])
  })

  it('has no Done button; has a back chevron that calls onExit', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Back'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('single-tapping the preview exits after the double-tap window elapses', () => {
    vi.useFakeTimers()
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    fireEvent.pointerUp(screen.getByTestId('edit-mode-preview'))
    vi.advanceTimersByTime(350)
    expect(onExit).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('double-tapping the preview saves (likes) the gradient, shows the heart, and does not exit', () => {
    vi.useFakeTimers()
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const preview = screen.getByTestId('edit-mode-preview')
    fireEvent.pointerUp(preview)
    fireEvent.pointerUp(preview)
    expect(onExit).not.toHaveBeenCalled()
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(screen.getByTestId('heart-flash')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('tapping an unselected swatch appends a new stop', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const swatch = screen.getAllByTestId('swatch')[5]
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(useAppStore.getState().current!.stops).toHaveLength(4)
    vi.useRealTimers()
  })
})
