import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Gradient,
  ViewMode,
} from './types'
import { DEFAULT_COLOR_SET, type ColorSet } from '../lib/colorSets'
import type { ColorLocks, PositionLocks } from '../lib/palette'
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
  /** Colors pinned by the user, keyed by stop index. Every newly generated
   * gradient keeps these and builds the rest around them, so you can hold the
   * one color you liked and keep scrolling for the others.
   *
   * Keyed by INDEX rather than by stop id because the whole point is to
   * survive generation, and every generated gradient has brand-new ids. Not
   * persisted: a lock is a working state for the session you're in, and
   * reopening the app to a feed that silently refuses to change one color
   * would be indistinguishable from a bug. */
  lockedColors: ColorLocks
  toggleColorLock: (index: number, hex: string) => void
  /** Keeps a pinned color current when the user edits that stop by hand —
   * otherwise the lock would immediately overwrite the edit on the next roll. */
  syncColorLock: (index: number, hex: string) => void
  /** Drops the lock at `index` and shifts the ones above it down, so removing
   * a stop doesn't leave locks pointing at the wrong colors. */
  releaseColorLockAt: (index: number) => void
  clearColorLocks: () => void
  /** Stop POSITIONS pinned by the user, keyed the same way — index to a 0-100
   * percentage. The colour locks' counterpart: `lockedColors` holds what a
   * stop is, this holds where it sits.
   *
   * Two things read it. Generation, so a pinned stop lands on its percentage
   * in every new palette rather than on the even ladder. And re-spacing, so
   * Reset spacing and the automatic re-spread on add/delete route around the
   * pinned ones instead of dragging them back — which is the whole point: you
   * can nail one stop to 25% and still let the app arrange everything else. */
  lockedPositions: PositionLocks
  togglePositionLock: (index: number, position: number) => void
  /** Keeps a pinned position current when that stop is dragged, so the pin
   * follows the handle instead of yanking it back on the next roll. */
  syncPositionLock: (index: number, position: number) => void
  releasePositionLockAt: (index: number) => void
  clearPositionLocks: () => void
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
  /** Which surface edit mode was opened from — the Create feed or the Gallery.
   * Read for PRESENTATION only (the rolodex position counter means nothing for
   * a named palette opened from the Gallery). It is deliberately not where
   * exiting goes; see exitEditMode. */
  editEnteredFrom: Exclude<ViewMode, 'edit'>
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
      lockedColors: {},
      toggleColorLock: (index, hex) => {
        const next = { ...get().lockedColors }
        if (next[index] !== undefined) {
          delete next[index]
        } else {
          next[index] = hex
        }
        set({ lockedColors: next })
      },
      syncColorLock: (index, hex) => {
        const current = get().lockedColors
        if (current[index] === undefined) return
        set({ lockedColors: { ...current, [index]: hex } })
      },
      releaseColorLockAt: (index) => {
        const current = get().lockedColors
        const next: ColorLocks = {}
        for (const key of Object.keys(current)) {
          const at = Number(key)
          if (at === index) continue
          next[at > index ? at - 1 : at] = current[at]
        }
        set({ lockedColors: next })
      },
      clearColorLocks: () => set({ lockedColors: {} }),
      lockedPositions: {},
      togglePositionLock: (index, position) => {
        const next = { ...get().lockedPositions }
        if (next[index] !== undefined) {
          delete next[index]
        } else {
          next[index] = position
        }
        set({ lockedPositions: next })
      },
      syncPositionLock: (index, position) => {
        const current = get().lockedPositions
        if (current[index] === undefined) return
        set({ lockedPositions: { ...current, [index]: position } })
      },
      releasePositionLockAt: (index) => {
        const current = get().lockedPositions
        const next: PositionLocks = {}
        for (const key of Object.keys(current)) {
          const at = Number(key)
          if (at === index) continue
          next[at > index ? at - 1 : at] = current[at]
        }
        set({ lockedPositions: next })
      },
      clearPositionLocks: () => set({ lockedPositions: {} }),
      setCurrentGradient: (gradient) => set({ current: gradient }),
      saveGradient: (gradient) => {
        const signature = gradientSignature(gradient)
        const alreadySaved = get().saved.some((g) => gradientSignature(g) === signature)
        if (alreadySaved) return
        // Name against the board, not in a vacuum: two palettes that hash to
        // the same template would otherwise both land as e.g. "Faded Indigo
        // Nocturne", and a Gallery with repeats reads as a generator rather
        // than a collection.
        const name =
          gradient.name ??
          namePalette(gradient.stops.map((s) => s.hex), {
            taken: get()
              .saved.map((g) => g.name)
              .filter((n): n is string => !!n),
          })
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
      editEnteredFrom: 'create',
      enterEditMode: () => {
        const mode = get().mode
        set({ mode: 'edit', editEnteredFrom: mode === 'edit' ? get().editEnteredFrom : mode })
      },
      // Backing out of edit mode lands in the Gallery, wherever edit was opened
      // from.
      //
      // It used to return to the entry surface, which meant leaving an edit
      // begun in the Create feed dropped you onto the same full-screen gradient
      // minus the sheet. That does not read as going back — it reads as the
      // controls closing — and it left one chevron, in one corner, meaning two
      // different depths depending on invisible history: Create's own back
      // already goes to the Gallery. One control, one destination. The feed is
      // still a single tap away on the tab bar.
      exitEditMode: () => set({ mode: 'gallery' }),
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
