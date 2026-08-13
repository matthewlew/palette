import { useEffect, useRef, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { useSavedSync } from '../hooks/useSavedSync'
import { SignInModal } from './SignInModal'
import { UsernameModal } from './UsernameModal'
import { AccountModal } from './AccountModal'
import { ClaimModal } from './ClaimModal'
import { useAppStore } from '../store/useAppStore'
import { findClaimable, type ClaimCandidate } from '../lib/claimPalettes'
import styles from './AuthNav.module.css'

const TOAST_DURATION_MS = 4000

/**
 * The nav's sign-in entry point — plan §12 "Nav". Three states:
 *
 *  - signed out (anonymous, no linked identity) → "Sign in" button
 *  - linked but no username yet → "Pick a username" chip, reopens the picker
 *  - linked with a username → "@handle" chip
 *
 * Sign-out is deliberately not here yet: plan §6c gates it on saves being
 * server-side (step 5), so building it now would ship a control that clears
 * data it can't yet restore.
 */
export function AuthNav() {
  const { user, profile, isAnonymous, loading } = useSession()
  const [signInOpen, setSignInOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasAnonymous = useRef(isAnonymous)

  // Only for a named account. An anonymous uid is per-browser and disposable —
  // syncing to it would write rows nobody can ever reach again, and would make
  // the shelf look account-backed when it is not.
  useSavedSync(!isAnonymous && user ? user.id : null)

  useEffect(() => {
    if (wasAnonymous.current && !isAnonymous && user) {
      setSignInOpen(false)
    }
    wasAnonymous.current = isAnonymous
  }, [isAnonymous, user])

  // Offered once per signed-in account with a username, and only when the
  // shelf has something to match against. Deliberately after the username
  // picker: claiming without a handle would produce owned rows that still
  // render unsigned, which the RPC rejects anyway.
  const [claimCandidates, setClaimCandidates] = useState<ClaimCandidate[] | null>(null)
  const claimOfferedRef = useRef<string | null>(null)

  useEffect(() => {
    const accountId = !loading && !isAnonymous && profile ? profile.id : null
    if (!accountId || claimOfferedRef.current === accountId) return
    claimOfferedRef.current = accountId

    let cancelled = false
    findClaimable(useAppStore.getState().saved)
      .then((found) => {
        if (!cancelled && found.length > 0) setClaimCandidates(found)
      })
      .catch((err) => console.error('Could not check for claimable gradients:', err))

    return () => {
      cancelled = true
    }
    // `saved` is read via getState rather than depended on: this is a one-shot
    // offer at sign-in, not something that should re-fire on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAnonymous, profile])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  const needsUsername = !loading && !isAnonymous && user && !profile
  const [pickingUsername, setPickingUsername] = usePickingUsername(needsUsername)

  if (loading) return null

  return (
    <>
      {isAnonymous && (
        <button
          type="button"
          className={styles.signInButton}
          onClick={() => setSignInOpen(true)}
          data-testid="nav-sign-in"
        >
          Sign in
        </button>
      )}

      {!isAnonymous && profile && (
        <button
          type="button"
          className={styles.chip}
          onClick={() => setAccountOpen(true)}
          data-testid="nav-account-chip"
        >
          @{profile.username}
        </button>
      )}

      {!isAnonymous && !profile && user && (
        <button
          type="button"
          className={styles.chip}
          onClick={() => setPickingUsername(true)}
          data-testid="nav-pick-username"
        >
          Pick a username
        </button>
      )}

      {signInOpen && <SignInModal context="nav" onClose={() => setSignInOpen(false)} />}

      {accountOpen && profile && (
        <AccountModal
          username={profile.username}
          onSignedOut={() => {
            setAccountOpen(false)
            showToast('Signed out.')
          }}
          onClose={() => setAccountOpen(false)}
        />
      )}

      {pickingUsername && (
        <UsernameModal
          onClaimed={(username) => {
            setPickingUsername(false)
            showToast(`You're @${username}.`)
          }}
          onSkip={() => setPickingUsername(false)}
        />
      )}

      {claimCandidates && claimCandidates.length > 0 && (
        <ClaimModal
          candidates={claimCandidates}
          onClaimed={(count) => {
            setClaimCandidates(null)
            showToast(
              count === 1
                ? 'Claimed. 1 gradient now carries your name.'
                : `Claimed. ${count} gradients now carry your name.`,
            )
          }}
          onDismiss={() => setClaimCandidates(null)}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </>
  )
}

/**
 * The username picker opens itself the moment a linked identity has no
 * profile — first sign-in per plan §4 — and stays open across re-renders
 * until claimed or explicitly skipped, rather than reopening on every render
 * while `needsUsername` is true.
 */
function usePickingUsername(needsUsername: boolean | null | undefined) {
  const [open, setOpen] = useState(false)
  const offeredRef = useRef(false)

  useEffect(() => {
    if (needsUsername && !offeredRef.current) {
      offeredRef.current = true
      setOpen(true)
    }
    if (!needsUsername) {
      offeredRef.current = false
    }
  }, [needsUsername])

  return [open, setOpen] as const
}
