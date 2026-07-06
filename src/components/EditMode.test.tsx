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
  seedName: 'bklyn-clay',
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
  it('renders the preview, geometry tabs, block stack, and swatch carousel', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByTestId('edit-mode-preview')).toBeInTheDocument()
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getAllByTestId('stack-block')).toHaveLength(3)
    expect(screen.getAllByTestId('swatch').length).toBeGreaterThan(0)
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
    // EditMode reads `gradient.reversed` from its `gradient` prop, not from a
    // live store subscription — in the real App, App re-renders EditMode with
    // a fresh `current` from the store on every change (App.tsx subscribes to
    // `current` via useAppStore and passes it straight through as the prop).
    // This test simulates that same parent behavior explicitly via `rerender`,
    // so each click sees the gradient's up-to-date `reversed` value, exactly
    // as it would in the real app.
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

  it('calls onExit when the exit button is tapped', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    fireEvent.click(screen.getByTestId('edit-mode-exit'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
