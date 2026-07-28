import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TileBoundary } from './TileBoundary'

function Boom(): never {
  throw new Error('bad hex')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TileBoundary', () => {
  it('renders its child when nothing goes wrong', () => {
    render(
      <TileBoundary>
        <span data-testid="tile">fine</span>
      </TileBoundary>
    )
    expect(screen.getByTestId('tile')).toBeInTheDocument()
  })

  it('swallows a throwing tile instead of taking the page down with it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div data-testid="grid">
        <TileBoundary>
          <Boom />
        </TileBoundary>
      </div>
    )
    expect(screen.getByTestId('grid')).toBeEmptyDOMElement()
  })

  it('keeps the rest of the grid on screen', () => {
    // The point of per-tile boundaries: one bad row costs one square, not the
    // gallery. A single boundary around the grid would lose all three.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div>
        <TileBoundary><span data-testid="a">a</span></TileBoundary>
        <TileBoundary><Boom /></TileBoundary>
        <TileBoundary><span data-testid="c">c</span></TileBoundary>
      </div>
    )
    expect(screen.getByTestId('a')).toBeInTheDocument()
    expect(screen.getByTestId('c')).toBeInTheDocument()
  })

  it('logs the label so the offending row can be found in the table', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <TileBoundary label="row-42">
        <Boom />
      </TileBoundary>
    )
    expect(spy.mock.calls.some((call) => String(call[0]).includes('row-42'))).toBe(true)
  })
})
