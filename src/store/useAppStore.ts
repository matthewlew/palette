import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Gradient, ViewMode } from './types'

function gradientSignature(gradient: Gradient): string {
  return `${gradient.type}:${gradient.stops.map((s) => `${s.hex}@${s.position}`).join(',')}`
}

interface AppState {
  mode: ViewMode
  current: Gradient | null
  saved: Gradient[]
  setCurrentGradient: (gradient: Gradient) => void
  saveGradient: (gradient: Gradient) => void
  enterEditMode: () => void
  exitEditMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'explore',
      current: null,
      saved: [],
      setCurrentGradient: (gradient) => set({ current: gradient }),
      saveGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        const alreadySaved = get().saved.some((g) => gradientSignature(g) === signature)
        if (alreadySaved) return
        set({ saved: [...get().saved, gradient] })
      },
      enterEditMode: () => set({ mode: 'edit' }),
      exitEditMode: () => set({ mode: 'explore' }),
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({ saved: state.saved }),
    }
  )
)
