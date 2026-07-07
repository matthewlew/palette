import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditMode } from './EditMode'
import { useAppStore } from '../store/useAppStore'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { oklchToHex } from '../lib/oklch'
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
  localStorage.clear()
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
    expect(screen.getAllByTestId('flow-handle')).toHaveLength(3)
    expect(screen.getAllByTestId('swatch').length).toBe(60)
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

  it('tapping an already-selected swatch removes a stop, re-equalizing positions', () => {
    vi.useFakeTimers()
    const swatchHex = oklchToHex(DEFAULT_COLOR_SET.colors[5].value)
    const gradientWithSwatchStop: Gradient = {
      id: 'g4',
      type: 'linear',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: swatchHex, position: 50 },
        { hex: '#0000ff', position: 100 },
      ],
      reversed: false,
    }
    render(<EditMode gradient={gradientWithSwatchStop} onExit={vi.fn()} />)
    const selectedSwatch = screen.getAllByTestId('swatch')[5]
    fireEvent.pointerDown(selectedSwatch)
    fireEvent.pointerUp(document)
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(2)
    expect(updated.stops.map((s) => s.position)).toEqual([0, 100])
    vi.useRealTimers()
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

  it('tapping "Sort by lightness" reorders stops darkest to lightest', () => {
    const darkFirst: Gradient = {
      id: 'g2',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 0 }, // dark, l~0.45
        { hex: '#00ff00', position: 50 }, // light, l~0.87
        { hex: '#ff0000', position: 100 }, // mid, l~0.63
      ],
      reversed: false,
    }
    render(<EditMode gradient={darkFirst} onExit={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Sort by lightness'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.hex)).toEqual(['#0000ff', '#ff0000', '#00ff00'])
  })

  it('sorting by lightness also re-equalizes stop positions evenly', () => {
    const unequalPositions: Gradient = {
      id: 'g3',
      type: 'linear',
      stops: [
        { hex: '#0000ff', position: 5 }, // dark
        { hex: '#00ff00', position: 40 }, // light
        { hex: '#ff0000', position: 95 }, // mid
      ],
      reversed: false,
    }
    render(<EditMode gradient={unequalPositions} onExit={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Sort by lightness'))
    const updated = useAppStore.getState().current!
    expect(updated.stops.map((s) => s.position)).toEqual([0, 50, 100])
  })

  it('drag-adding a swatch onto the flow track (non-wheel type) inserts using the largest-gap heuristic', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const swatch = screen.getAllByTestId('swatch')[10]
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(document, { clientX: 0, clientY: 0 })
    const updated = useAppStore.getState().current!
    expect(updated.stops).toHaveLength(4)
    vi.useRealTimers()
  })

  it('shows the edit hint on mount and dismisses it on pointerdown anywhere in edit mode', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a swatch to edit')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('edit-mode'))

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
  })

  it('auto-dismisses the edit hint after 4 seconds', () => {
    vi.useFakeTimers()
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    expect(screen.getByText('Tap a swatch to edit')).toBeInTheDocument()

    vi.advanceTimersByTime(4000)

    expect(localStorage.getItem('palette-hint-edit')).toBe('1')
    vi.useRealTimers()
  })

  it('dragging a flow handle updates the store gradient position for that stop in real time', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 10 })

    const updated = useAppStore.getState().current!
    const movedStop = updated.stops.find((s) => s.hex === '#00ff00')!
    expect(movedStop.position).toBe(100)
  })

  it('exiting preserves exact custom positions without re-equalizing', () => {
    const onExit = vi.fn()
    render(<EditMode gradient={gradient} onExit={onExit} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 10 })

    fireEvent.click(screen.getByLabelText('Back'))
    expect(onExit).toHaveBeenCalledTimes(1)

    const updated = useAppStore.getState().current!
    const movedStop = updated.stops.find((s) => s.hex === '#00ff00')!
    expect(movedStop.position).toBe(100)
  })
})
