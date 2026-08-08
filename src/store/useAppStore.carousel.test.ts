import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore, pickedCarouselGradients } from './useAppStore'
import type { Gradient } from './types'

function grad(id: string, name: string): Gradient {
  return {
    id,
    name,
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
  }
}

// See useAppStore.test.ts for why the "test" script sets
// NODE_OPTIONS=--no-experimental-webstorage.
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('carousel picks', () => {
  it('starts empty', () => {
    expect(useAppStore.getState().carouselPicks).toEqual([])
  })

  it('appends picks in the order they are made', () => {
    const { toggleCarouselPick } = useAppStore.getState()
    toggleCarouselPick('c')
    toggleCarouselPick('a')
    toggleCarouselPick('b')
    // Pick order is slide order — never sorted, never deduped into a set.
    expect(useAppStore.getState().carouselPicks).toEqual(['c', 'a', 'b'])
  })

  it('reports what the pick became', () => {
    const { toggleCarouselPick } = useAppStore.getState()
    expect(toggleCarouselPick('a')).toBe(true)
    expect(toggleCarouselPick('a')).toBe(false)
  })

  it('removes a picked id without disturbing the rest of the order', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b', 'c'] })
    useAppStore.getState().toggleCarouselPick('b')
    expect(useAppStore.getState().carouselPicks).toEqual(['a', 'c'])
  })

  it('re-picking sends it to the end rather than back to its old slot', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b', 'c'] })
    const { toggleCarouselPick } = useAppStore.getState()
    toggleCarouselPick('a')
    toggleCarouselPick('a')
    expect(useAppStore.getState().carouselPicks).toEqual(['b', 'c', 'a'])
  })

  it('moves a pick to another pick’s slot, shifting the rest', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b', 'c', 'd'] })
    useAppStore.getState().reorderCarouselPick('d', 'b')
    expect(useAppStore.getState().carouselPicks).toEqual(['a', 'd', 'b', 'c'])
  })

  it('ignores a reorder involving an id that is not picked', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b'] })
    useAppStore.getState().reorderCarouselPick('z', 'a')
    useAppStore.getState().reorderCarouselPick('a', 'a')
    expect(useAppStore.getState().carouselPicks).toEqual(['a', 'b'])
  })

  it('clears every pick', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b'] })
    useAppStore.getState().clearCarouselPicks()
    expect(useAppStore.getState().carouselPicks).toEqual([])
  })
})

describe('pickedCarouselGradients', () => {
  const a = grad('a', 'Alpha')
  const b = grad('b', 'Beta')

  it('resolves ids in pick order, not saved order', () => {
    expect(pickedCarouselGradients([a, b], ['b', 'a'])).toEqual([b, a])
  })

  it('drops ids that no longer resolve', () => {
    // A gradient can be deleted while it sits in the carousel; the right
    // answer is a shorter carousel, not a crash or a hole.
    expect(pickedCarouselGradients([a], ['a', 'gone'])).toEqual([a])
  })

  it('reflects a rename without the pick being redone', () => {
    const renamed = { ...a, name: 'Renamed' }
    expect(pickedCarouselGradients([renamed, b], ['a'])[0].name).toBe('Renamed')
  })

  it('is empty when nothing is picked', () => {
    expect(pickedCarouselGradients([a, b], [])).toEqual([])
  })
})

describe('moveCarouselPick', () => {
  it('nudges a pick one slot earlier', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b', 'c'] })
    useAppStore.getState().moveCarouselPick('c', -1)
    expect(useAppStore.getState().carouselPicks).toEqual(['a', 'c', 'b'])
  })

  it('nudges a pick one slot later', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b', 'c'] })
    useAppStore.getState().moveCarouselPick('a', 1)
    expect(useAppStore.getState().carouselPicks).toEqual(['b', 'a', 'c'])
  })

  it('is a no-op at either end', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b'] })
    useAppStore.getState().moveCarouselPick('a', -1)
    useAppStore.getState().moveCarouselPick('b', 1)
    expect(useAppStore.getState().carouselPicks).toEqual(['a', 'b'])
  })

  it('ignores an id that is not picked', () => {
    useAppStore.setState({ carouselPicks: ['a', 'b'] })
    useAppStore.getState().moveCarouselPick('z', 1)
    expect(useAppStore.getState().carouselPicks).toEqual(['a', 'b'])
  })
})

describe('bulk delete', () => {
  const a = grad('a', 'Alpha')
  const b = grad('b', 'Beta')
  const c = grad('c', 'Gamma')

  it('removes every named gradient in one event', () => {
    useAppStore.setState({ saved: [a, b, c] })
    useAppStore.getState().removeSavedGradientsByIds(['a', 'c'])
    expect(useAppStore.getState().saved).toEqual([b])
  })

  it('records the batch with original indices so undo restores the order', () => {
    useAppStore.setState({ saved: [a, b, c] })
    useAppStore.getState().removeSavedGradientsByIds(['a', 'c'])
    expect(useAppStore.getState().lastDeletedBatch).toEqual([
      { gradient: a, index: 0 },
      { gradient: c, index: 2 },
    ])
    useAppStore.getState().undoDelete()
    // Back in their original slots, not appended to the end.
    expect(useAppStore.getState().saved).toEqual([a, b, c])
  })

  it('drops the deleted ids from the carousel', () => {
    useAppStore.setState({ saved: [a, b, c], carouselPicks: ['c', 'a', 'b'] })
    useAppStore.getState().removeSavedGradientsByIds(['a', 'c'])
    // A deleted gradient must not keep holding a slide number.
    expect(useAppStore.getState().carouselPicks).toEqual(['b'])
  })

  it('drops a single deleted id from the carousel too', () => {
    useAppStore.setState({ saved: [a, b], carouselPicks: ['a', 'b'] })
    useAppStore.getState().removeSavedGradientById('a')
    expect(useAppStore.getState().carouselPicks).toEqual(['b'])
  })

  it('supersedes an armed single-delete undo', () => {
    useAppStore.setState({ saved: [a, b, c] })
    useAppStore.getState().removeSavedGradientById('b')
    useAppStore.getState().removeSavedGradientsByIds(['a'])
    // One undo stack: the batch is what undo now restores.
    expect(useAppStore.getState().lastDeleted).toBeNull()
    useAppStore.getState().undoDelete()
    expect(useAppStore.getState().saved.map((g) => g.id)).toEqual(['a', 'c'])
  })

  it('redoes a bulk deletion', () => {
    useAppStore.setState({ saved: [a, b, c] })
    useAppStore.getState().removeSavedGradientsByIds(['a', 'b'])
    useAppStore.getState().undoDelete()
    expect(useAppStore.getState().saved).toEqual([a, b, c])
    useAppStore.getState().redoDelete()
    expect(useAppStore.getState().saved).toEqual([c])
    // Redo consumed the undone batch; undo is available again, not redo twice.
    expect(useAppStore.getState().lastUndoneBatch).toBeNull()
  })

  it('is a no-op when no id matches', () => {
    useAppStore.setState({ saved: [a] })
    useAppStore.getState().removeSavedGradientsByIds(['nope'])
    expect(useAppStore.getState().saved).toEqual([a])
    expect(useAppStore.getState().lastDeletedBatch).toBeNull()
  })
})
