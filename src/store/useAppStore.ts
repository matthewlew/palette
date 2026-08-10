import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Gradient,
  ViewMode,
} from './types'
import { DEFAULT_COLOR_SET, type ColorSet } from '../lib/colorSets'
import type { ColorLocks, PositionLocks } from '../lib/palette'
import type { CoverageLocks, DrumPositionLocks, Coverage } from '../lib/riso'
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

/**
 * Resolves carousel pick ids to live saved gradients, in pick order.
 *
 * Ids that no longer resolve are dropped rather than treated as an error: a
 * gradient can be deleted while it sits in the carousel, and the right
 * behaviour is a carousel one shorter, not a broken export. Deriving this on
 * read is also why a rename shows up in the carousel immediately.
 */
export function pickedCarouselGradients(saved: Gradient[], picks: string[]): Gradient[] {
  const byId = new Map(saved.map((g) => [g.id, g]))
  return picks.map((id) => byId.get(id)).filter((g): g is Gradient => !!g)
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
  /** Drum's coverage-space counterpart to lockedColors — same index-keyed
   * shape, holding a Coverage vector instead of a hex string. Not persisted,
   * for the same reason lockedColors isn't. */
  lockedCoverage: CoverageLocks
  toggleCoverageLock: (index: number, coverage: Coverage) => void
  syncCoverageLock: (index: number, coverage: Coverage) => void
  releaseCoverageLockAt: (index: number) => void
  clearCoverageLocks: () => void
  /** Drum's counterpart to lockedPositions — kept as its own slice rather than
   * reusing lockedPositions so a Drum screen and a regular edit screen never
   * fight over the same index-keyed map if both happened to be mounted. */
  lockedDrumPositions: DrumPositionLocks
  toggleDrumPositionLock: (index: number, position: number) => void
  syncDrumPositionLock: (index: number, position: number) => void
  releaseDrumPositionLockAt: (index: number) => void
  clearDrumPositionLocks: () => void
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
  /** Set when edit mode is entered from INSIDE the Gallery's full-screen
   * viewer (not the flat-grid tile hover-edit). Gallery reads this once on
   * mount to reopen the viewer on the same gradient instead of landing on
   * the flat grid — so exiting edit keeps the "immersive" full-screen thread
   * intact rather than dropping back to a browsing surface you weren't on. */
  pendingViewerGradientId: string | null
  setPendingViewerGradientId: (id: string | null) => void
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
   * Drives two things: the rolodex position counter is hidden for a named
   * palette opened from the Gallery (it would mean nothing there), and
   * exiting returns here — see exitEditMode. */
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
  /** Saved-gradient ids picked for the Instagram carousel, in the order they
   * were picked — pick order IS slide order, so this is an array and never a
   * Set. Persisted: assembling a nine-gradient carousel is a session's work
   * and a refresh shouldn't discard it.
   *
   * Ids are resolved against `saved` at read time rather than storing
   * gradients, so a rename or edit shows up in the carousel without the pick
   * having to be redone. See pickedCarouselGradients. */
  carouselPicks: string[]
  /** Adds an unpicked id to the end of the order, or removes a picked one.
   * Returns whether it ended up picked. */
  toggleCarouselPick: (id: string) => boolean
  /** Moves `fromId` to `toId`'s slot, shifting the rest — the same semantics
   * as reorderSaved, applied to slide order. */
  reorderCarouselPick: (fromId: string, toId: string) => void
  /** Nudges a pick one slot earlier or later. Drag-to-reorder is the fast
   * path; this is the one that works on a phone and from the keyboard. No-op
   * at the ends, so the first pick can't be moved off the front. */
  moveCarouselPick: (id: string, delta: -1 | 1) => void
  clearCarouselPicks: () => void
  /** Deletes several saved gradients at once, as one undoable event — the
   * bulk action behind the selection bar. Their carousel picks go with them:
   * a deleted gradient must not keep holding a slide number. */
  removeSavedGradientsByIds: (ids: string[]) => void
  /** The batch behind the last bulk delete, newest-first by index so undo can
   * splice each entry back at its original spot. Null when the last deletion
   * was a single item (see lastDeleted) or nothing has been deleted. */
  lastDeletedBatch: { gradient: Gradient; index: number }[] | null
  /** Redo counterpart to lastDeletedBatch — see lastUndone. */
  lastUndoneBatch: { gradient: Gradient; index: number }[] | null
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
      lockedCoverage: {},
      toggleCoverageLock: (index, coverage) => {
        const next = { ...get().lockedCoverage }
        if (next[index] !== undefined) {
          delete next[index]
        } else {
          next[index] = coverage
        }
        set({ lockedCoverage: next })
      },
      syncCoverageLock: (index, coverage) => {
        const current = get().lockedCoverage
        if (current[index] === undefined) return
        set({ lockedCoverage: { ...current, [index]: coverage } })
      },
      releaseCoverageLockAt: (index) => {
        const current = get().lockedCoverage
        const next: CoverageLocks = {}
        for (const key of Object.keys(current)) {
          const at = Number(key)
          if (at === index) continue
          next[at > index ? at - 1 : at] = current[at]
        }
        set({ lockedCoverage: next })
      },
      clearCoverageLocks: () => set({ lockedCoverage: {} }),
      lockedDrumPositions: {},
      toggleDrumPositionLock: (index, position) => {
        const next = { ...get().lockedDrumPositions }
        if (next[index] !== undefined) {
          delete next[index]
        } else {
          next[index] = position
        }
        set({ lockedDrumPositions: next })
      },
      syncDrumPositionLock: (index, position) => {
        const current = get().lockedDrumPositions
        if (current[index] === undefined) return
        set({ lockedDrumPositions: { ...current, [index]: position } })
      },
      releaseDrumPositionLockAt: (index) => {
        const current = get().lockedDrumPositions
        const next: DrumPositionLocks = {}
        for (const key of Object.keys(current)) {
          const at = Number(key)
          if (at === index) continue
          next[at > index ? at - 1 : at] = current[at]
        }
        set({ lockedDrumPositions: next })
      },
      clearDrumPositionLocks: () => set({ lockedDrumPositions: {} }),
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
          // A fresh deletion starts a new undo chain, and supersedes any
          // armed batch — one undo stack, whichever kind of delete armed it.
          lastUndone: null,
          lastUndoneBatch: null,
          lastDeletedBatch: null,
          carouselPicks: get().carouselPicks.filter((p) => p !== id),
        })
      },
      lastDeletedBatch: null,
      removeSavedGradientsByIds: (ids) => {
        const target = new Set(ids)
        const saved = get().saved
        // Captured with their original indices so undo restores the shape of
        // the board, not just its contents.
        const entries = saved
          .map((gradient, index) => ({ gradient, index }))
          .filter((entry) => target.has(entry.gradient.id))
        if (entries.length === 0) return
        set({
          saved: saved.filter((g) => !target.has(g.id)),
          lastDeletedBatch: entries,
          lastDeleted: null,
          lastUndone: null,
          lastUndoneBatch: null,
          carouselPicks: get().carouselPicks.filter((p) => !target.has(p)),
        })
      },
      lastDeleted: null,
      undoDelete: () => {
        const batch = get().lastDeletedBatch
        if (batch) {
          // Ascending, so each splice lands before the next entry's index is
          // consulted — inserting low-to-high keeps the later indices valid.
          let restored = get().saved
          for (const entry of [...batch].sort((a, b) => a.index - b.index)) {
            const at = Math.min(entry.index, restored.length)
            restored = [...restored.slice(0, at), entry.gradient, ...restored.slice(at)]
          }
          set({ saved: restored, lastDeletedBatch: null, lastUndoneBatch: batch })
          return
        }
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
      lastUndoneBatch: null,
      redoDelete: () => {
        const undoneBatch = get().lastUndoneBatch
        if (undoneBatch) {
          // Re-applies the bulk deletion; removeSavedGradientsByIds re-arms undo.
          get().removeSavedGradientsByIds(undoneBatch.map((e) => e.gradient.id))
          return
        }
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
      pendingViewerGradientId: null,
      setPendingViewerGradientId: (id) => set({ pendingViewerGradientId: id }),
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
      // Backing out of edit mode returns to wherever it was opened from.
      exitEditMode: () => set({ mode: get().editEnteredFrom }),
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
      carouselPicks: [],
      toggleCarouselPick: (id) => {
        const picks = get().carouselPicks
        const wasPicked = picks.includes(id)
        set({ carouselPicks: wasPicked ? picks.filter((x) => x !== id) : [...picks, id] })
        return !wasPicked
      },
      reorderCarouselPick: (fromId, toId) => {
        if (fromId === toId) return
        const picks = get().carouselPicks
        const fromIndex = picks.indexOf(fromId)
        const toIndex = picks.indexOf(toId)
        if (fromIndex === -1 || toIndex === -1) return
        const next = picks.slice()
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        set({ carouselPicks: next })
      },
      moveCarouselPick: (id, delta) => {
        const picks = get().carouselPicks
        const from = picks.indexOf(id)
        if (from === -1) return
        const to = from + delta
        if (to < 0 || to >= picks.length) return
        const next = picks.slice()
        ;[next[from], next[to]] = [next[to], next[from]]
        set({ carouselPicks: next })
      },
      clearCarouselPicks: () => set({ carouselPicks: [] }),
    }),
    {
      name: 'palette-saved-gradients',
      partialize: (state) => ({
        saved: state.saved,
        noiseEnabled: state.noiseEnabled,
        galleryLayout: state.galleryLayout,
        likedPaletteIds: state.likedPaletteIds,
        carouselPicks: state.carouselPicks,
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
