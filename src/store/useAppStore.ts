import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Gradient, ViewMode } from './types'
import { DEFAULT_COLOR_SET, type ColorSet } from '../lib/colorSets'
import { namePalette } from '../lib/naming'

function gradientSignature(gradient: Gradient): string {
  const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position)
  return `${gradient.type}:${sortedStops.map((s) => `${s.hex}@${s.position}`).join(',')}`
}

interface AppState {
  mode: ViewMode
  current: Gradient | null
  saved: Gradient[]
  activeColorSet: ColorSet
  noiseEnabled: boolean
  pendingImport: Gradient[] | null
  toggleNoise: () => void
  setCurrentGradient: (gradient: Gradient) => void
  saveGradient: (gradient: Gradient) => void
  isGradientSaved: (gradient: Gradient) => boolean
  removeSavedGradient: (gradient: Gradient) => void
  removeSavedGradientById: (id: string) => void
  duplicateSavedGradient: (id: string) => void
  renameSavedGradient: (id: string, name: string) => void
  renameCurrentGradient: (name: string) => void
  toggleSaveGradient: (gradient: Gradient) => void
  enterEditMode: () => void
  exitEditMode: () => void
  setMode: (mode: ViewMode) => void
  setActiveColorSet: (colorSet: ColorSet) => void
  setPendingImport: (gradients: Gradient[]) => void
  confirmImport: () => void
  dismissImport: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'create',
      current: null,
      saved: [],
      activeColorSet: DEFAULT_COLOR_SET,
      noiseEnabled: false,
      pendingImport: null,
      toggleNoise: () => set({ noiseEnabled: !get().noiseEnabled }),
      setCurrentGradient: (gradient) => set({ current: gradient }),
      saveGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        const alreadySaved = get().saved.some((g) => gradientSignature(g) === signature)
        if (alreadySaved) return
        const name = gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
        // Store a copy with a fresh id: edit-mode commits reuse the gradient
        // id across signature changes, so saving before and after an edit
        // would otherwise put two entries with the same id (= duplicate React
        // keys) into the drawer.
        set({ saved: [...get().saved, { ...gradient, id: crypto.randomUUID(), name }] })
      },
      isGradientSaved: (gradient) => {
        const signature = gradientSignature(gradient)
        return get().saved.some((g) => gradientSignature(g) === signature)
      },
      removeSavedGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        set({ saved: get().saved.filter((g) => gradientSignature(g) !== signature) })
      },
      // Id-based removal for the saved browser: duplicates share a signature,
      // so signature-based removal (the heart toggle's semantics) would wipe
      // every copy at once.
      removeSavedGradientById: (id) => {
        set({ saved: get().saved.filter((g) => g.id !== id) })
      },
      duplicateSavedGradient: (id) => {
        const saved = get().saved
        const index = saved.findIndex((g) => g.id === id)
        if (index === -1) return
        const original = saved[index]
        const copy = { ...original, id: crypto.randomUUID(), name: `${original.name ?? 'Untitled'} Copy` }
        set({ saved: [...saved.slice(0, index + 1), copy, ...saved.slice(index + 1)] })
      },
      renameSavedGradient: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set({ saved: get().saved.map((g) => (g.id === id ? { ...g, name: trimmed } : g)) })
      },
      renameCurrentGradient: (name) => {
        const current = get().current
        const trimmed = name.trim()
        if (!current || !trimmed) return
        // Saved copies get fresh ids (see saveGradient), so the matching
        // saved entry is found by signature, not id.
        const signature = gradientSignature(current)
        set({
          current: { ...current, name: trimmed },
          saved: get().saved.map((g) => (gradientSignature(g) === signature ? { ...g, name: trimmed } : g)),
        })
      },
      toggleSaveGradient: (gradient) => {
        if (get().isGradientSaved(gradient)) {
          get().removeSavedGradient(gradient)
        } else {
          get().saveGradient(gradient)
        }
      },
      enterEditMode: () => set({ mode: 'edit' }),
      // Edit is only reachable from create, so exiting always lands there.
      exitEditMode: () => set({ mode: 'create' }),
      setMode: (mode) => set({ mode }),
      setActiveColorSet: (colorSet) => set({ activeColorSet: colorSet }),
      setPendingImport: (gradients) => set({ pendingImport: gradients }),
      confirmImport: () => {
        const pending = get().pendingImport
        if (!pending) return
        pending.forEach((g) => get().saveGradient(g))
        set({ pendingImport: null })
      },
      dismissImport: () => set({ pendingImport: null }),
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({ saved: state.saved, noiseEnabled: state.noiseEnabled }),
    }
  )
)
