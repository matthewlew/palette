import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInAnonymously: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => chain
      chain.or = () => chain
      chain.ilike = () => chain
      chain.limit = () => Promise.resolve({ data: [], error: null })
      chain.range = () => Promise.resolve({ data: [], error: null })
      chain.delete = () => chain
      chain.eq = () => Promise.resolve({ error: null })
      return chain
    },
  },
}))

const saved: Gradient[] = ['Alpha', 'Beta', 'Gamma'].map((name, i) => ({
  id: `g${i + 1}`,
  name,
  type: 'linear',
  createdAt: 1000 * (i + 1),
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}))

function tile(id: string): HTMLElement {
  return screen.getByTestId('gallery').querySelector(`[data-tile-id="${id}"]`) as HTMLElement
}

/** The drop half of an HTML5 drag; jsdom has no drag engine, so the sequence
 * the Tile listens for is dispatched directly. */
function dragOnto(fromId: string, toId: string) {
  fireEvent.dragStart(tile(fromId))
  fireEvent.dragEnter(tile(toId))
  fireEvent.drop(tile(toId))
  fireEvent.dragEnd(tile(fromId))
}

function picks(): string[] {
  return useAppStore.getState().carouselPicks
}

function savedIds(): string[] {
  return useAppStore.getState().saved.map((g) => g.id)
}

function enterSelectMode() {
  fireEvent.click(screen.getByTestId('carousel-pick-toggle'))
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...useAppStore.getInitialState(), saved, mode: 'gallery' })
})

afterEach(() => {
  cleanup()
})

describe('Gallery — dragging tiles while selecting', () => {
  it('reorders the carousel, not the gallery', () => {
    render(<Gallery onRiff={vi.fn()} />)
    enterSelectMode()
    fireEvent.click(tile('g2'))
    fireEvent.click(tile('g3'))
    expect(picks()).toEqual(['g2', 'g3'])

    dragOnto('g3', 'g2')

    // The drag moved slide 2 to slide 1...
    expect(picks()).toEqual(['g3', 'g2'])
    // ...and left the gallery's own arrangement completely alone.
    expect(savedIds()).toEqual(['g1', 'g2', 'g3'])
  })

  it('renumbers the badges to match', () => {
    render(<Gallery onRiff={vi.fn()} />)
    enterSelectMode()
    fireEvent.click(tile('g1'))
    fireEvent.click(tile('g2'))
    fireEvent.click(tile('g3'))

    dragOnto('g3', 'g1')

    const badgeOf = (id: string) =>
      tile(id).querySelector('[data-testid="pick-badge"]')?.textContent
    expect(badgeOf('g3')).toBe('1')
    expect(badgeOf('g1')).toBe('2')
    expect(badgeOf('g2')).toBe('3')
  })

  it('only makes picked tiles draggable', () => {
    render(<Gallery onRiff={vi.fn()} />)
    enterSelectMode()
    fireEvent.click(tile('g2'))
    // An unpicked tile holds no slide number, so there is nothing to drag.
    expect(tile('g2')).toHaveAttribute('draggable', 'true')
    expect(tile('g1')).toHaveAttribute('draggable', 'false')
  })

  it('ignores a drop onto an unpicked tile', () => {
    render(<Gallery onRiff={vi.fn()} />)
    enterSelectMode()
    fireEvent.click(tile('g2'))
    fireEvent.click(tile('g3'))

    dragOnto('g3', 'g1')

    expect(picks()).toEqual(['g2', 'g3'])
    expect(savedIds()).toEqual(['g1', 'g2', 'g3'])
  })

  it('goes back to reordering the gallery once selecting ends', () => {
    render(<Gallery onRiff={vi.fn()} />)
    // Hand-arranged order is the only one a drop can be written into.
    fireEvent.click(screen.getByTestId('saves-order-custom'))
    enterSelectMode()
    fireEvent.click(tile('g2'))
    fireEvent.click(screen.getByTestId('carousel-pick-toggle'))

    dragOnto('g3', 'g1')

    // Same gesture, other meaning: the gallery moved and the picks did not.
    expect(savedIds()).toEqual(['g3', 'g1', 'g2'])
    expect(picks()).toEqual(['g2'])
  })
})
