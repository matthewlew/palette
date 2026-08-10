import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DrumStopList, parseCoveragePercent } from './DrumStopList'
import { coverageToHex } from '../lib/riso'
import type { DrumEditableStop } from '../lib/riso'

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const inkNames = ['Fluorescent Pink', 'Cornflower', 'Yellow']
const inkHexes = ['#ff48b0', '#62a8e5', '#ffe800']

const stops: DrumEditableStop[] = [
  { id: 'a', coverage: [10, 5, 60], position: 0 },
  { id: 'b', coverage: [70, 0, 35], position: 50 },
  { id: 'c', coverage: [0, 90, 20], position: 100 },
]

function setup(overrides: Partial<React.ComponentProps<typeof DrumStopList>> = {}) {
  const props = {
    stops,
    inkNames,
    inkHexes,
    lockedCoverage: {},
    lockedPositions: {},
    onRecoverage: vi.fn(),
    onReposition: vi.fn(),
    onToggleCoverageLock: vi.fn(),
    onTogglePositionLock: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  }
  render(<DrumStopList {...props} />)
  return props
}

afterEach(cleanup)

describe('parseCoveragePercent', () => {
  it('accepts a bare number or one with a unit, clamped to 0-100', () => {
    expect(parseCoveragePercent('50')).toBe(50)
    expect(parseCoveragePercent(' 25% ')).toBe(25)
    expect(parseCoveragePercent('999')).toBe(100)
  })

  it('rejects anything that is not a percentage yet', () => {
    expect(parseCoveragePercent('')).toBeNull()
    expect(parseCoveragePercent('-')).toBeNull()
    expect(parseCoveragePercent('4.5')).toBeNull()
  })
})

describe('DrumStopList', () => {
  it('renders one row per stop with a coverage field per ink', () => {
    setup()
    expect(screen.getAllByTestId('drum-stop-row')).toHaveLength(3)
    expect(screen.getAllByTestId('drum-stop-coverage')).toHaveLength(9)
  })

  it('shows each stop coverage percentage', () => {
    setup()
    const fields = screen.getAllByTestId('drum-stop-coverage') as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['10', '5', '60', '70', '0', '35', '0', '90', '20'])
  })

  it('shows the composited color as a read-only swatch, not an input', () => {
    setup()
    const swatches = screen.getAllByTestId('drum-stop-swatch')
    expect(swatches).toHaveLength(3)
    expect(swatches[0].tagName).toBe('SPAN')
    expect(swatches[0].style.backgroundColor).toBe(hexToRgb(coverageToHex(stops[0].coverage, inkHexes)))
  })

  it('reports a coverage edit with the stop id, ink index, and new percent', () => {
    const { onRecoverage } = setup()
    const fields = screen.getAllByTestId('drum-stop-coverage')
    fireEvent.change(fields[1], { target: { value: '42' } })
    expect(onRecoverage).toHaveBeenCalledWith('a', 1, 42)
  })

  it('reports position edits', () => {
    const { onReposition } = setup()
    const fields = screen.getAllByTestId('drum-stop-position')
    fireEvent.change(fields[1], { target: { value: '25' } })
    expect(onReposition).toHaveBeenCalledWith('b', 25)
  })

  it('reports the coverage lock toggle with the stop index and current coverage', () => {
    const { onToggleCoverageLock } = setup()
    fireEvent.click(screen.getAllByTestId('drum-stop-lock')[1])
    expect(onToggleCoverageLock).toHaveBeenCalledWith(1, stops[1].coverage)
  })

  it('marks locked rows as pressed, independently for coverage and position', () => {
    setup({ lockedCoverage: { 1: stops[1].coverage }, lockedPositions: { 2: 100 } })
    const coverageLocks = screen.getAllByTestId('drum-stop-lock')
    expect(coverageLocks.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    const positionLocks = screen.getAllByTestId('drum-stop-position-lock')
    expect(positionLocks.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })

  it('refuses to remove below two stops', () => {
    setup({ stops: stops.slice(0, 2) })
    screen.getAllByTestId('drum-stop-remove').forEach((button) => expect(button).toBeDisabled())
  })

  it('disables Add once the stop ceiling is reached', () => {
    const eight: DrumEditableStop[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      coverage: [10, 10, 10],
      position: i * 10,
    }))
    setup({ stops: eight })
    expect(screen.getByTestId('drum-stop-list-add')).toBeDisabled()
  })

  it('highlights the row for the selected stop', () => {
    setup({ activeStopId: 'b' })
    const rows = screen.getAllByTestId('drum-stop-row')
    expect(rows[0].className).not.toMatch(/rowActive/)
    expect(rows[1].className).toMatch(/rowActive/)
  })
})
