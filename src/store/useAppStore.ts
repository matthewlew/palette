import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Gradient,
  ViewMode,
} from './types'
import { DEFAULT_COLOR_SET, type ColorSet } from '../lib/colorSets'
import { namePalette } from '../lib/naming'

/** 'grid' is the uniform 4:5 grid, 'masonry' the Pinterest-style ragged one,
 * 'dense' the captionless square pack — three across on a phone, for scanning
 * a lot of gradients rather than reading a few. */
export type GalleryLayout = 'grid' | 'masonry' | 'dense'

function gradientSignature(gradient: Gradient): string {
  const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position)
  const stopsSig = sortedStops.map((s) => `${s.hex}@${s.position}`).join(',')
  const mods = [
    gradient.reversed ? 'rev' : '',
    gradient.repeatEnabled ? 'rep' : '',
    gradient.hardStops ? 'hard' : '',
    gradient.angle ? `ang${gradient.angle}` : '',
    gradient.fanAnchor ? `fan${gradient.fanAnchor}` : ''
  ].filter(Boolean).join('-')
  return `${gradient.type}:${stopsSig}${mods ? `:${mods}` : ''}`
}

interface AppState {
  mode: ViewMode
  current: Gradient | null
  saved: Gradient[]
  activeColorSet: ColorSet
  noiseEnabled: boolean
  toggleNoise: () => void
  /** Ambient drift of the stop positions. Colors never change — see
   * lib/stopDrift.ts. Not persisted: motion is a per-session mood, and a
   * gradient that starts moving on load is a surprise, not a feature. */
  motionEnabled: boolean
  toggleMotion: () => void
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
  /** Ids of the gradients added by the most recent import (paste, share link,
   * or JSON textarea). Not persisted — undo is a same-session affordance. */
  lastImported: { ids: string[] } | null
  importGradients: (gradients: Gradient[]) => void
  undoImport: () => void
  /** The gradient the Gallery viewer is currently showing, or null. Lets the
   * app-level copy handler copy the open gradient instead of `current`. */
  viewerGradient: Gradient | null
  setViewerGradient: (gradient: Gradient | null) => void
  duplicateSavedGradient: (id: string) => void
  renameSavedGradient: (id: string, name: string) => void
  renameCurrentGradient: (name: string) => void
  rotateCurrentGradient: (degrees: number) => void
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
  galleryLayout: GalleryLayout
  setGalleryLayout: (layout: GalleryLayout) => void
  /** Ids of community palettes this browser has liked. Persisted because that
   * is the whole account model: the server attributes a like to an anonymous
   * client id (see lib/clientId.ts) and this is the local mirror, so hearts
   * survive a reload without anyone signing in. */
  likedPaletteIds: string[]
  /** Flips the local like state and returns what it became, so the caller can
   * drive the optimistic count and the network write off one source of truth. */
  toggleLikedPalette: (id: string) => boolean
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mode: 'create',
      current: null,
      saved: [],
      activeColorSet: DEFAULT_COLOR_SET,
      noiseEnabled: false,
      toggleNoise: () => set({ noiseEnabled: !get().noiseEnabled }),
      motionEnabled: false,
      toggleMotion: () => set({ motionEnabled: !get().motionEnabled }),
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
      lastImported: null,
      importGradients: (gradients) => {
        const before = new Set(get().saved.map((g) => g.id))
        gradients.forEach((g) => get().saveGradient(g))
        // saveGradient assigns a fresh id to every stored copy, so diff the
        // saved list to learn which ids actually landed (dedupe drops some).
        const added = get()
          .saved.filter((g) => !before.has(g.id))
          .map((g) => g.id)
        set({ lastImported: added.length > 0 ? { ids: added } : { ids: [] } })
      },
      undoImport: () => {
        const last = get().lastImported
        if (!last) return
        const ids = new Set(last.ids)
        set({ saved: get().saved.filter((g) => !ids.has(g.id)), lastImported: null })
      },
      viewerGradient: null,
      setViewerGradient: (gradient) => set({ viewerGradient: gradient }),
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
      rotateCurrentGradient: (degrees) => {
        const current = get().current
        if (!current) return
        const newAngle = ((current.angle ?? 0) + degrees) % 360
        set({ current: { ...current, angle: newAngle } })
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
      galleryLayout: 'masonry',
      setGalleryLayout: (layout) => set({ galleryLayout: layout }),
      likedPaletteIds: [],
      toggleLikedPalette: (id) => {
        const liked = get().likedPaletteIds
        const wasLiked = liked.includes(id)
        set({ likedPaletteIds: wasLiked ? liked.filter((x) => x !== id) : [...liked, id] })
        return !wasLiked
      },
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({
        saved: state.saved,
        noiseEnabled: state.noiseEnabled,
        galleryLayout: state.galleryLayout,
        likedPaletteIds: state.likedPaletteIds,
      }),
      // v1 drops the removed flutedEnabled flag from boards persisted before
      // that filter was deleted, so stale keys don't live in localStorage
      // forever. (smoothEnabled was likewise removed here once, but the Smooth
      // filter is supported again, so it's preserved.)
      // v2 makes masonry the default gallery layout (a one-time reset for
      // boards persisted while 'grid' was the default).
      // v5 removes the Daily Drops state (keywordBindings/curatedDrops) after
      // that feature was dropped, so its keys don't linger in localStorage.
      // v6 backfills missing ids and names for legacy saved gradients
      // (some predate the database schema or the naming engine).
      // v7 removes boards/collections after that feature was deleted.
      version: 7,
      migrate: (persisted, version) => {
        const state = persisted as {
          saved?: Gradient[]
          noiseEnabled?: boolean
          galleryLayout?: GalleryLayout
          likedPaletteIds?: string[]
        }
        if (Array.isArray(state.saved)) {
          state.saved = state.saved.map((g) => {
            const { flutedEnabled: _f, ...rest } = g as Gradient & {
              flutedEnabled?: boolean
            }
            // Backfill missing identifiers and names for legacy saved gradients.
            if (!rest.id) {
              rest.id = crypto.randomUUID()
            }
            if (!rest.name) {
              try {
                rest.name = namePalette(rest.stops.map(s => s.hex))
              } catch {
                rest.name = 'Untitled Palette'
              }
            }
            return rest
          })
        }
        if (!state.galleryLayout || version < 2) {
          state.galleryLayout = 'masonry'
        }
        // v5: the Daily Drops feature was removed — drop its persisted keys.
        const legacy = state as Record<string, unknown>
        delete legacy.keywordBindings
        delete legacy.curatedDrops
        // v7: boards/collections were removed — drop their persisted keys so
        // they don't sit in localStorage forever. Saved gradients are NOT
        // touched: a collection was only ever a list of ids into `saved`.
        delete legacy.collections
        delete legacy.activeCollectionId
        // Boards persisted before likes existed have no such key; an absent one
        // must not reach the store as undefined, where every `.includes` on it
        // would throw.
        if (!Array.isArray(state.likedPaletteIds)) {
          state.likedPaletteIds = []
        }
        return state
      },
    }
  )
)
