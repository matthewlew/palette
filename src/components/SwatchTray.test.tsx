import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwatchTray } from './SwatchTray'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { oklchToHex } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'

const firstHex = oklchToHex(DEFAULT_COLOR_SET.colors[0].value)
const secondHex = oklchToHex(DEFAULT_COLOR_SET.colors[1].value)

const stops: EditableStop[] = [
  { id: 'a', hex: firstHex, position: 0 },
  { id: 'b', hex: '#ffffff', position: 100 },
]

describe('SwatchTray', () => {
  it('renders one swatch per color in the active color set', () => {
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={vi.fn()} onDragAdd={vi.fn()} />)
    expect(screen.getAllByTestId('swatch')).toHaveLength(60)
  })

  it('shows a checkmark only for hexes present in stops', () => {
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={vi.fn()} onDragAdd={vi.fn()} />)
    expect(screen.getAllByTestId('swatch-checkmark')).toHaveLength(1)
  })

  it('tapping an unselected swatch calls onTapAdd with its hex', () => {
    vi.useFakeTimers()
    const onTapAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={onTapAdd} onTapRemove={vi.fn()} onDragAdd={vi.fn()} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(onTapAdd).toHaveBeenCalledWith(secondHex)
    vi.useRealTimers()
  })

  it('tapping a selected swatch calls onTapRemove with its hex', () => {
    vi.useFakeTimers()
    const onTapRemove = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={onTapRemove} onDragAdd={vi.fn()} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[0].name}`)
    fireEvent.pointerDown(swatch)
    fireEvent.pointerUp(document)
    expect(onTapRemove).toHaveBeenCalledWith(firstHex)
    vi.useRealTimers()
  })

  it('calls onDragAdd (not tap callbacks) after a 150ms hold before pointerup', () => {
    vi.useFakeTimers()
    const onTapAdd = vi.fn()
    const onDragAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={onTapAdd} onTapRemove={vi.fn()} onDragAdd={onDragAdd} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch, { clientX: 1, clientY: 2 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(document, { clientX: 10, clientY: 20 })
    expect(onDragAdd).toHaveBeenCalledWith(secondHex, { x: 10, y: 20 })
    expect(onTapAdd).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cancels a pending tap/drag when the pointer moves mostly-horizontally past the threshold before the hold elapses', () => {
    vi.useFakeTimers()
    const onTapAdd = vi.fn()
    const onDragAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={onTapAdd} onTapRemove={vi.fn()} onDragAdd={onDragAdd} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    // Mostly-horizontal move past the 8px threshold, before the 150ms hold elapses.
    fireEvent.pointerMove(window, { clientX: 20, clientY: 2 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(window, { clientX: 20, clientY: 2 })
    expect(onTapAdd).not.toHaveBeenCalled()
    expect(onDragAdd).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not cancel a pending tap when the move is mostly-vertical (still allows the hold to start a drag)', () => {
    vi.useFakeTimers()
    const onDragAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={vi.fn()} onTapRemove={vi.fn()} onDragAdd={onDragAdd} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 2, clientY: 20 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(window, { clientX: 2, clientY: 20 })
    expect(onDragAdd).toHaveBeenCalledWith(secondHex, { x: 2, y: 20 })
    vi.useRealTimers()
  })

  it('abandons a pending tap/drag on pointercancel (native pan-x takeover)', () => {
    vi.useFakeTimers()
    const onTapAdd = vi.fn()
    const onDragAdd = vi.fn()
    render(<SwatchTray colorSet={DEFAULT_COLOR_SET} stops={stops} onTapAdd={onTapAdd} onTapRemove={vi.fn()} onDragAdd={onDragAdd} />)
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    fireEvent.pointerDown(swatch, { clientX: 0, clientY: 0 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerCancel(window)
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0 })
    expect(onTapAdd).not.toHaveBeenCalled()
    expect(onDragAdd).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('shows a swatch as selected when a stop is a jittered near-match, not just an exact hex match', () => {
    // Jitter the second color's OKLCH slightly (within swatchMatch's tolerance)
    // so the stop's hex does NOT exactly equal the swatch's own hex.
    const secondColor = DEFAULT_COLOR_SET.colors[1].value
    const jitteredHex = oklchToHex({
      l: secondColor.l + 0.03,
      c: Math.max(0, secondColor.c - 0.01),
      h: secondColor.h + 6,
    })
    expect(jitteredHex).not.toBe(secondHex)

    const jitteredStops: EditableStop[] = [{ id: 'a', hex: jitteredHex, position: 0 }]
    render(
      <SwatchTray
        colorSet={DEFAULT_COLOR_SET}
        stops={jitteredStops}
        onTapAdd={vi.fn()}
        onTapRemove={vi.fn()}
        onDragAdd={vi.fn()}
      />
    )
    const swatch = screen.getByLabelText(`${DEFAULT_COLOR_SET.colors[1].name}`)
    expect(swatch.className).toContain('swatchSelected')
    expect(screen.getAllByTestId('swatch-checkmark')).toHaveLength(1)
  })
})
