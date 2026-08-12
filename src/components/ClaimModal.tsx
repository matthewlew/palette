import { useState } from 'react'
import { claimPalettes, type ClaimCandidate } from '../lib/claimPalettes'
import { tileBackground } from '../lib/tileBackground'
import styles from './SignInModal.module.css'

interface ClaimModalProps {
  candidates: ClaimCandidate[]
  onClaimed: (count: number) => void
  onDismiss: () => void
}

/**
 * "Are these yours?" — accounts plan §5 and §12.
 *
 * The one true consent prompt in the product, because it is the only place
 * ownership is inferred rather than known. Everything else that assigns a
 * byline does so from a uid that already owned the row; this asks on the
 * strength of a colour match, which could be coincidence.
 *
 * Claiming is permanent — the RPC only writes where `author_id is null`, so a
 * claimed row can never be re-claimed, including by the person who really made
 * it. Hence "for good" in the body rather than something softer.
 */
export function ClaimModal({ candidates, onClaimed, onDismiss }: ClaimModalProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const count = candidates.length
  const noun = count === 1 ? 'gradient' : 'gradients'

  async function handleClaim() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const claimed = await claimPalettes(candidates.map((c) => c.paletteId))
      onClaimed(claimed)
    } catch {
      setPending(false)
      setError("Couldn't claim those. Try again.")
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={(e) => { e.stopPropagation(); onDismiss() }} />
      <div
        className={`${styles.modal} glass-surface`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Claim gradients"
        data-testid="claim-modal"
      >
        <button type="button" className={styles.closeButton} onClick={onDismiss} aria-label="Close">
          ✕
        </button>
        <h3 className={styles.title}>Are these yours?</h3>
        <p className={styles.body}>
          {count} unsigned {noun} {count === 1 ? 'matches one' : 'match ones'} saved on this
          browser. Claiming puts your name on {count === 1 ? 'it' : 'them'} for good.
        </p>

        <div className={styles.previewGrid} aria-hidden="true">
          {candidates.map((candidate) => (
            <div
              key={candidate.paletteId}
              className={styles.preview}
              style={{
                backgroundImage: tileBackground(candidate.gradient),
                // A Turrell square has no CSS gradient form — its last stop is
                // a fair stand-in at this size. Same fallback TemplateThumb uses.
                backgroundColor: candidate.gradient.stops[candidate.gradient.stops.length - 1]?.hex,
              }}
            />
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleClaim}
          disabled={pending}
          data-testid="claim-confirm"
        >
          {pending ? 'Claiming…' : `Claim ${count}`}
        </button>
        <button type="button" className={styles.dismissButton} onClick={onDismiss}>
          Not mine
        </button>
      </div>
    </>
  )
}
