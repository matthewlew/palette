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
        onCreateFromDrop={vi.fn()}
      />
    )
    expect(screen.getByText('Kiln')).toBeInTheDocument()
    expect(screen.getByTestId('collection-count-c1')).toHaveTextContent('2')
  })

  it('renders a 2x2 mosaic cover (4 cells) snapshotting the board', () => {
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', ['g1', 'g2'])]}
        gradientsById={{ g1: grad('g1'), g2: grad('g2') }}
        onOpen={vi.fn()}
        onCreateFromDrop={vi.fn()}
      />
    )
    // Always 4 cells; the two members fill two, the rest are empty slots.
    expect(screen.getByTestId('collection-cover-grid-c1').children).toHaveLength(4)
  })

  it('calls onOpen with the id when a cover is clicked', () => {
    const onOpen = vi.fn()
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', ['g1'])]}
        gradientsById={{ g1: grad('g1') }}
        onOpen={onOpen}
        onCreateFromDrop={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('collection-cover-c1'))
    expect(onOpen).toHaveBeenCalledWith('c1')
  })

  it('seeds a new board with the dropped gradient (content-first, no empty shell)', () => {
    const onCreateFromDrop = vi.fn()
    render(
      <CollectionsRow
        collections={[]}
        gradientsById={{}}
        onOpen={vi.fn()}
        onCreateFromDrop={onCreateFromDrop}
      />
    )
    const dataTransfer = { getData: () => 'g-seed' }
    fireEvent.drop(screen.getByTestId('collection-new-drop'), { dataTransfer })
    expect(onCreateFromDrop).toHaveBeenCalledWith('g-seed')
  })

  it('calls onDropGradient when a gradient id is dropped on a cover', () => {
    const onDropGradient = vi.fn()
    render(
      <CollectionsRow
        collections={[col('c1', 'Kiln', [])]}
        gradientsById={{}}
        onOpen={vi.fn()}
        onCreateFromDrop={vi.fn()}
        onDropGradient={onDropGradient}
      />
    )
    const cover = screen.getByTestId('collection-cover-c1')
    const dataTransfer = { getData: () => 'g-xyz' }
    fireEvent.drop(cover, { dataTransfer })
    expect(onDropGradient).toHaveBeenCalledWith('c1', 'g-xyz')
  })
})
