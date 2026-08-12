import { useEffect, useRef, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { SignInModal } from './SignInModal'
import { UsernameModal } from './UsernameModal'
import { AccountModal } from './AccountModal'
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

  useEffect(() => {
    if (wasAnonymous.current && !isAnonymous && user) {
      setSignInOpen(false)
    }
    wasAnonymous.current = isAnonymous
  }, [isAnonymous, user])

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
