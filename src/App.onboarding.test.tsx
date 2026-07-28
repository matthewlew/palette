import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './store/useAppStore'
import { feedSession, resetFeedSession } from './components/Feed'

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.order = () => chain
      chain.or = () => chain
      chain.ilike = () => chain
      chain.eq = () => chain
      chain.single = () => Promise.resolve({ data: null, error: null })
      chain.limit = () => Promise.resolve({ data: [], error: null })
      chain.range = () => Promise.resolve({ data: [], error: null })
      chain.delete = () => chain
      return chain
    },
  },
}))

beforeEach(() => {
  localStorage.clear()
  resetFeedSession()
  useAppStore.setState({ saved: [], mode: 'gallery', current: null, likedPaletteIds: [] })
})

afterEach(() => {
  cleanup()
})

/** A brand-new user lands on Community (there is something to look at there);
 * the shape picker lives under Yours, which is empty. */
function showOnboarding() {
  fireEvent.click(screen.getByRole('button', { name: /^Yours/ }))
}

describe('Onboarding — picking a shape from an empty Gallery', () => {
  it('offers the shapes instead of dead filters', () => {
    render(<App />)
    showOnboarding()
    expect(screen.getByText('Create a gradient')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Radial/ })).toBeInTheDocument()
  })

  it('takes you into Create with that shape — it used to do nothing at all', async () => {
    // Gallery called `onStartType?.()` and App never passed the prop, so the
    // optional call swallowed every tap. A whole surface's only call to action
    // was inert.
    render(<App />)
    showOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /Radial/ }))

    await waitFor(() => expect(useAppStore.getState().mode).toBe('create'))
    expect(useAppStore.getState().current?.type).toBe('radial')
  })

  it('locks the feed to the chosen shape, so scrolling stays on it', async () => {
    render(<App />)
    showOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /Angular/ }))

    await waitFor(() => expect(feedSession.lockedType).toBe('angular'))
  })

  it('starts a FRESH session rather than appending, since there is nothing to riff on', async () => {
    // Riff appends to the rolodex because you picked something to change.
    // Here the Gallery is empty; scrolling up from the first gradient should
    // not walk back into somebody else's history.
    feedSession.history = [
      { id: 'stale', type: 'linear', stops: [{ hex: '#000000', position: 0 }, { hex: '#ffffff', position: 100 }] },
    ]
    feedSession.index = 0

    render(<App />)
    showOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /Turrell/ }))

    await waitFor(() => expect(feedSession.history).toHaveLength(1))
    expect(feedSession.history[0].id).not.toBe('stale')
    expect(feedSession.index).toBe(0)
  })

  it('gives every offered shape a working destination', async () => {
    for (const [label, type] of [
      ['Linear', 'linear'],
      ['Radial', 'radial'],
      ['Angular', 'angular'],
      ['Turrell', 'square'],
      ['Fan', 'fan'],
    ] as const) {
      cleanup()
      resetFeedSession()
      useAppStore.setState({ saved: [], mode: 'gallery', current: null })
      render(<App />)
      showOnboarding()
      fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
      await waitFor(() => expect(useAppStore.getState().current?.type).toBe(type))
      expect(useAppStore.getState().mode).toBe('create')
    }
  })

  it('lands on a real gradient, not the fixed swatch used for the previews', async () => {
    // The onboarding swatches all share one hard-coded preview palette; what
    // you get on the other side should be generated, like anything else in
    // the feed.
    render(<App />)
    showOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /Linear/ }))

    await waitFor(() => expect(useAppStore.getState().current).not.toBeNull())
    const current = useAppStore.getState().current!
    expect(current.stops.length).toBeGreaterThanOrEqual(2)
    expect(current.id).toBeTruthy()
  })
})
