import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CarouselStudio } from './CarouselStudio'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

function gradient(id: string, name: string): Gradient {
  return {
    id,
    name,
    type: 'linear',
    angle: 90,
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
  } as Gradient
}

const GRADIENTS = [gradient('a', 'Alpha'), gradient('b', 'Beta'), gradient('c', 'Gamma')]

beforeEach(() => {
  useAppStore.setState({
    saved: GRADIENTS,
    carouselPicks: GRADIENTS.map((g) => g.id),
  })
})

afterEach(() => {
  cleanup()
})

describe('CarouselStudio layout', () => {
  it('puts the sequence in a main canvas area and the switches in a side panel, like EditMode', () => {
    render(<CarouselStudio onClose={vi.fn()} onAddMore={vi.fn()} />)

    const sequence = screen.getByTestId('carousel-sequence')
    const bookends = screen.getByText('Bookends').closest('section')!
    const format = screen.getByText('Format').closest('section')!
    const caption = screen.getByText('Caption').closest('section')!

    // The sequence lives outside the settings panel...
    expect(bookends.contains(sequence)).toBe(false)
    // ...and the settings sections share one panel container, distinct from it.
    const panel = bookends.parentElement
    expect(panel).toBe(format.parentElement)
    expect(panel).toBe(caption.parentElement)
    expect(panel?.contains(sequence)).toBe(false)
  })
})
