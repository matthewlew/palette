import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GeometryTabs } from './GeometryTabs'

describe('GeometryTabs', () => {
const dummyStops = [{ id: '1', loc: 0, color: '#ffffff', hex: '#ffffff', position: 0 }, { id: '2', loc: 100, color: '#000000', hex: '#000000', position: 100 }]
const dummyGradient = (type: any) => ({ id: 'g1', type, stops: dummyStops, reversed: false, hardStops: false, repeatEnabled: false, fanAnchor: 'bottom' as any })

  it('renders all 5 geometry tabs', () => {
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    for (const label of ['Linear', 'Radial', 'Angular', 'Turrell', 'Mirror']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders Repeat x2 and Hard filter chips instead of a Repeat tab', () => {
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.queryByText('Repeat')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-repeat')).toBeInTheDocument()
    expect(screen.getByTestId('filter-hard')).toBeInTheDocument()
  })

  it('toggles the repeat and hard filters independently of geometry type', () => {
    const onToggleRepeat = vi.fn()
    const onToggleHardStops = vi.fn()
    render(
      <GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops}
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

  it('keeps Repeat and Hard available on square (Turrell reads Hard as crisp, Repeat works normally)', () => {
    render(<GeometryTabs gradient={dummyGradient('square')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByTestId('filter-repeat')).not.toBeDisabled()
    expect(screen.getByTestId('filter-hard')).not.toBeDisabled()
  })

  it('disables both filter chips for mirror (it authors its own sequence)', () => {
    render(<GeometryTabs gradient={dummyGradient('mirror')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByTestId('filter-repeat')).toBeDisabled()
    expect(screen.getByTestId('filter-hard')).toBeDisabled()
  })

  it('calls onSelectType when tapping a different, inactive tab', () => {
    const onSelectType = vi.fn()
    const onToggleReversed = vi.fn()
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={onSelectType} onToggleReversed={onToggleReversed} />)
    fireEvent.click(screen.getByText('Radial'))
    expect(onSelectType).toHaveBeenCalledWith('radial')
    expect(onToggleReversed).not.toHaveBeenCalled()
  })

  it('calls onToggleReversed (not onSelectType) when tapping the already-active tab', () => {
    const onSelectType = vi.fn()
    const onToggleReversed = vi.fn()
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={onSelectType} onToggleReversed={onToggleReversed} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(onToggleReversed).toHaveBeenCalledTimes(1)
    expect(onSelectType).not.toHaveBeenCalled()
  })

  it('renders a Smooth chip and calls onToggleSmooth when clicked', () => {
    const onToggleSmooth = vi.fn()
    render(
      <GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops}
        onSelectType={vi.fn()}
        onToggleReversed={vi.fn()}
        onToggleSmooth={onToggleSmooth}
      />
    )
    const chip = screen.getByTestId('filter-smooth')
    fireEvent.click(chip)
    expect(onToggleSmooth).toHaveBeenCalledTimes(1)
  })

  it('labels the square-type tab as "Turrell"', () => {
    render(<GeometryTabs gradient={dummyGradient('square')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByText('Turrell')).toBeInTheDocument()
    expect(screen.queryByText('Square')).not.toBeInTheDocument()
  })
})
