import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { paletteDna } from '../lib/paletteRow'
import { pushSave, removeSave, syncSaves, flushPendingUnsaves } from '../lib/savedSync'

/**
 * Keeps the shelf and the account's saves in step — accounts plan §8 step 5.
 *
 * Two phases, and they are different jobs:
 *
 *  1. **Reconcile on sign-in.** A union in both directions (see syncSaves),
 *     run once per session, so a gradient saved while signed out is not lost
 *     and a second browser does not start empty.
 *  2. **Write through afterwards.** Every later change to `saved` is diffed
 *     against what the server was last known to hold, and only the difference
 *     is sent.
 *
 * The diffing lives here rather than in the store's actions so the store keeps
 * no network dependency: it stays synchronous and testable without mocking
 * Supabase, which most of the suite relies on.
 *
 * Signed out, this does nothing at all and saves stay local, exactly as they
 * behaved before accounts existed.
 */
export function useSavedSync(userId: string | null) {
  const saved = useAppStore((s) => s.saved)
  const replaceSaved = useAppStore((s) => s.replaceSaved)
  const clearPendingUnsave = useAppStore((s) => s.clearPendingUnsave)

  /** DNA → palette row id, for everything the server is known to hold. */
  const serverStateRef = useRef<Map<string, string> | null>(null)
  const syncedForUserRef = useRef<string | null>(null)
  /** `saved` is a dependency of the write-through effect and is also written
   * by the reconcile, so without this the reconcile's own result reads back as
   * a user edit and bounces. */
  const reconcilingRef = useRef(false)

  // Phase 1 — reconcile, once per signed-in user.
  useEffect(() => {
    if (!userId) {
      serverStateRef.current = null
      syncedForUserRef.current = null
      return
    }
    if (syncedForUserRef.current === userId) return
    syncedForUserRef.current = userId

    let cancelled = false
    reconcilingRef.current = true
    ;(async () => {
      try {
        // A delete that committed locally but never reached the server (tab
        // closed or reloaded mid-request — see addPendingUnsave) gets a second
        // try here, before the union below can mistake the still-present
        // server row for something to pull back down.
        const pendingIds = useAppStore.getState().pendingUnsaves
        const stillPending = new Set(pendingIds)
        if (pendingIds.length > 0) {
          const cleared = await flushPendingUnsaves(userId, pendingIds)
          if (cancelled) return
          for (const id of cleared) {
            stillPending.delete(id)
            clearPendingUnsave(id)
          }
        }

        const merged = await syncSaves(userId, useAppStore.getState().saved, stillPending)
        if (cancelled) return
        serverStateRef.current = new Map(
          merged.filter((g) => g.paletteId).map((g) => [paletteDna(g), g.paletteId as string]),
        )
        replaceSaved(merged)
      } catch (err) {
        // Offline, rate limited, or RLS said no. The local shelf is untouched
        // and still authoritative for this session; the next sign-in retries.
        console.error('Saved sync failed:', err)
        syncedForUserRef.current = null
      } finally {
        if (!cancelled) reconcilingRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, replaceSaved])

  // Phase 2 — write through subsequent local changes.
  useEffect(() => {
    if (!userId) return
    const serverState = serverStateRef.current
    if (!serverState || reconcilingRef.current) return

    const currentDna = new Set(saved.map(paletteDna))

    const added = saved.filter((g) => !serverState.has(paletteDna(g)))
    const removed = [...serverState.entries()].filter(([dna]) => !currentDna.has(dna))
    if (added.length === 0 && removed.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const gradient of added) {
        try {
          const paletteId = await pushSave(userId, gradient)
          if (cancelled) return
          if (paletteId) serverState.set(paletteDna(gradient), paletteId)
        } catch (err) {
          // Left out of serverState on purpose, so the next change retries it
          // rather than the save being silently forgotten.
          console.error('Could not save to your account:', err)
        }
      }
      for (const [dna, paletteId] of removed) {
        try {
          await removeSave(userId, paletteId)
          if (cancelled) return
          serverState.delete(dna)
          // Same-session common case: the delete that triggered this effect
          // just reached the server, so there is nothing left for a later
          // reload's flushPendingUnsaves to redo.
          clearPendingUnsave(paletteId)
        } catch (err) {
          console.error('Could not remove that from your account:', err)
          // Left pending on purpose — pendingUnsaves is what makes this retry
          // on the next reconcile instead of the interrupted delete quietly
          // reappearing.
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [saved, userId])
}
