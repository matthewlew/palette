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
  renameSavedGradient: (id: string, name: string) => void
  toggleSaveGradient: (gradient: Gradient) => void
  enterEditMode: () => void
  exitEditMode: () => void
  setActiveColorSet: (colorSet: ColorSet) => void
  setPendingImport: (gradients: Gradient[]) => void
  confirmImport: () => void
  dismissImport: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'explore',
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
      renameSavedGradient: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set({ saved: get().saved.map((g) => (g.id === id ? { ...g, name: trimmed } : g)) })
      },
      toggleSaveGradient: (gradient) => {
        if (get().isGradientSaved(gradient)) {
          get().removeSavedGradient(gradient)
        } else {
          get().saveGradient(gradient)
        }
      },
      enterEditMode: () => set({ mode: 'edit' }),
      exitEditMode: () => set({ mode: 'explore' }),
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
