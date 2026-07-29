import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditMode, openColorPicker } from './EditMode'
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

function input(): HTMLInputElement {
  return screen.getByTestId('color-input') as HTMLInputElement
}

/** Records which of the two ways of opening a picker the code reached. */
function spyOnPicker(el: HTMLInputElement, { showPickerThrows = false, hasShowPicker = true } = {}) {
  const calls: string[] = []
  if (hasShowPicker) {
    Object.defineProperty(el, 'showPicker', {
      configurable: true,
      value: () => {
        calls.push('showPicker')
        if (showPickerThrows) throw new DOMException('not allowed', 'NotAllowedError')
      },
    })
  } else {
    Object.defineProperty(el, 'showPicker', { configurable: true, value: undefined })
  }
  vi.spyOn(el, 'click').mockImplementation(() => { calls.push('click') })
  return calls
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().setCurrentGradient(gradient)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('opening the OS colour picker', () => {
  it('asks the browser to show the picker rather than faking a click', () => {
    // A synthetic click only DISPATCHES a click event; whether that opens a
    // native picker is up to the engine, and iOS declined — which is why
    // tapping a stop worked with a mouse and did nothing on a phone.
    // showPicker is specified to open the picker, and to throw when it will
    // not, so a refusal is something the code can see.
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const calls = spyOnPicker(input())

    const handle = screen.getByLabelText('Stop #00ff00')
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0 })

    expect(calls).toEqual(['showPicker'])
    expect(input().value).toBe('#00ff00')
  })

  it('falls back to a click when the browser refuses showPicker', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const calls = spyOnPicker(input(), { showPickerThrows: true })

    const handle = screen.getByLabelText('Stop #ff0000')
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0 })

    expect(calls).toEqual(['showPicker', 'click'])
  })

  it('falls back to a click on a browser without showPicker at all', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const calls = spyOnPicker(input(), { hasShowPicker: false })

    const handle = screen.getByLabelText('Stop #0000ff')
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 0 })

    expect(calls).toEqual(['click'])
  })

  it('opens the picker when a colour is added by tapping the track', () => {
    render(<EditMode gradient={gradient} onExit={vi.fn()} />)
    const calls = spyOnPicker(input())
    const track = screen.getByTestId('flow-editor')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, toJSON() {},
    } as DOMRect)

    fireEvent.pointerDown(track, { clientX: 60, clientY: 20 })

    expect(calls).toEqual(['showPicker'])
  })

  it('parks the input over the stop being edited', () => {
    // A picker anchored to its control needs somewhere sensible to point; an
    // untouched 1x1 element leaves the popover in the corner of the screen.
    const el = document.createElement('input')
    el.type = 'color'
    Object.defineProperty(el, 'showPicker', { configurable: true, value: () => {} })
    const track = document.createElement('div')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 300, left: 20, top: 300, width: 200, height: 40, right: 220, bottom: 340, toJSON() {},
    } as DOMRect)

    openColorPicker(el, track, 25)
    expect(el.style.left).toBe('70px') // 20 + 200 * 0.25
    expect(el.style.top).toBe('320px') // 300 + 40 / 2
  })

  it('opens the picker even when the track has not been laid out', () => {
    // jsdom, a hidden sheet, a first paint — a zero-width track must not stop
    // the picker opening, only the positioning.
    const el = document.createElement('input')
    el.type = 'color'
    const calls: string[] = []
    Object.defineProperty(el, 'showPicker', { configurable: true, value: () => calls.push('showPicker') })

    openColorPicker(el, null, 50)
    expect(calls).toEqual(['showPicker'])
    expect(el.style.left).toBe('')
  })

  it('does nothing at all without an input, rather than throwing', () => {
    expect(() => openColorPicker(null, null, 50)).not.toThrow()
  })
})
