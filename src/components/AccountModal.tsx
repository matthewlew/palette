import { useState } from 'react'
import { signOut } from '../lib/auth'
import { useAppStore } from '../store/useAppStore'
// Shares SignInModal's stylesheet rather than duplicating a third
// near-identical sheet: these are the same surface at the same size, differing
// only in what they say.
import styles from './SignInModal.module.css'

interface AccountModalProps {
  username: string
  onSignedOut: () => void
  onClose: () => void
}

/**
 * The account sheet behind the nav chip. Sign-out only for now.
 *
 * Plan §6c holds sign-out until saves are server-side (step 5) because it
 * clears the local cache, and clearing before the server has a copy destroys
 * data. That hazard does not exist yet: saves are still purely local and
 * belong to the browser rather than to an account, exactly as they have for
 * every user to date. So this signs out *without* clearing them — no data
 * lost, and no change to how the browser behaves for whoever uses it next.
 *
 * When step 5 lands, saves become account-scoped and both halves change
 * together: clearing starts, and the copy below gets §12's wording about
 * gradients staying on your account.
 *
 * Delete account (§12) is not here — it needs a real deletion path, and
 * `on delete set null` behaviour worth verifying before it is offered.
 */
export function AccountModal({ username, onSignedOut, onClose }: AccountModalProps) {
  const [pending, setPending] = useState(false)
  const saved = useAppStore((s) => s.saved)
  const replaceSaved = useAppStore((s) => s.replaceSaved)

  // Anything the server does not hold yet — a save made while offline, or one
  // whose sync failed. Clearing those would destroy them, so they stay.
  const unsynced = saved.filter((g) => !g.paletteId)

  async function handleSignOut() {
    if (pending) return
    setPending(true)
    try {
      await signOut()
      // Clear only what the account can give back. `paletteId` is set by the
      // sync in lib/savedSync.ts once a save is recorded server-side, so it is
      // the evidence that signing back in will restore this gradient.
      replaceSaved(unsynced)
      onSignedOut()
    } catch {
      setPending(false)
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={(e) => { e.stopPropagation(); onClose() }} />
      <div
        className={`${styles.modal} glass-surface`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        data-testid="account-modal"
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3 className={styles.title}>@{username}</h3>
        <p className={styles.body}>
          Your gradients stay on your account. They'll be cleared from this browser — sign back in
          to get them.
          {unsynced.length > 0 && (
            <>
              {' '}
              {unsynced.length === 1
                ? "One gradient hasn't saved to your account yet and will stay on this browser."
                : `${unsynced.length} gradients haven't saved to your account yet and will stay on this browser.`}
            </>
          )}
        </p>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleSignOut}
          disabled={pending}
          data-testid="sign-out"
        >
          {pending ? 'Signing out…' : 'Sign out'}
        </button>
        <button type="button" className={styles.dismissButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  )
}
