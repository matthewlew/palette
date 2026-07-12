import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SaveDestination } from './SaveDestination'
import type { Collection } from '../store/types'

const col = (id: string, name: string): Collection => ({
  id,
  name,
  createdAt: 0,
  gradientIds: [],
  levers: { temp: 50, depth: 50, char: 50 },
})

describe('SaveDestination', () => {
  it('labels the chip "Gallery" when no collection is active', () => {
    render(<SaveDestination collections={[]} activeId={null} onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByTestId('save-destination')).toHaveTextContent('Gallery')
  })

  it('labels the chip with the active collection name', () => {
    render(
      <SaveDestination collections={[col('c1', 'Kiln')]} activeId="c1" onSelect={vi.fn()} onCreate={vi.fn()} />
    )
    expect(screen.getByTestId('save-destination')).toHaveTextContent('Kiln')
  })

  it('selects a collection from the menu', () => {
    const onSelect = vi.fn()
    render(
      <SaveDestination collections={[col('c1', 'Kiln')]} activeId={null} onSelect={onSelect} onCreate={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('save-destination'))
    fireEvent.click(screen.getByTestId('save-destination-option-c1'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('selects Gallery-only (null) from the menu', () => {
    const onSelect = vi.fn()
    render(
      <SaveDestination collections={[col('c1', 'Kiln')]} activeId="c1" onSelect={onSelect} onCreate={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('save-destination'))
    fireEvent.click(screen.getByTestId('save-destination-gallery'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
