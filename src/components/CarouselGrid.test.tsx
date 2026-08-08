import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CarouselGrid } from './CarouselGrid'
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

function setup(overrides: Partial<Parameters<typeof CarouselGrid>[0]> = {}) {
  const props = {
    gradients: GRADIENTS,
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  }
  render(<CarouselGrid {...props} />)
  return props
}

function itemFor(id: string): HTMLElement {
  const el = document.querySelector(`[data-grid-id="${id}"]`)
  if (!el) throw new Error(`no tile for ${id}`)
  return el as HTMLElement
}

/** jsdom has no layout, so elementFromPoint always returns null and the drag
 * would never find a target. Map coordinates to tiles by their x position. */
function stubHitTesting(order: string[]) {
  // Assigned rather than spied on: jsdom doesn't define elementFromPoint at
  // all, so there is nothing to spy on. afterEach deletes it again.
  ;(document as Document & { elementFromPoint: (x: number, y: number) => Element | null })
    .elementFromPoint = (x: number) => {
    const id = order[Math.floor(x / 100)]
    return id ? itemFor(id) : null
  }
}

/** A press, a hold long enough to lift, and a drag to `toX`. */
function dragFromTo(id: string, fromX: number, toX: number) {
  fireEvent.pointerDown(itemFor(id), { pointerId: 1, button: 0, clientX: fromX, clientY: 0 })
  act(() => {
    vi.advanceTimersByTime(400)
  })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: toX, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: toX, clientY: 0 })
}

describe('CarouselGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (document as Partial<Document>).elementFromPoint
  })

  it('numbers every slide in order and labels the ends', () => {
    setup()
    expect(screen.getAllByTestId('grid-item')).toHaveLength(3)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('End')).toBeInTheDocument()
    // Only the middle slide is named; the ends carry their role instead.
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('reorders on a held drag onto another slide', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    dragFromTo('c', 250, 50)
    expect(onReorder).toHaveBeenCalledWith('c', 'a')
  })

  it('does not reorder when the press is released without a hold', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    fireEvent.pointerDown(itemFor('c'), { pointerId: 1, button: 0, clientX: 250, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 0 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('abandons the gesture when the pointer moves before the hold lands', () => {
    // This is the scroll case: a finger that travels before the hold completes
    // belongs to the page, not to us.
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    fireEvent.pointerDown(itemFor('c'), { pointerId: 1, button: 0, clientX: 250, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 250, clientY: 90 })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 90 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 90 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('does not reorder a slide onto itself', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    dragFromTo('b', 150, 155)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('ignores a non-primary button', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    fireEvent.pointerDown(itemFor('c'), { pointerId: 1, button: 2, clientX: 250, clientY: 0 })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 0 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('removes rather than drags when the press starts on the remove button', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onRemove, onReorder } = setup()
    const remove = screen.getByLabelText('Remove Gamma from the carousel')
    fireEvent.pointerDown(remove, { pointerId: 1, button: 0, clientX: 250, clientY: 0 })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledWith('c')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('moves a slide with the arrow keys', () => {
    const { onMove } = setup()
    fireEvent.keyDown(itemFor('b'), { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith('b', -1)
    fireEvent.keyDown(itemFor('b'), { key: 'ArrowRight' })
    expect(onMove).toHaveBeenCalledWith('b', 1)
  })

  it('removes a slide with Delete', () => {
    const { onRemove } = setup()
    fireEvent.keyDown(itemFor('b'), { key: 'Delete' })
    expect(onRemove).toHaveBeenCalledWith('b')
  })

  it('offers no nudge arrows — the drag replaced them', () => {
    setup()
    expect(screen.queryByText('‹')).not.toBeInTheDocument()
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })
})
