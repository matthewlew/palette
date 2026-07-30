import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ColorList, parseHex, parsePosition } from './ColorList'
import type { EditableStop } from '../lib/stopOrdering'

const stops: EditableStop[] = [
  { id: 'a', hex: '#ff0000', position: 0 },
  { id: 'b', hex: '#00ff00', position: 50 },
  { id: 'c', hex: '#0000ff', position: 100 },
]

function setup(overrides: Partial<React.ComponentProps<typeof ColorList>> = {}) {
  const props = {
    stops,
    lockedColors: {},
    lockedPositions: {},
    onRecolor: vi.fn(),
    onReposition: vi.fn(),
    onToggleLock: vi.fn(),
    onTogglePositionLock: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(),
    cssText: 'background-image: linear-gradient(180deg, #ff0000 0%, #0000ff 100%);',
    ...overrides,
  }
  render(<ColorList {...props} />)
  return props
}

afterEach(cleanup)

describe('parseHex', () => {
  it('accepts what people actually paste', () => {
    expect(parseHex('#FF0000')).toBe('#ff0000')
    expect(parseHex('ff0000')).toBe('#ff0000')
    expect(parseHex('  #AbC  ')).toBe('#aabbcc')
    expect(parseHex('#abc')).toBe('#aabbcc')
  })

  it('rejects anything that is not a color yet', () => {
    // Partial input must not commit, or the field fights the user mid-type.
    expect(parseHex('#f')).toBeNull()
    expect(parseHex('#ff00')).toBeNull()
    expect(parseHex('rebeccapurple')).toBeNull()
    expect(parseHex('')).toBeNull()
  })
})

describe('ColorList', () => {
  it('shows every stop with its hex code visible', () => {
    setup()
    const fields = screen.getAllByTestId('color-list-hex') as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['#FF0000', '#00FF00', '#0000FF'])
  })

  it('recolors from the row swatch and from the hex field', () => {
    const { onRecolor } = setup()
    fireEvent.change(screen.getAllByTestId('color-list-swatch')[0], { target: { value: '#112233' } })
    expect(onRecolor).toHaveBeenCalledWith('a', '#112233')

    fireEvent.change(screen.getAllByTestId('color-list-hex')[2], { target: { value: '444' } })
    expect(onRecolor).toHaveBeenCalledWith('c', '#444444')
  })

  it('reports the lock toggle with the stop index and current hex', () => {
    const { onToggleLock } = setup()
    fireEvent.click(screen.getAllByTestId('color-list-lock')[1])
    expect(onToggleLock).toHaveBeenCalledWith(1, '#00ff00')
  })

  it('marks locked rows as pressed', () => {
    setup({ lockedColors: { 1: '#00ff00' } })
    const locks = screen.getAllByTestId('color-list-lock')
    expect(locks[0]).toHaveAttribute('aria-pressed', 'false')
    expect(locks[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('refuses to remove below two stops', () => {
    setup({ stops: stops.slice(0, 2) })
    screen.getAllByTestId('color-list-remove').forEach((button) => expect(button).toBeDisabled())
  })

  it('offers the CSS as a copy button, not a visible/selectable text field', () => {
    // A textarea used to sit here so the CSS was visible as well as
    // copyable — on touch, a finger landing in ANY text field (read-only or
    // not) hands the whole scroll gesture to the browser's native
    // caret/selection handling, which never gives it back. A plain button
    // has no such gesture to steal.
    setup()
    expect(screen.queryByTestId('gradient-css')).not.toBeInTheDocument()
    expect(screen.getByTestId('gradient-css-copy')).toHaveTextContent('Copy CSS')
  })

  it('highlights the row for the selected stop', () => {
    setup({ activeStopId: 'b' })
    const rows = screen.getAllByTestId('color-list-row')
    expect(rows[0].className).not.toMatch(/rowActive/)
    expect(rows[1].className).toMatch(/rowActive/)
  })
})

describe('parsePosition', () => {
  it('accepts a bare number or one with a unit, clamped to the track', () => {
    expect(parsePosition('50')).toBe(50)
    expect(parsePosition(' 25% ')).toBe(25)
    expect(parsePosition('0')).toBe(0)
    expect(parsePosition('999')).toBe(100)
  })

  it('rejects anything that is not a position yet', () => {
    // An empty or half-typed field must not commit as 0 mid-keystroke.
    expect(parsePosition('')).toBeNull()
    expect(parsePosition('-')).toBeNull()
    expect(parsePosition('4.5')).toBeNull()
    expect(parsePosition('abc')).toBeNull()
  })
})

describe('ColorList positions', () => {
  it('shows each stop percentage and reports edits', () => {
    const { onReposition } = setup()
    const fields = screen.getAllByTestId('color-list-position') as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['0', '50', '100'])

    fireEvent.change(fields[1], { target: { value: '25' } })
    expect(onReposition).toHaveBeenCalledWith('b', 25)
  })

  it('reports the position lock with the stop index and current percentage', () => {
    const { onTogglePositionLock } = setup()
    fireEvent.click(screen.getAllByTestId('color-list-position-lock')[2])
    expect(onTogglePositionLock).toHaveBeenCalledWith(2, 100)
  })

  it('marks a pinned position pressed, independently of the colour lock', () => {
    setup({ lockedPositions: { 1: 50 }, lockedColors: {} })
    const positionLocks = screen.getAllByTestId('color-list-position-lock')
    expect(positionLocks.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    // The colour locks are untouched — the two are separate facts about a stop.
    const colorLocks = screen.getAllByTestId('color-list-lock')
    expect(colorLocks.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false'])
  })
})
