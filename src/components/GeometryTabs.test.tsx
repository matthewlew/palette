import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GeometryTabs } from './GeometryTabs'

describe('GeometryTabs', () => {
  it('renders all 5 geometry tabs', () => {
    render(<GeometryTabs type="linear" onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    for (const label of ['Linear', 'Radial', 'Angular', 'Turrell', 'Mirror']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders Repeat x2 and Hard filter chips instead of a Repeat tab', () => {
    render(<GeometryTabs type="linear" onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.queryByText('Repeat')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-repeat')).toBeInTheDocument()
    expect(screen.getByTestId('filter-hard')).toBeInTheDocument()
  })

  it('toggles the repeat and hard filters independently of geometry type', () => {
    const onToggleRepeat = vi.fn()
    const onToggleHardStops = vi.fn()
    render(
      <GeometryTabs
        type="linear"
        onSelectType={vi.fn()}
        onToggleReversed={vi.fn()}
        onToggleRepeat={onToggleRepeat}
        onToggleHardStops={onToggleHardStops}
      />
    )
    fireEvent.click(screen.getByTestId('filter-repeat'))
    expect(onToggleRepeat).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('filter-hard'))
    expect(onToggleHardStops).toHaveBeenCalledTimes(1)
  })

  it('disables the filter chips for types that ignore them (square, mirror)', () => {
    render(<GeometryTabs type="square" onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByTestId('filter-repeat')).toBeDisabled()
    expect(screen.getByTestId('filter-hard')).toBeDisabled()
  })

  it('calls onSelectType when tapping a different, inactive tab', () => {
    const onSelectType = vi.fn()
    const onToggleReversed = vi.fn()
    render(<GeometryTabs type="linear" onSelectType={onSelectType} onToggleReversed={onToggleReversed} />)
    fireEvent.click(screen.getByText('Radial'))
    expect(onSelectType).toHaveBeenCalledWith('radial')
    expect(onToggleReversed).not.toHaveBeenCalled()
  })

  it('calls onToggleReversed (not onSelectType) when tapping the already-active tab', () => {
    const onSelectType = vi.fn()
    const onToggleReversed = vi.fn()
    render(<GeometryTabs type="linear" onSelectType={onSelectType} onToggleReversed={onToggleReversed} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(onToggleReversed).toHaveBeenCalledTimes(1)
    expect(onSelectType).not.toHaveBeenCalled()
  })

  it('labels the square-type tab as "Turrell"', () => {
    render(<GeometryTabs type="square" onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByText('Turrell')).toBeInTheDocument()
    expect(screen.queryByText('Square')).not.toBeInTheDocument()
  })
})
