import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { Gradient } from './types'
import { DEFAULT_COLOR_SET } from '../lib/colorSets'
import type { ColorSet } from '../lib/colorSets'

const sampleGradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}

// Requires the "test" script's NODE_OPTIONS=--no-experimental-webstorage flag
// (package.json) — Node 25's native localStorage global otherwise shadows
// jsdom's, and localStorage.clear() below throws.
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(useAppStore.getInitialState())
})

describe('useAppStore', () => {
  it('starts in create mode with no saved gradients', () => {
    const state = useAppStore.getState()
    expect(state.mode).toBe('create')
    expect(state.saved).toEqual([])
  })

  it('sets the current gradient', () => {
    useAppStore.getState().setCurrentGradient(sampleGradient)
    expect(useAppStore.getState().current).toEqual(sampleGradient)
  })

  it('saves a gradient to the drawer', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    expect(useAppStore.getState().saved).toHaveLength(1)
    // Saved entries get a fresh id (see duplicate-key regression test below)
    // and a generated name (see naming tests below); everything else is
    // preserved verbatim.
    const { id: _id, name: _name, createdAt: _createdAt, ...savedRest } = useAppStore.getState().saved[0]
    const { id: _sampleId, ...sampleRest } = sampleGradient
    expect(savedRest).toEqual(sampleRest)
  })

  it('dedupes saving the same gradient signature twice', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().saveGradient({ ...sampleGradient, id: 'g1-dup' })
    expect(useAppStore.getState().saved).toHaveLength(1)
  })

  it('assigns a deterministic name when saving a gradient without one', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    const saved = useAppStore.getState().saved[0]
    expect(saved.name).toBeTruthy()
    expect(typeof saved.name).toBe('string')
  })

  it('preserves an existing name instead of regenerating it', () => {
    useAppStore.getState().saveGradient({ ...sampleGradient, name: 'Custom Name' })
    expect(useAppStore.getState().saved[0].name).toBe('Custom Name')
  })

  it('dedupes gradients whose stops are the same but in a different order', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().saveGradient({
      ...sampleGradient,
      id: 'g1-reordered',
      stops: [...sampleGradient.stops].reverse(),
    })
    expect(useAppStore.getState().saved).toHaveLength(1)
  })

  it('persists saved gradients to localStorage', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    const raw = localStorage.getItem('palette-saved-gradients')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).state.saved).toHaveLength(1)
  })

  it('switches to edit mode', () => {
    useAppStore.getState().enterEditMode()
    expect(useAppStore.getState().mode).toBe('edit')
  })

  it('switches back to create mode', () => {
    useAppStore.getState().enterEditMode()
    useAppStore.getState().exitEditMode()
    expect(useAppStore.getState().mode).toBe('create')
  })

  it('returns to the gallery when edit was entered from the gallery', () => {
    useAppStore.getState().setMode('gallery')
    useAppStore.getState().setMode('edit')
    expect(useAppStore.getState().mode).toBe('edit')
    useAppStore.getState().exitEditMode()
    expect(useAppStore.getState().mode).toBe('gallery')
  })

  it('keeps the original return surface when edit mode is re-entered', () => {
    useAppStore.getState().setMode('gallery')
    useAppStore.getState().enterEditMode()
    useAppStore.getState().enterEditMode()
    useAppStore.getState().exitEditMode()
    expect(useAppStore.getState().mode).toBe('gallery')
  })

  it('isGradientSaved reflects whether a gradient (by signature) is in saved', () => {
    expect(useAppStore.getState().isGradientSaved(sampleGradient)).toBe(false)
    useAppStore.getState().saveGradient(sampleGradient)
    expect(useAppStore.getState().isGradientSaved(sampleGradient)).toBe(true)
  })

  it('toggleSaveGradient saves an unsaved gradient', () => {
    useAppStore.getState().toggleSaveGradient(sampleGradient)
    expect(useAppStore.getState().saved).toHaveLength(1)
    expect(useAppStore.getState().isGradientSaved(sampleGradient)).toBe(true)
  })

  it('toggleSaveGradient removes an already-saved gradient (matched by signature, ignoring id)', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().toggleSaveGradient({ ...sampleGradient, id: 'different-id' })
    expect(useAppStore.getState().saved).toHaveLength(0)
  })

  it('removeSavedGradientById records the deletion and undoDelete restores it in place', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().saveGradient({ ...sampleGradient, stops: [
      { hex: '#00ff00', position: 0 },
      { hex: '#0000ff', position: 100 },
    ] })
    const [first, second] = useAppStore.getState().saved

    useAppStore.getState().removeSavedGradientById(first.id)
    expect(useAppStore.getState().saved).toEqual([second])
    expect(useAppStore.getState().lastDeleted).toEqual({ gradient: first, index: 0 })

    useAppStore.getState().undoDelete()
    expect(useAppStore.getState().saved).toEqual([first, second])
    expect(useAppStore.getState().lastDeleted).toBeNull()
  })

  it('redoDelete re-applies an undone deletion; a fresh delete clears the redo chain', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    const [only] = useAppStore.getState().saved

    useAppStore.getState().removeSavedGradientById(only.id)
    useAppStore.getState().undoDelete()
    expect(useAppStore.getState().saved).toEqual([only])

    useAppStore.getState().redoDelete()
    expect(useAppStore.getState().saved).toEqual([])
    expect(useAppStore.getState().lastUndone).toBeNull()
    // …and the redo-applied deletion is itself undoable again.
    expect(useAppStore.getState().lastDeleted).toEqual({ gradient: only, index: 0 })
  })

  it('undoDelete is a no-op with nothing deleted', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().undoDelete()
    expect(useAppStore.getState().saved).toHaveLength(1)
  })
})

describe('useAppStore activeColorSet', () => {
  it('defaults to DEFAULT_COLOR_SET', () => {
    expect(useAppStore.getState().activeColorSet).toBe(DEFAULT_COLOR_SET)
  })

  it('setActiveColorSet replaces the active set', () => {
    const custom: ColorSet = { name: 'custom', colors: [{ name: 'Foo', value: { l: 0.5, c: 0.1, h: 10 } }] }
    useAppStore.getState().setActiveColorSet(custom)
    expect(useAppStore.getState().activeColorSet).toBe(custom)
  })

  it('assigns saved gradients a fresh id so edit-then-save-again cannot duplicate keys', () => {
    const gradient = {
      id: 'shared-id',
      type: 'linear' as const,
      stops: [
        { hex: '#ff0000', position: 0 },
        { hex: '#0000ff', position: 100 },
      ],
    }
    useAppStore.getState().saveGradient(gradient)
    const edited = { ...gradient, stops: [{ hex: '#00ff00', position: 0 }, { hex: '#0000ff', position: 100 }] }
    useAppStore.getState().saveGradient(edited)

    const ids = useAppStore.getState().saved.map((g) => g.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('persist migration', () => {
  it('drops the removed smoothEnabled/flutedEnabled flags from v0 boards', async () => {
    localStorage.setItem(
      'palette-saved-gradients',
      JSON.stringify({
        state: {
          saved: [{ ...sampleGradient, smoothEnabled: true, flutedEnabled: true }],
          noiseEnabled: false,
        },
        version: 0,
      })
    )
    await useAppStore.persist.rehydrate()
    const saved = useAppStore.getState().saved
    expect(saved).toHaveLength(1)
    expect('smoothEnabled' in saved[0]).toBe(false)
    expect('flutedEnabled' in saved[0]).toBe(false)
  })
})

function grad(id: string, name: string): Gradient {
  return {
    id,
    type: 'linear',
    name,
    stops: [
      { hex: '#111111', position: 0 },
      { hex: '#eeeeee', position: 100 },
    ],
  }
}

describe('useAppStore import + undo', () => {
  beforeEach(() => {
    useAppStore.setState({ saved: [], lastImported: null })
  })

  it('importGradients adds gradients and records their new ids', () => {
    // Distinct signatures so both survive saveGradient's dedupe (grad() alone
    // keys only on stops/type, which are identical across ids).
    const two = { ...grad('b', 'Two'), stops: [
      { hex: '#222222', position: 0 },
      { hex: '#dddddd', position: 100 },
    ] }
    useAppStore.getState().importGradients([grad('a', 'One'), two])
    const { saved, lastImported } = useAppStore.getState()
    expect(saved).toHaveLength(2)
    expect(lastImported?.ids).toHaveLength(2)
    expect(saved.map((g) => g.id).sort()).toEqual([...lastImported!.ids].sort())
  })

  it('undoImport removes exactly the gradients just imported', () => {
    useAppStore.setState({ saved: [grad('keep', 'Keep')] })
    // Distinct signature so it isn't deduped against the seeded 'Keep'.
    const fresh = { ...grad('x', 'New'), stops: [
      { hex: '#333333', position: 0 },
      { hex: '#cccccc', position: 100 },
    ] }
    useAppStore.getState().importGradients([fresh])
    expect(useAppStore.getState().saved).toHaveLength(2)
    useAppStore.getState().undoImport()
    const { saved, lastImported } = useAppStore.getState()
    expect(saved.map((g) => g.name)).toEqual(['Keep'])
    expect(lastImported).toBeNull()
  })

  it('records only ids that were actually added (dedupe by signature)', () => {
    useAppStore.getState().importGradients([grad('dup', 'Dup')])
    useAppStore.getState().importGradients([grad('dup2', 'Dup Again')])
    const { saved, lastImported } = useAppStore.getState()
    expect(saved).toHaveLength(1)
    expect(lastImported?.ids ?? []).toHaveLength(0)
  })
})
