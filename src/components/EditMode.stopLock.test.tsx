import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { EditMode } from './EditMode'
import { Feed, resetFeedSession, startFeedWithType } from './Feed'
import { useAppStore } from '../store/useAppStore'
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

/** App renders EditMode from the store, so scrubbing the rolodex re-renders it
 * with the newly generated gradient. Rendering a fixed prop instead would pin
 * the editor to the palette it started on and make every assertion about what
 * happens AFTER a scrub meaningless. */
function Harness() {
  const current = useAppStore((s) => s.current)
  return current ? <EditMode gradient={current} onExit={vi.fn()} /> : null
}

function scrub(times: number): number[] {
  const counts: number[] = []
  for (let i = 0; i < times; i++) {
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    counts.push(useAppStore.getState().current!.stops.length)
  }
  return counts
}

function lockChip(): HTMLElement {
  return screen.getByTestId('filter-stop-lock')
}

/** Select a handle and delete it — the editor's own remove gesture. */
function removeStop(index: number) {
  const handles = screen.getAllByTestId('flow-handle')
  fireEvent.pointerDown(handles[index], { clientX: 0, clientY: 0 })
  fireEvent.pointerUp(handles[index], { clientX: 0, clientY: 0 })
  fireEvent.keyDown(handles[index], { key: 'Backspace' })
}

/** Tap a blank spot on the track, which is how a colour is added. jsdom has no
 * layout, so the track has to be given one for the tap to land at a position. */
function addStop() {
  const track = screen.getByTestId('flow-editor')
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, toJSON() {},
  } as DOMRect)
  fireEvent.pointerDown(track, { clientX: 60, clientY: 20 })
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
  resetFeedSession()
  startFeedWithType(gradient)
  useAppStore.getState().setCurrentGradient(gradient)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('EditMode — locking the number of colour stops', () => {
  it('starts unlocked, and says so', () => {
    render(<Harness />)
    expect(lockChip()).toHaveAttribute('aria-pressed', 'false')
    expect(lockChip().textContent).toBe('Stops: any')
    expect(lockChip()).toHaveAttribute('aria-label', 'Stops unlocked. Tap to lock to 3, in their current places')
    expect(useAppStore.getState().lockedStopLayout).toBeNull()
  })

  it('lives on the stops row, not among the Effect chips', () => {
    // It governs the stops, and the stops are on screen under both tabs — in
    // Effect it was reachable from only one half of a control that applies to
    // both, and it was the odd seventh chip in a three-column grid.
    render(<Harness />)
    expect(screen.getByTestId('section-panel-effect')).not.toContainElement(lockChip())
    expect(screen.getByTestId('edit-sheet')).toContainElement(lockChip())
  })

  it('locks to the count of the palette in front of you', () => {
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 50, 100])
    expect(lockChip()).toHaveAttribute('aria-pressed', 'true')
    expect(lockChip().textContent).toBe('Stops: 3 locked')
    expect(lockChip()).toHaveAttribute('aria-label', 'Stops locked to 3, in their current places. Tap to unlock')
  })

  it('holds the count through a long scrub of the rolodex', () => {
    // The whole point: locked to three, every gradient the feed hands back has
    // three colours, however far you scroll.
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(new Set(scrub(20))).toEqual(new Set([3]))
  })

  it('varies the count again once the lock comes off', () => {
    // 20 draws from 3-6: all landing on the same number has a probability of
    // about 4e-12, so this is a real assertion rather than a hopeful one.
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(new Set(scrub(5))).toEqual(new Set([3]))

    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toBeNull()
    expect(lockChip().textContent).toBe('Stops: any')
    expect(new Set(scrub(20)).size).toBeGreaterThan(1)
  })

  it('follows a deleted colour down, and keeps generating the new count', () => {
    // A lock that fought the edit would hand back the old count on the next
    // scrub and silently undo what you just did.
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 50, 100])

    removeStop(1)
    expect(useAppStore.getState().current!.stops).toHaveLength(2)
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 100])
    expect(lockChip().textContent).toBe('Stops: 2 locked')

    expect(new Set(scrub(10))).toEqual(new Set([2]))
  })

  it('follows an added colour up, and keeps generating the new count', () => {
    render(<Harness />)
    fireEvent.click(lockChip())

    addStop()
    expect(useAppStore.getState().lockedStopLayout).toHaveLength(4)
    expect(lockChip().textContent).toBe('Stops: 4 locked')

    expect(new Set(scrub(10))).toEqual(new Set([4]))
  })

  it('leaves the count alone when a stop is edited but not added or removed', () => {
    render(<Harness />)
    fireEvent.click(lockChip())

    const handle = screen.getAllByTestId('flow-handle')[0]
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0 })
    fireEvent.change(screen.getByTestId('color-input'), { target: { value: '#00ffee' } })

    expect(useAppStore.getState().current!.stops[0].hex).toBe('#00ffee')
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 50, 100])
  })

  it('does not touch the count while unlocked, however much you edit', () => {
    render(<Harness />)
    removeStop(1)
    expect(useAppStore.getState().current!.stops).toHaveLength(2)
    expect(useAppStore.getState().lockedStopLayout).toBeNull()
  })

  it('holds the count in the Create feed too, which is the surface you scroll', () => {
    // The lock is set in the editor but the rolodex is the same rolodex, and
    // the feed is where most of the scrolling happens. Honouring it in only one
    // of the two would look like the lock switching itself off on the way out.
    render(<Harness />)
    fireEvent.click(lockChip())
    removeStop(1)
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 100])
    cleanup()

    render(<Feed />)
    const counts: number[] = []
    for (let i = 0; i < 15; i++) {
      fireEvent.keyDown(window, { key: 'PageDown' })
      counts.push(useAppStore.getState().current!.stops.length)
    }
    expect(new Set(counts)).toEqual(new Set([2]))
  })

  it('holds the PLACEMENTS through a scrub, not just how many there are', () => {
    // A count-only lock still re-spaced every generated palette evenly, so
    // locking a gradient whose stops had been dragged into place gave back the
    // right number of stops in the wrong places — it preserved the least
    // interesting half of the thing you locked.
    const uneven: Gradient = {
      ...gradient,
      id: 'uneven',
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#00ff00', position: 8 },
        { hex: '#0000ff', position: 15 },
        { hex: '#ffff00', position: 100 },
      ],
    }
    act(() => useAppStore.getState().setCurrentGradient(uneven))
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 8, 15, 100])

    for (let i = 0; i < 12; i++) {
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([0, 8, 15, 100])
    }
  })

  it('follows a stop dragged along the track', () => {
    // Same reason the lock follows add and remove: one that held the old
    // placement would put the stop back on the next scrub.
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 50, 100])

    const track = screen.getByTestId('flow-editor')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, toJSON() {},
    } as DOMRect)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 20 })
    fireEvent.pointerMove(handle, { clientX: 24, clientY: 20 })

    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 12, 100])
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([0, 12, 100])
  })

  it('settles on a fractional position instead of looping forever', () => {
    // The track maps pixels to percent and does not round, so a dragged stop
    // carries something like 12.4 while the store rounds to 12 on write.
    // Comparing the raw value against the stored one never matches, so the
    // sync effect writes again on every render — React tears the tree down
    // with a max-update-depth error the moment you drag a handle while locked.
    // Found in a browser, not here: the jsdom drag below happened to land on a
    // whole number until this test made it land between two.
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args[0]) })

    render(<Harness />)
    fireEvent.click(lockChip())

    const track = screen.getByTestId('flow-editor')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 187, height: 40, right: 187, bottom: 40, toJSON() {},
    } as DOMRect)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.pointerDown(handle, { clientX: 93, clientY: 20 })
    // 41 / 187 = 21.925...%, which never equals its own rounded form.
    fireEvent.pointerMove(handle, { clientX: 41, clientY: 20 })

    expect(errors.filter((e) => String(e).includes('Maximum update depth'))).toEqual([])
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 22, 100])
    // And it is a fixpoint: the stored layout is what the next scrub uses.
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([0, 22, 100])
    spy.mockRestore()
  })

  it('re-ranks colours by Order without disturbing a locked layout', () => {
    render(<Harness />)
    const track = screen.getByTestId('flow-editor')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, toJSON() {},
    } as DOMRect)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 20 })
    fireEvent.pointerMove(handle, { clientX: 24, clientY: 20 })

    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 12, 100])

    fireEvent.click(screen.getByTestId('sort-button'))
    expect(useAppStore.getState().current!.stops.map((s) => s.position)).toEqual([0, 12, 100])
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 12, 100])
  })

  it('adopts the count of a palette opened with a different one', () => {
    // The lock is about what you are looking at. Riffing a five-colour palette
    // from the gallery and then being fed three-colour ones would read as the
    // lock ignoring the thing it is supposedly locked to.
    render(<Harness />)
    fireEvent.click(lockChip())
    expect(useAppStore.getState().lockedStopLayout).toEqual([0, 50, 100])

    act(() => {
      useAppStore.getState().setCurrentGradient({
        ...gradient,
        id: 'g2',
        stops: [
          { hex: '#111111', position: 0 },
          { hex: '#222222', position: 33 },
          { hex: '#333333', position: 66 },
          { hex: '#444444', position: 100 },
        ],
      })
    })
    expect(useAppStore.getState().lockedStopLayout).toHaveLength(4)
    expect(new Set(scrub(10))).toEqual(new Set([4]))
  })
})
