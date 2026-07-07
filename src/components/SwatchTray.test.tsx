import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwatchTray } from './SwatchTray'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import { oklchToHex } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'

const firstHex = oklchToHex(DEFAULT_COLOR_SET.colors[0].value)
const secondHex = oklchToHex(DEFAULT_COLOR_SET.colors[1].value)

const stops: EditableStop[] = [
  { id: 'a', hex: firstHex },
  { id: 'b', hex: '#123456' },
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
})
