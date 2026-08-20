import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { SignInModal } from './SignInModal'
import { GradientPreview } from './GradientPreview'
import {
  type Candidate,
  type TestType,
  TEST_TYPES,
  SESSION_TARGET,
  weightedPick,
  randomStrategyFor,
  pickPair,
  emptyTestTypeCounts,
  fetchVoteCounts,
  submitVote,
} from '../lib/gradientVoting'
import styles from './VoteOverlay.module.css'

interface VoteOverlayProps {
  onClose: () => void
}

/**
 * Public voting UI — same pairing/sampling as the admin ?vote=true tool
 * (src/components/GradientVote.tsx, via src/lib/gradientVoting.ts), but
 * with every axis (shape/test type/strategy) always auto-rotated by
 * scarcity rather than exposed as pickable buttons: a public voter isn't
 * here to run an experiment, just to say which gradient they like better.
 * No score, no note field, no coverage graphs.
 *
 * Opened from Gallery.tsx's "Ranked" community sort tab.
 */
export function VoteOverlay({ onClose }: VoteOverlayProps) {
  const { user, isAnonymous, loading: sessionLoading } = useSession()
  const { gradients } = useCommunityGradients('recent')
  const [pair, setPair] = useState<[Candidate, Candidate] | null>(null)
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [sessionTarget, setSessionTarget] = useState(SESSION_TARGET)
  const [shapeCounts, setShapeCounts] = useState<Record<string, number>>({})
  const [testTypeCounts, setTestTypeCounts] = useState<Record<TestType, number>>(emptyTestTypeCounts())
  const [strategyCounts, setStrategyCounts] = useState<Record<string, number>>({})
  // The test type/strategy actually used for the CURRENT round — resolved
  // once per round (always auto-weighted here, never pinned), same
  // roundTestType/roundStrategy pattern as GradientVote.tsx, needed so
  // pick() logs the SAME axis it sampled rather than re-rolling it.
  const [roundTestType, setRoundTestType] = useState<TestType>('random')
  const [roundStrategy, setRoundStrategy] = useState<string | null>(null)

  useEffect(() => {
    if (!user || isAnonymous) return
    let cancelled = false
    fetchVoteCounts(user.id).then((counts) => {
      if (cancelled || !counts) return
      setShapeCounts(counts.shapeCounts)
      setTestTypeCounts(counts.testTypeCounts)
      setStrategyCounts(counts.strategyCounts)
    })
    return () => {
      cancelled = true
    }
  }, [user, isAnonymous])

  const nextPair = useCallback(() => {
    const resolvedType = weightedPick(TEST_TYPES.map((t) => t.id), testTypeCounts)
    setRoundTestType(resolvedType)
    const resolvedStrategy = randomStrategyFor(resolvedType, strategyCounts)
    setRoundStrategy(resolvedStrategy)
    setPair(pickPair(gradients, null, resolvedType, resolvedStrategy, shapeCounts))
  }, [gradients, shapeCounts, strategyCounts, testTypeCounts])

  useEffect(() => {
    if (!pair && !isAnonymous) nextPair()
  }, [pair, isAnonymous, nextPair])

  const pick = async (winnerIdx: 0 | 1) => {
    if (!pair || saving) return
    setSaving(true)
    const winner = pair[winnerIdx]
    await submitVote(pair, winnerIdx, roundTestType, roundStrategy)
    setShapeCounts((prev) => ({ ...prev, [winner.shape]: (prev[winner.shape] ?? 0) + 1 }))
    setTestTypeCounts((prev) => ({ ...prev, [roundTestType]: (prev[roundTestType] ?? 0) + 1 }))
    if (roundStrategy) {
      setStrategyCounts((prev) => ({ ...prev, [roundStrategy]: (prev[roundStrategy] ?? 0) + 1 }))
    }
    const newCount = count + 1
    setCount(newCount)
    setSaving(false)
    if (newCount < sessionTarget) nextPair()
  }

  const keepGoing = () => setSessionTarget((t) => t + SESSION_TARGET)

  if (sessionLoading) return null

  if (isAnonymous) {
    return <SignInModal context="vote" onClose={onClose} />
  }

  if (count >= sessionTarget) {
    return (
      <div className={styles.overlay}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className={styles.complete}>
          <div className={styles.completeTitle}>Nice work — {count} voted</div>
          <p className={styles.completeBody}>Every vote helps rank the community's best gradients.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={styles.button} onClick={keepGoing}>
              Keep going
            </button>
            <button type="button" className={styles.buttonSecondary} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!pair) return null

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className={styles.pair}>
        {pair.map((c, i) => (
          <button
            key={i}
            type="button"
            className={styles.candidate}
            onClick={() => pick(i as 0 | 1)}
            disabled={saving}
          >
            <GradientPreview shape={c.shape} stops={c.stops} smooth />
            <span className={styles.candidateLabel}>{i === 0 ? 'A' : 'B'}</span>
          </button>
        ))}
      </div>
      <div className={styles.footer}>
        <span className={styles.progress}>{count} / {sessionTarget} voted</span>
      </div>
    </div>
  )
}
