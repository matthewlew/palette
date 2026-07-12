import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CollectionsRow } from './CollectionsRow'
import type { Collection, Gradient } from '../store/types'

const grad = (id: string): Gradient => ({
  id,
  type: 'linear',
  stops: [
    { hex: '#b5643c', position: 0 },
    { hex: '#3a5a78', position: 100 },
  ],
})
const col = (id: string, name: string, ids: string[]): Collection => ({
  id,
  name,
  createdAt: 0,
  gradientIds: ids,
  levers: { temp: 50, depth: 50, char: 50 },
})

describe('CollectionsRow', () => {
  it('renders a cover per collection with its member count and name', () => {
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', ['g1', 'g2'])]}
        gradientsById={{ g1: grad('g1'), g2: grad('g2') }}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
      />
    )
    expect(screen.getByText('Kiln')).toBeInTheDocument()
    expect(screen.getByTestId('collection-count-c1')).toHaveTextContent('2')
  })

  it('calls onOpen with the id when a cover is clicked', () => {
    const onOpen = vi.fn()
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', ['g1'])]}
        gradientsById={{ g1: grad('g1') }}
        onOpen={onOpen}
        onCreate={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('collection-cover-c1'))
    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('calls onCreate when the New tile is clicked', () => {
    const onCreate = vi.fn()
    render(
      <CollectionsRow collections={[]} gradientsById={{}} onOpen={vi.fn()} onCreate={onCreate} />
    )
    fireEvent.click(screen.getByTestId('collection-new'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('calls onDropGradient when a gradient id is dropped on a cover', () => {
    const onDropGradient = vi.fn()
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', [])]}
        gradientsById={{}}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
        onDropGradient={onDropGradient}
      />
    )
    const cover = screen.getByTestId('collection-cover-c1')
    const dataTransfer = { getData: () => 'g-xyz' }
    fireEvent.drop(cover, { dataTransfer })
    expect(onDropGradient).toHaveBeenCalledWith('c1', 'g-xyz')
  })
})
