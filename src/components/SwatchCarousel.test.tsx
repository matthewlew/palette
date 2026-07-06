import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwatchCarousel } from './SwatchCarousel'
import { SEED_PALETTES } from '../lib/seedPalettes'
import { oklchToHex } from '../lib/oklch'

describe('SwatchCarousel', () => {
  it('renders one swatch per color in the named seed palette', () => {
    render(<SwatchCarousel seedName="bklyn-clay" onDragAdd={vi.fn()} />)
    const seed = SEED_PALETTES.find((p) => p.name === 'bklyn-clay')!
    expect(screen.getAllByTestId('swatch')).toHaveLength(seed.colors.length)
  })

  it('falls back to the first seed palette when seedName does not match any known palette', () => {
    render(<SwatchCarousel seedName="not-a-real-seed" onDragAdd={vi.fn()} />)
    expect(screen.getAllByTestId('swatch')).toHaveLength(SEED_PALETTES[0].colors.length)
  })

  it('calls onDragAdd with the swatch hex and pointer coordinates on pointerup after a drag start delay', () => {
    const onDragAdd = vi.fn()
    vi.useFakeTimers()
    render(<SwatchCarousel seedName="bklyn-clay" onDragAdd={onDragAdd} />)
    const swatch = screen.getAllByTestId('swatch')[0]
    fireEvent.pointerDown(swatch, { clientX: 10, clientY: 20 })
    vi.advanceTimersByTime(150)
    fireEvent.pointerUp(document, { clientX: 50, clientY: 60 })

    const expectedHex = oklchToHex(SEED_PALETTES.find((p) => p.name === 'bklyn-clay')!.colors[0])
    expect(onDragAdd).toHaveBeenCalledWith(expectedHex, { x: 50, y: 60 })
    vi.useRealTimers()
  })

  it('does not call onDragAdd if pointerup happens before the drag start delay elapses (a plain tap)', () => {
    const onDragAdd = vi.fn()
    vi.useFakeTimers()
    render(<SwatchCarousel seedName="bklyn-clay" onDragAdd={onDragAdd} />)
    const swatch = screen.getAllByTestId('swatch')[0]
    fireEvent.pointerDown(swatch, { clientX: 10, clientY: 20 })
    fireEvent.pointerUp(document, { clientX: 10, clientY: 20 })
    vi.advanceTimersByTime(150)
    expect(onDragAdd).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
