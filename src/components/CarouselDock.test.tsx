import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CarouselDock } from './CarouselDock'
import type { Gradient } from '../store/types'

function gradient(id: string): Gradient {
  return {
    id,
    name: `G${id}`,
    type: 'linear',
    angle: 90,
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
  } as Gradient
}

function setup(n = 3) {
  const props = {
    gradients: Array.from({ length: n }, (_, i) => gradient(String(i))),
    onNext: vi.fn(),
    onClear: vi.fn(),
  }
  render(<CarouselDock {...props} />)
  return props
}

describe('CarouselDock', () => {
  it('offers exactly one primary action', () => {
    setup()
    // Collecting has one next step. Four buttons made picking gradients feel
    // like a file manager.
    expect(screen.getAllByRole('button')).toHaveLength(3) // deck, Clear, Next
    expect(screen.getByTestId('selection-next')).toBeInTheDocument()
    expect(screen.getByTestId('selection-clear')).toBeInTheDocument()
    expect(screen.queryByTestId('selection-download')).not.toBeInTheDocument()
    expect(screen.queryByTestId('selection-delete')).not.toBeInTheDocument()
    expect(screen.queryByTestId('selection-done')).not.toBeInTheDocument()
  })

  it('carries the count inside Next, not beside it', () => {
    setup(5)
    expect(screen.getByTestId('selection-count')).toHaveTextContent('5')
    expect(screen.getByTestId('selection-next')).toContainElement(
      screen.getByTestId('selection-count')
    )
  })

  it('opens the editor from Next and from the deck alike', () => {
    const { onNext } = setup()
    fireEvent.click(screen.getByTestId('selection-next'))
    fireEvent.click(screen.getByTestId('carousel-deck'))
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('clears the selection', () => {
    const { onClear } = setup()
    fireEvent.click(screen.getByTestId('selection-clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
