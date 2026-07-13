import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Gradient,
  ViewMode,
  Collection,
  CollectionLevers,
  KeywordBinding,
  CuratedDrop,
} from './types'
import { NEUTRAL_LEVERS } from './types'
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
  /** The most recent explicit deletion, held so it can be undone. Not
   * persisted — undo is a same-session affordance. */
  lastDeleted: { gradient: Gradient; index: number } | null
  undoDelete: () => void
  /** The most recent undo, so redo can re-apply the deletion. */
  lastUndone: { gradient: Gradient; index: number } | null
  redoDelete: () => void
  duplicateSavedGradient: (id: string) => void
  renameSavedGradient: (id: string, name: string) => void
  renameCurrentGradient: (name: string) => void
  /** Moves the saved gradient `fromId` to occupy `toId`'s current position,
   * shifting the others. Persisted via the `saved` array. No-op if either id
   * is missing or the ids are equal. */
  reorderSaved: (fromId: string, toId: string) => void
  toggleSaveGradient: (gradient: Gradient) => void
  /** Where exiting edit mode returns to — the surface edit was entered
   * from (Create feed or Gallery). */
  editReturnMode: Exclude<ViewMode, 'edit'>
  enterEditMode: () => void
  exitEditMode: () => void
  setMode: (mode: ViewMode) => void
  setActiveColorSet: (colorSet: ColorSet) => void
  setPendingImport: (gradients: Gradient[]) => void
  confirmImport: () => void
  dismissImport: () => void
  galleryLayout: 'grid' | 'masonry'
  setGalleryLayout: (layout: 'grid' | 'masonry') => void
  collections: Collection[]
  activeCollectionId: string | null
  createCollection: (name?: string) => string
  renameCollection: (id: string, name: string) => void
  deleteCollection: (id: string) => void
  addToCollection: (collectionId: string, gradientId: string) => void
  removeFromCollection: (collectionId: string, gradientId: string) => void
  setActiveCollection: (id: string | null) => void
  setCollectionLevers: (id: string, levers: CollectionLevers) => void
  keywordBindings: KeywordBinding[]
  curatedDrops: CuratedDrop[]
  addKeywordBinding: (binding: Omit<KeywordBinding, 'id'>) => string
  updateKeywordBinding: (id: string, patch: Partial<Omit<KeywordBinding, 'id'>>) => void
  deleteKeywordBinding: (id: string) => void
  createCuratedDrop: (drop: Omit<CuratedDrop, 'id'>) => string
  updateCuratedDrop: (id: string, patch: Partial<Omit<CuratedDrop, 'id'>>) => void
  deleteCuratedDrop: (id: string) => void
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
        set({
          saved: [
            ...get().saved,
            { ...gradient, id: crypto.randomUUID(), name, createdAt: Date.now() },
          ],
        })
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
        const saved = get().saved
        const index = saved.findIndex((g) => g.id === id)
        if (index === -1) return
        set({
          saved: saved.filter((g) => g.id !== id),
          // A collection is a subset of `saved`, so a hard delete must prune
          // the id from every collection (undo restores the gradient but not
          // its old memberships — acceptable for Phase 1).
          collections: get().collections.map((c) =>
            c.gradientIds.includes(id)
              ? { ...c, gradientIds: c.gradientIds.filter((gid) => gid !== id) }
              : c
          ),
          lastDeleted: { gradient: saved[index], index },
          // A fresh deletion starts a new undo chain.
          lastUndone: null,
        })
      },
      lastDeleted: null,
      undoDelete: () => {
        const deleted = get().lastDeleted
        if (!deleted) return
        const saved = get().saved
        // Restore at the original spot (clamped in case the board shrank).
        const at = Math.min(deleted.index, saved.length)
        set({
          saved: [...saved.slice(0, at), deleted.gradient, ...saved.slice(at)],
          lastDeleted: null,
          lastUndone: deleted,
        })
      },
      lastUndone: null,
      redoDelete: () => {
        const undone = get().lastUndone
        if (!undone) return
        // Re-applies the deletion; removeSavedGradientById re-arms undo.
        get().removeSavedGradientById(undone.gradient.id)
      },
      duplicateSavedGradient: (id) => {
        const saved = get().saved
        const index = saved.findIndex((g) => g.id === id)
        if (index === -1) return
        const original = saved[index]
        const copy = {
          ...original,
          id: crypto.randomUUID(),
          name: `${original.name ?? 'Untitled'} Copy`,
          createdAt: Date.now(),
        }
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
      reorderSaved: (fromId, toId) => {
        if (fromId === toId) return
        const saved = get().saved
        const fromIndex = saved.findIndex((g) => g.id === fromId)
        const toIndex = saved.findIndex((g) => g.id === toId)
        if (fromIndex === -1 || toIndex === -1) return
        const next = saved.slice()
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        set({ saved: next })
      },
      toggleSaveGradient: (gradient) => {
        if (get().isGradientSaved(gradient)) {
          get().removeSavedGradient(gradient)
        } else {
          get().saveGradient(gradient)
        }
      },
      editReturnMode: 'create',
      enterEditMode: () => {
        const mode = get().mode
        set({ mode: 'edit', editReturnMode: mode === 'edit' ? get().editReturnMode : mode })
      },
      // Exit returns to the surface edit was entered from — riffing from the
      // Gallery goes back to the Gallery, editing from the feed back to Create.
      exitEditMode: () => set({ mode: get().editReturnMode }),
      setMode: (mode) => {
        if (mode === 'edit') {
          get().enterEditMode()
          return
        }
        set({ mode })
      },
      setActiveColorSet: (colorSet) => set({ activeColorSet: colorSet }),
      setPendingImport: (gradients) => set({ pendingImport: gradients }),
      confirmImport: () => {
        const pending = get().pendingImport
        if (!pending) return
        pending.forEach((g) => get().saveGradient(g))
        set({ pendingImport: null })
      },
      dismissImport: () => set({ pendingImport: null }),
      galleryLayout: 'masonry',
      setGalleryLayout: (layout) => set({ galleryLayout: layout }),
      collections: [],
      activeCollectionId: null,
      createCollection: (name) => {
        const id = crypto.randomUUID()
        const collection: Collection = {
          id,
          name: name?.trim() || 'New Collection',
          createdAt: Date.now(),
          gradientIds: [],
          levers: { ...NEUTRAL_LEVERS },
        }
        set({ collections: [...get().collections, collection] })
        return id
      },
      renameCollection: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set({
          collections: get().collections.map((c) =>
            c.id === id ? { ...c, name: trimmed } : c
          ),
        })
      },
      deleteCollection: (id) => {
        set({
          collections: get().collections.filter((c) => c.id !== id),
          activeCollectionId:
            get().activeCollectionId === id ? null : get().activeCollectionId,
        })
      },
      addToCollection: (collectionId, gradientId) => {
        set({
          collections: get().collections.map((c) =>
            c.id === collectionId && !c.gradientIds.includes(gradientId)
              ? { ...c, gradientIds: [...c.gradientIds, gradientId] }
              : c
          ),
        })
      },
      removeFromCollection: (collectionId, gradientId) => {
        set({
          collections: get().collections.map((c) =>
            c.id === collectionId
              ? { ...c, gradientIds: c.gradientIds.filter((gid) => gid !== gradientId) }
              : c
          ),
        })
      },
      setActiveCollection: (id) => set({ activeCollectionId: id }),
      setCollectionLevers: (id, levers) => {
        set({
          collections: get().collections.map((c) =>
            c.id === id ? { ...c, levers } : c
          ),
        })
      },
      keywordBindings: [],
      curatedDrops: [],
      addKeywordBinding: (binding) => {
        const id = crypto.randomUUID()
        set({ keywordBindings: [...get().keywordBindings, { id, ...binding }] })
        return id
      },
      updateKeywordBinding: (id, patch) => {
        set({ keywordBindings: get().keywordBindings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
      },
      deleteKeywordBinding: (id) => {
        set({ keywordBindings: get().keywordBindings.filter((b) => b.id !== id) })
      },
      createCuratedDrop: (drop) => {
        const id = crypto.randomUUID()
        set({ curatedDrops: [...get().curatedDrops, { id, ...drop }] })
        return id
      },
      updateCuratedDrop: (id, patch) => {
        set({ curatedDrops: get().curatedDrops.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
      },
      deleteCuratedDrop: (id) => {
        set({ curatedDrops: get().curatedDrops.filter((d) => d.id !== id) })
      },
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({
        saved: state.saved,
        noiseEnabled: state.noiseEnabled,
        galleryLayout: state.galleryLayout,
        collections: state.collections,
        activeCollectionId: state.activeCollectionId,
        keywordBindings: state.keywordBindings,
        curatedDrops: state.curatedDrops,
      }),
      // v1 drops the removed smoothEnabled/flutedEnabled flags from boards
      // persisted before those filters were deleted, so stale keys don't
      // live in localStorage forever.
      // v2 makes masonry the default gallery layout (a one-time reset for
      // boards persisted while 'grid' was the default).
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as {
          saved?: Gradient[]
          noiseEnabled?: boolean
          galleryLayout?: 'grid' | 'masonry'
          collections?: Collection[]
          activeCollectionId?: string | null
          keywordBindings?: KeywordBinding[]
          curatedDrops?: CuratedDrop[]
        }
        if (Array.isArray(state.saved)) {
          state.saved = state.saved.map((g) => {
            const { smoothEnabled: _s, flutedEnabled: _f, ...rest } = g as Gradient & {
              smoothEnabled?: boolean
              flutedEnabled?: boolean
            }
            return rest
          })
        }
        if (!state.galleryLayout || version < 2) {
          state.galleryLayout = 'masonry'
        }
        // v3: collections are new — default them for older persisted state.
        if (!Array.isArray(state.collections)) state.collections = []
        if (state.activeCollectionId === undefined) state.activeCollectionId = null
        // v4: keyword vocabulary + curated drops are new.
        if (!Array.isArray(state.keywordBindings)) state.keywordBindings = []
        if (!Array.isArray(state.curatedDrops)) state.curatedDrops = []
        return state
      },
    }
  )
)
