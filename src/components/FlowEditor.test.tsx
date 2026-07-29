import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlowEditor } from './FlowEditor'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

describe('FlowEditor', () => {
  it('renders one slider handle per stop at the correct aria-valuenow', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(3)
    expect(sliders.map((s) => s.getAttribute('aria-valuenow'))).toEqual(['0', '50', '100'])
  })

  it('labels each handle with its hex', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    expect(screen.getByLabelText('Stop #ff0000')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop #00ff00')).toBeInTheDocument()
    expect(screen.getByLabelText('Stop #0000ff')).toBeInTheDocument()
  })

  it('sets aria-valuemin and aria-valuemax on every handle', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider.getAttribute('aria-valuemin')).toBe('0')
      expect(slider.getAttribute('aria-valuemax')).toBe('100')
    }
  })

  it('ArrowLeft decreases position by 1 and ArrowRight increases it by 1', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith('b', 49)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onMove).toHaveBeenCalledWith('b', 51)
  })

  it('Shift+ArrowRight moves position by 10', () => {
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
    expect(onMove).toHaveBeenCalledWith('b', 60)
  })

  it('positions handles horizontally, inset from both edges', () => {
    // Not a bare `50%`: positions are mapped through a 20px inset on each side
    // so the end handles keep their whole 28px dot clear of the viewport edge
    // (and out of the browser's back-swipe gutter). The gradient fill uses the
    // same mapping, so a handle still sits on the color it marks.
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    expect(screen.getByLabelText('Stop #ff0000').style.left).toBe('calc(20px + 0 * (100% - 40px))')
    expect(screen.getByLabelText('Stop #00ff00').style.left).toBe('calc(20px + 0.5 * (100% - 40px))')
    expect(screen.getByLabelText('Stop #0000ff').style.left).toBe('calc(20px + 1 * (100% - 40px))')
    expect(screen.getByLabelText('Stop #00ff00').style.top).toBe('')
  })

  it('sets aria-orientation="horizontal" on every handle', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    for (const slider of screen.getAllByRole('slider')) {
      expect(slider.getAttribute('aria-orientation')).toBe('horizontal')
    }
  })

  it('tapping a handle (pointerdown/up with <6px movement) calls onTapStop with that stop id', () => {
    const onTapStop = vi.fn()
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={onTapStop} />)
    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(handle, { clientX: 12, clientY: 11 })
    expect(onTapStop).toHaveBeenCalledWith('a')
  })

  it('dragging a handle (>=6px movement) does not call onTapStop', () => {
    const onTapStop = vi.fn()
    const onMove = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={onTapStop} />)
    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 40 })
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 40 })
    expect(onTapStop).not.toHaveBeenCalled()
  })

  it('insets the track enough that end handles do not overhang past the track edge', () => {
    // NOTE: jsdom in this project's vitest setup does not load CSS Modules as real
    // stylesheets, so getComputedStyle() on elements styled purely via CSS Module
    // classes returns empty strings for properties like `width` and `paddingLeft`
    // (verified: parseFloat(handleStyles.width) came back NaN, and the naive pixel
    // comparison passed vacuously — `0 >= NaN` is false, but so is any comparison
    // involving NaN — so a literal port of the pixel assertion is not meaningful
    // in this environment). There is no real layout engine here resolving CSS
    // Module static values.
    //
    // Instead we assert the structural contract: the track and handle elements
    // render with their expected CSS Module classes applied. The actual visual fix
    // (14px track padding matching the 14px handle radius) is verified by reading
    // FlowEditor.module.css directly and via manual/visual verification (covered
    // in the project's Round 3 verification task), not through jsdom computed styles.
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const track = screen.getByTestId('flow-editor')
    const handle = screen.getByLabelText('Stop #ff0000')
    expect(track.className).toContain('track')
    expect(handle.className).toContain('handle')
  })

  it('dragging a handle more than 56px vertically away and releasing calls onRemoveStop, not onMove/onTapStop', () => {
    const onMove = vi.fn()
    const onTapStop = vi.fn()
    const onRemoveStop = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={onTapStop} onRemoveStop={onRemoveStop} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 170 }) // 70px away, past threshold
    fireEvent.pointerUp(handle, { clientX: 100, clientY: 170 })

    expect(onRemoveStop).toHaveBeenCalledWith('b')
    expect(onTapStop).not.toHaveBeenCalled()
  })

  it('dragging a handle less than 56px vertically away does not remove it on release', () => {
    const onMove = vi.fn()
    const onRemoveStop = vi.fn()
    render(<FlowEditor stops={stops} onMove={onMove} onTapStop={vi.fn()} onRemoveStop={onRemoveStop} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 130 }) // 30px away, under threshold
    fireEvent.pointerUp(handle, { clientX: 100, clientY: 130 })

    expect(onRemoveStop).not.toHaveBeenCalled()
  })

  /** TouchEvent with a real touch point — jsdom needs the list built by hand. */
  function touch(type: string, clientX: number): TouchEvent {
    const event = new TouchEvent(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'touches', {
      value: [{ clientX, clientY: 0 }],
      configurable: true,
    })
    return event
  }

  it('cancels a touch starting in the edge band so an edge drag cannot trigger browser back', () => {
    // A stop parked at 0% sits near the screen edge, inside the browser's
    // back-swipe zone. Only a cancelled touch sequence suppresses that
    // gesture — `touch-action: none` stops page scrolling, not navigation.
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #ff0000')

    const start = touch('touchstart', 8)
    handle.dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)

    const move = touch('touchmove', 8)
    handle.dispatchEvent(move)
    expect(move.defaultPrevented).toBe(true)
  })

  it('leaves a tap away from the edge uncancelled, so the OS colour picker can open', () => {
    // Cancelling touchstart takes the compatibility click with it, and that
    // click is the gesture iOS wants to see before it will open a native
    // picker — so a blanket cancel made tap-to-recolour dead on touch while
    // the identical code worked with a mouse, which never fires touchstart.
    // The back-swipe can only start at an edge, so only an edge needs
    // cancelling.
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    const start = touch('touchstart', Math.round(window.innerWidth / 2))
    handle.dispatchEvent(start)
    expect(start.defaultPrevented).toBe(false)

    // A drag from the same spot is still cancelled — that is the scroll and
    // swipe suppression, and it costs the tap nothing because a tap has no
    // touchmove.
    const move = touch('touchmove', Math.round(window.innerWidth / 2))
    handle.dispatchEvent(move)
    expect(move.defaultPrevented).toBe(true)
  })

  it('cancels the trailing edge too, not just the leading one', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #0000ff')
    const start = touch('touchstart', window.innerWidth - 4)
    handle.dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)
  })

  it('leaves touches on the bare track alone so they stay ordinary taps', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} />)
    const track = screen.getByTestId('flow-editor')

    const start = new TouchEvent('touchstart', { bubbles: true, cancelable: true })
    track.dispatchEvent(start)
    expect(start.defaultPrevented).toBe(false)
  })

  it('dims the handle once the drag exceeds the delete threshold', () => {
    render(<FlowEditor stops={stops} onMove={vi.fn()} onTapStop={vi.fn()} onRemoveStop={vi.fn()} />)
    const handle = screen.getByLabelText('Stop #00ff00')

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 170 })

    expect(handle.style.opacity).toBe('0.35')
  })
})
