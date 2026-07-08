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
  it('starts in explore mode with no saved gradients', () => {
    const state = useAppStore.getState()
    expect(state.mode).toBe('explore')
    expect(state.saved).toEqual([])
  })

  it('sets the current gradient', () => {
    useAppStore.getState().setCurrentGradient(sampleGradient)
    expect(useAppStore.getState().current).toEqual(sampleGradient)
  })

  it('saves a gradient to the drawer', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    expect(useAppStore.getState().saved).toHaveLength(1)
    // Saved entries get a fresh id (see duplicate-key regression test below);
    // everything else is preserved verbatim.
    const { id: _id, ...savedRest } = useAppStore.getState().saved[0]
    const { id: _sampleId, ...sampleRest } = sampleGradient
    expect(savedRest).toEqual(sampleRest)
  })

  it('dedupes saving the same gradient signature twice', () => {
    useAppStore.getState().saveGradient(sampleGradient)
    useAppStore.getState().saveGradient({ ...sampleGradient, id: 'g1-dup' })
    expect(useAppStore.getState().saved).toHaveLength(1)
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

  it('switches back to explore mode', () => {
    useAppStore.getState().enterEditMode()
    useAppStore.getState().exitEditMode()
    expect(useAppStore.getState().mode).toBe('explore')
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
