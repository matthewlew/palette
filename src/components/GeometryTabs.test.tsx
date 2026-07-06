import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GeometryTabs } from './GeometryTabs'

describe('GeometryTabs', () => {
  it('renders all 6 geometry tabs', () => {
    render(<GeometryTabs type="linear" onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    for (const label of ['Linear', 'Radial', 'Angular', 'Square', 'Mirror', 'Repeat']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
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
})
