import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './store/useAppStore'
import { feedSession, resetFeedSession } from './components/Feed'

vi.mock('./lib/supabase', () => ({
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

describe('Onboarding — the Community first-run strip', () => {
  it('offers a way to create on the tab a new user actually lands on', async () => {
    // Community is the sensible default (an empty Yours is a blank room), but
    // it left the only entry to creating as a dim "Create" in the bottom bar.
    render(<App />)
    const strip = await screen.findByTestId('community-starter')
    expect(strip).toBeInTheDocument()
    expect(strip).toHaveTextContent(/make your own/i)
  })

  it('starts a Create session from the strip, same as the full picker', async () => {
    render(<App />)
    await screen.findByTestId('community-starter')
    fireEvent.click(screen.getByTestId('start-fan'))

    await waitFor(() => expect(useAppStore.getState().mode).toBe('create'))
    expect(useAppStore.getState().current?.type).toBe('fan')
    expect(feedSession.lockedType).toBe('fan')
  })

  it('is gone for good once anything is saved — scaffolding, not furniture', async () => {
    useAppStore.setState({
      saved: [{
        id: 'g1', type: 'linear', name: 'Mine', createdAt: 1,
        stops: [{ hex: '#ff0000', position: 0 }, { hex: '#0000ff', position: 100 }],
      }],
    })
    render(<App />)
    // Let the community fetch settle so the absence is a real one.
    await waitFor(() => expect(screen.getByTestId('gallery')).toBeInTheDocument())
    expect(screen.queryByTestId('community-starter')).not.toBeInTheDocument()
  })

  it('stays out of the Yours tab, which has the full picker already', async () => {
    render(<App />)
    await screen.findByTestId('community-starter')
    fireEvent.click(screen.getByRole('button', { name: /^Yours/ }))

    expect(screen.queryByTestId('community-starter')).not.toBeInTheDocument()
    expect(screen.getByText('Create a gradient')).toBeInTheDocument()
  })

  it('offers the same shapes as the full picker, in the same order', async () => {
    // One component renders both (ShapeChoices); this pins that they have not
    // been allowed to drift back apart.
    render(<App />)
    await screen.findByTestId('community-starter')
    const inStrip = screen.getAllByTestId(/^start-/).map((b) => b.getAttribute('data-testid'))

    fireEvent.click(screen.getByRole('button', { name: /^Yours/ }))
    const inFull = screen.getAllByTestId(/^start-/).map((b) => b.getAttribute('data-testid'))

    expect(inStrip).toEqual(inFull)
    expect(inStrip).toEqual(['start-linear', 'start-radial', 'start-angular', 'start-square', 'start-fan'])
  })
})
