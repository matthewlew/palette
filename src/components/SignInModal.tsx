import { useState } from 'react'
import { linkGoogle } from '../lib/auth'
import styles from './SignInModal.module.css'

export type SignInContext = 'nav' | 'publish' | 'degraded'

interface SignInModalProps {
  context: SignInContext
  onClose: () => void
}

const BODY: Record<SignInContext, string> = {
  nav: 'Your gradients live on this browser. Sign in to keep them, put your name on what you publish, and pick up where you left off anywhere.',
  publish: "Published gradients carry their author's name. Sign in to publish this one.",
  degraded: "Sign in to save gradients. This browser isn't holding onto them right now.",
}

/**
 * The sign-in sheet — plan §12. Every session is already anonymous (see
 * lib/auth.ts), so "sign in" is always linkGoogle(): attaching a Google
 * identity onto the uid this browser already has. Nothing migrates.
 *
 * linkIdentity redirects to Google and back; identity_already_exists (the
 * merge case in plan §6) surfaces only after that round trip, so it is
 * handled where the redirect lands, not here.
 */
export function SignInModal({ context, onClose }: SignInModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleContinue() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await linkGoogle()
      // On success the browser navigates to Google; nothing left to do here.
    } catch (err) {
      setPending(false)
      const message = err instanceof Error ? err.message : ''
      if (message.toLowerCase().includes('popup')) {
        setError('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.')
      } else {
        setError("Couldn't reach Google. Try again.")
      }
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
        aria-label="Sign in to Palette"
        data-testid="sign-in-modal"
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3 className={styles.title}>Sign in to Palette</h3>
        <p className={styles.body}>{BODY[context]}</p>

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleContinue}
          disabled={pending}
          data-testid="continue-with-google"
        >
          {pending ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <button type="button" className={styles.dismissButton} onClick={onClose}>
          Not now
        </button>
      </div>
    </>
  )
}
