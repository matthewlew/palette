import { useEffect, useState } from 'react'
import { checkUsername, claimUsername, isAvailable, type UsernameProblem } from '../lib/username'
import styles from './UsernameModal.module.css'

interface UsernameModalProps {
  onClaimed: (username: string) => void
  onSkip: () => void
}

const PROBLEM_MESSAGE: Record<UsernameProblem, string> = {
  'too-short': 'At least 3 characters.',
  'too-long': '20 characters max.',
  'bad-characters': 'Letters, numbers and underscores only.',
  'edge-underscore': "Can't start or end with an underscore.",
  reserved: "That one's reserved.",
  profane: 'Pick something else.',
}

type Availability = 'idle' | 'checking' | 'available' | 'taken'

/**
 * The username picker — plan §4 and §12. Blocking modal on first sign-in
 * with no profile row; a signed-in user with no profile is still a legal
 * state (see UsernameModal usage), so Skip is always offered.
 */
export function UsernameModal({ onClaimed, onSkip }: UsernameModalProps) {
  const [value, setValue] = useState('')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const problem = value.length > 0 ? checkUsername(value) : null

  useEffect(() => {
    if (problem || value.length === 0) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const ok = await isAvailable(value)
        if (!cancelled) setAvailability(ok ? 'available' : 'taken')
      } catch {
        if (!cancelled) setAvailability('idle')
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, problem])

  const canSubmit = !problem && availability === 'available' && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const profile = await claimUsername(value)
      onClaimed(profile.username)
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown'
      if (code === 'taken') {
        setAvailability('taken')
      } else {
        setSubmitError("Couldn't save that. Try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  let hint = '3–20 characters. Letters, numbers and underscores.'
  let hintClass = styles.hint
  if (value.length === 0) {
    // resting hint
  } else if (availability === 'checking') {
    hint = ''
  } else if (problem) {
    hint = PROBLEM_MESSAGE[problem]
    hintClass = `${styles.hint} ${styles.hintError}`
  } else if (availability === 'taken') {
    hint = `@${value.toLowerCase()} is taken.`
    hintClass = `${styles.hint} ${styles.hintError}`
  } else if (availability === 'available') {
    hint = `@${value.toLowerCase()} is available.`
    hintClass = `${styles.hint} ${styles.hintOk}`
  }

  const fieldHasError = value.length > 0 && (problem !== null || availability === 'taken')

  return (
    <>
      <div className={styles.backdrop} />
      <div
        className={`${styles.modal} glass-surface`}
        role="dialog"
        aria-modal="true"
        aria-label="Pick a username"
        data-testid="username-modal"
      >
        <button type="button" className={styles.closeButton} onClick={onSkip} aria-label="Skip for now">
          ✕
        </button>
        <h3 className={styles.title}>Pick a username</h3>
        <p className={styles.body}>
          This is the name on every gradient you publish. You can't change it later.
        </p>

        <div className={fieldHasError ? `${styles.fieldRow} ${styles.fieldRowError}` : styles.fieldRow}>
          <span className={styles.prefix}>@</span>
          <input
            className={styles.field}
            type="text"
            placeholder="username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            autoFocus
            data-testid="username-field"
          />
        </div>
        <p className={hintClass}>{availability === 'checking' ? '' : hint}</p>
        {submitError && <p className={`${styles.hint} ${styles.hintError}`}>{submitError}</p>}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid="claim-username"
        >
          {submitting ? 'Claiming…' : 'Claim username'}
        </button>
        <button type="button" className={styles.dismissButton} onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </>
  )
}
