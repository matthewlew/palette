import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CarouselDeck } from './CarouselDeck'
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

function deckOf(n: number, onOpen = vi.fn()) {
  const gradients = Array.from({ length: n }, (_, i) => gradient(String(i)))
  render(<CarouselDeck gradients={gradients} onOpen={onOpen} />)
  return onOpen
}

function cards(): HTMLElement[] {
  return Array.from(screen.getByTestId('carousel-deck').querySelectorAll('span[style]')) as HTMLElement[]
}

describe('CarouselDeck', () => {
  it('renders nothing with no picks', () => {
    render(<CarouselDeck gradients={[]} onOpen={vi.fn()} />)
    expect(screen.queryByTestId('carousel-deck')).not.toBeInTheDocument()
  })

  it('opens the editor when tapped', () => {
    const onOpen = deckOf(4)
    fireEvent.click(screen.getByTestId('carousel-deck'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('announces the count, since the fan itself is decorative', () => {
    deckOf(5)
    expect(screen.getByLabelText(/5 gradients selected/i)).toBeInTheDocument()
  })

  it('says “1 gradient”, not “1 gradients”', () => {
    deckOf(1)
    expect(screen.getByLabelText(/1 gradient selected/i)).toBeInTheDocument()
  })

  it('grows the hand as picks are added', () => {
    const { rerender } = render(
      <CarouselDeck gradients={[gradient('a'), gradient('b')]} onOpen={vi.fn()} />
    )
    const narrow = screen.getByTestId('carousel-deck').style.width
    rerender(
      <CarouselDeck
        gradients={[gradient('a'), gradient('b'), gradient('c'), gradient('d')]}
        onOpen={vi.fn()}
      />
    )
    const wide = screen.getByTestId('carousel-deck').style.width
    expect(parseFloat(wide)).toBeGreaterThan(parseFloat(narrow))
  })

  it('caps the fan and counts the overflow', () => {
    deckOf(12)
    // Eight cards on screen; the rest are a badge rather than an unreadable mush.
    expect(cards().filter((c) => c.style.transform)).toHaveLength(8)
    expect(screen.getByText('+4')).toBeInTheDocument()
  })

  it('keeps its footprint as the hand grows, closing the cards up instead', () => {
    // A full hand must not run off the dock; the spacing shrinks to absorb it.
    deckOf(8)
    const wide = parseFloat(screen.getByTestId('carousel-deck').style.width)
    expect(wide).toBeLessThanOrEqual(250 + 94)
  })

  it('opens a card out of the pile when the pointer runs over the deck', () => {
    // Overlapping cards only earn their compression if there is a way to
    // decompress; the riffle is it.
    deckOf(6)
    const deck = screen.getByTestId('carousel-deck')
    const before = cards().map((c) => c.style.transform)
    fireEvent.pointerMove(deck, { clientX: 120, clientY: 60 })
    const after = cards().map((c) => c.style.transform)
    expect(after).not.toEqual(before)
  })

  it('brings the riffled card to the front so it is seen whole', () => {
    deckOf(6)
    const deck = screen.getByTestId('carousel-deck')
    fireEvent.pointerMove(deck, { clientX: 120, clientY: 60 })
    const zs = cards().map((c) => Number(c.style.zIndex))
    // Exactly one card is lifted above the natural stacking order.
    expect(zs.filter((z) => z > 6)).toHaveLength(1)
  })

  it('closes back up when the pointer leaves', () => {
    deckOf(6)
    const deck = screen.getByTestId('carousel-deck')
    const rest = cards().map((c) => c.style.transform)
    fireEvent.pointerMove(deck, { clientX: 120, clientY: 60 })
    fireEvent.pointerLeave(deck)
    expect(cards().map((c) => c.style.transform)).toEqual(rest)
  })

  it('fans the cards, so a hand reads as a hand', () => {
    deckOf(5)
    const rotations = cards()
      .map((c) => /rotate\((-?[\d.]+)deg\)/.exec(c.style.transform)?.[1])
      .filter(Boolean)
      .map(Number)
    expect(rotations).toHaveLength(5)
    // Symmetric about the middle card, which sits square.
    expect(rotations[0]).toBeLessThan(0)
    expect(rotations[2]).toBeCloseTo(0)
    expect(rotations[4]).toBeGreaterThan(0)
  })

  it('paints later picks on top, so the End card is the readable one', () => {
    deckOf(4)
    const zs = cards().map((c) => Number(c.style.zIndex))
    expect(zs).toEqual([0, 1, 2, 3])
  })
})
