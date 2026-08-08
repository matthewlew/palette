import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CarouselSequence } from './CarouselSequence'
import { buildCarousel, type BuildCarouselOptions } from '../lib/carouselTemplates'
import { captionParts } from '../lib/carouselCaption'
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

function setup(options: BuildCarouselOptions = { summary: false }, overrides = {}) {
  const props = {
    slides: buildCarousel(GRADIENTS.length, options),
    gradients: GRADIENTS,
    parts: captionParts(GRADIENTS),
    ratio: 'portrait' as const,
    framed: false,
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    onMove: vi.fn(),
    onAdd: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  }
  render(<CarouselSequence {...props} />)
  return props
}

function itemFor(id: string): HTMLElement {
  const el = document.querySelector(`[data-slide-id="${id}"]`)
  if (!el) throw new Error(`no slide for ${id}`)
  return el as HTMLElement
}

/** jsdom has no layout, so elementFromPoint is undefined and the drag would
 * never find a target. Map coordinates to slides by their x position. */
function stubHitTesting(order: string[]) {
  ;(document as Document & { elementFromPoint: (x: number, y: number) => Element | null })
    .elementFromPoint = (x: number) => {
    const id = order[Math.floor(x / 100)]
    return id ? itemFor(id) : null
  }
}

/** A mouse drag: press, travel, release. No hold — a mouse never has to be
 * told apart from a scroll. */
function dragFromTo(id: string, fromX: number, toX: number) {
  fireEvent.pointerDown(itemFor(id), { pointerId: 1, button: 0, clientX: fromX, clientY: 0 })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: toX, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: toX, clientY: 0 })
}

/** A touch drag: press, wait out the hold, travel, release. */
function touchDragFromTo(id: string, fromX: number, toX: number) {
  fireEvent.pointerDown(itemFor(id), {
    pointerId: 1,
    button: 0,
    pointerType: 'touch',
    clientX: fromX,
    clientY: 0,
  })
  act(() => {
    vi.advanceTimersByTime(400)
  })
  fireEvent.pointerMove(window, { pointerId: 1, clientX: toX, clientY: 0 })
  fireEvent.pointerUp(window, { pointerId: 1, clientX: toX, clientY: 0 })
}

function roles(): string[] {
  return screen
    .getAllByTestId('sequence-item')
    .map((el) => el.getAttribute('data-slide-role') ?? '')
}

describe('CarouselSequence', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (document as Partial<Document>).elementFromPoint
  })

  it('shows the order and the preview as one list, not two', () => {
    setup({ cover: 'stack', summary: true })
    // Cover, three gradients, summary — one entry each, numbered straight
    // through, so there is no second list to reconcile against.
    expect(roles()).toEqual(['cover', 'body', 'body', 'body', 'summary'])
    expect(screen.getByText('Cover')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('numbers slides by their place in the carousel, bookends included', () => {
    setup({ cover: 'stack', summary: true })
    const items = screen.getAllByTestId('sequence-item')
    // The first gradient is slide 2 when a cover is on. Numbering the whole
    // sequence is the point — the old order list numbered it 1.
    expect(items[1].querySelector('span')?.textContent).toBe('2')
  })

  it('reorders a mouse drag with no hold', () => {
    // The hold exists only to tell a drag apart from a touch scroll. Charging
    // a mouse for it made dragging feel broken: you press, nothing happens,
    // and a trackpad's own jitter cancels the gesture before it starts.
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    dragFromTo('c', 250, 50)
    expect(onReorder).toHaveBeenCalledWith('c', 'a')
  })

  it('reorders a touch drag once the hold has elapsed', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    touchDragFromTo('c', 250, 50)
    expect(onReorder).toHaveBeenCalledWith('c', 'a')
  })

  it('leaves a touch that moves before the hold to the page, as a scroll', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onReorder } = setup()
    fireEvent.pointerDown(itemFor('c'), {
      pointerId: 1,
      button: 0,
      pointerType: 'touch',
      clientX: 250,
      clientY: 0,
    })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 250, clientY: 90 })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 90 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 90 })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('carries the lifted slide with the pointer', () => {
    // Without this the card only scaled in place, so a drag that was working
    // still read as "nothing is happening".
    stubHitTesting(['a', 'b', 'c'])
    setup()
    fireEvent.pointerDown(itemFor('c'), { pointerId: 1, button: 0, clientX: 250, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 190, clientY: 12 })
    expect(itemFor('c').style.transform).toBe('translate(-60px, 12px)')
  })

  it('lets the hit test see past the lifted slide', () => {
    // Regression: once the card followed the pointer it sat directly under the
    // cursor, so the drop resolved to "onto itself" and every real drag was a
    // silent no-op. Only real browser input caught it — jsdom's hit test is
    // stubbed, so the bug is invisible to a coordinate-mapped fake.
    stubHitTesting(['a', 'b', 'c'])
    setup()
    fireEvent.pointerDown(itemFor('c'), { pointerId: 1, button: 0, clientX: 250, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 0 })
    expect(itemFor('c').style.pointerEvents).toBe('none')
  })

  it('opens a slide full screen on a tap, and does not reorder', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onOpen, onReorder } = setup()
    fireEvent.pointerDown(itemFor('b'), { pointerId: 1, button: 0, clientX: 150, clientY: 0 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 150, clientY: 0 })
    // Index into the slide list, which with no cover is the gradient's own
    // position — 'b' is the second pick.
    expect(onOpen).toHaveBeenCalledWith(1)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('treats a tiny wobble as a tap, not a drag', () => {
    stubHitTesting(['a', 'b', 'c'])
    const { onOpen, onReorder } = setup()
    fireEvent.pointerDown(itemFor('b'), { pointerId: 1, button: 0, clientX: 150, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 152, clientY: 2 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 152, clientY: 2 })
    expect(onOpen).toHaveBeenCalledWith(1)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('opens a bookend, which has no drag to hang a tap off', () => {
    const { onOpen } = setup({ cover: 'stack', summary: true })
    const cover = screen
      .getAllByTestId('sequence-item')
      .find((el) => el.getAttribute('data-slide-role') === 'cover')!
    fireEvent.click(cover)
    expect(onOpen).toHaveBeenCalledWith(0)
  })

  it('opens the focused slide with Enter', () => {
    const { onOpen } = setup()
    fireEvent.keyDown(itemFor('c'), { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledWith(2)
  })

  it('does not let the bookends be dragged', () => {
    setup({ cover: 'stack', summary: true })
    const fixed = screen
      .getAllByTestId('sequence-item')
      .filter((el) => el.getAttribute('data-slide-role') !== 'body')
    // A cover made of every pick has no position of its own to move to, and a
    // summary that isn't last isn't a summary.
    expect(fixed).toHaveLength(2)
    for (const el of fixed) {
      expect(el.getAttribute('data-reorder-id')).toBeNull()
    }
  })

  it('only offers remove on the gradients', () => {
    setup({ cover: 'stack', summary: true })
    expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(3)
  })

  it('rebuilds the bookends around the picks, so they cannot go stale', () => {
    const { rerender } = render(
      <CarouselSequence
        slides={buildCarousel(3, { cover: 'stack', summary: true })}
        gradients={GRADIENTS}
        parts={captionParts(GRADIENTS)}
        ratio="portrait"
        framed={false}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onMove={vi.fn()}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />
    )
    expect(roles()).toEqual(['cover', 'body', 'body', 'body', 'summary'])
    const two = GRADIENTS.slice(0, 2)
    rerender(
      <CarouselSequence
        slides={buildCarousel(2, { cover: 'stack', summary: true })}
        gradients={two}
        parts={captionParts(two)}
        ratio="portrait"
        framed={false}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onMove={vi.fn()}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />
    )
    expect(roles()).toEqual(['cover', 'body', 'body', 'summary'])
  })

  it('offers a way to add more, where you find out you need it', () => {
    const { onAdd } = setup()
    fireEvent.click(screen.getByTestId('sequence-add'))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('moves and removes a slide from the keyboard', () => {
    const { onMove, onRemove } = setup()
    fireEvent.keyDown(itemFor('b'), { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith('b', -1)
    fireEvent.keyDown(itemFor('b'), { key: 'Delete' })
    expect(onRemove).toHaveBeenCalledWith('b')
  })

  it('labels the first and last gradients, not the bookends’ neighbours', () => {
    setup({ cover: 'stack', summary: true })
    // Start/End describe where the picks begin and end, which is what the
    // order means; the cover and summary have their own names.
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('End')).toBeInTheDocument()
  })
})
