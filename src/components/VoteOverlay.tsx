import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { useCommunityGradients } from '../hooks/useCommunityGradients'
import { SignInModal } from './SignInModal'
import { GradientPreview } from './GradientPreview'
import { Icon } from '../icons'
import { MEDIA_ICON } from '../lib/mediaChrome'
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
  fetchEloRatings,
  submitVote,
} from '../lib/gradientVoting'
import styles from './VoteOverlay.module.css'

interface VoteOverlayProps {
  onClose: () => void
}

/** One saved palette's net Elo movement across this voting session — only
 * 'community' rounds (the only test type with a paletteId on both sides
 * AND a pre-vote rating to diff against) ever produce one of these. Deltas
 * accumulate per palette across multiple rounds touching it, so "voted on
 * the same gradient twice" reads as one net change, not two rows. */
interface EloChange {
  paletteId: string
  name?: string
  colors: string[]
  delta: number
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
  // Net Elo movement per palette this session — see EloChange. Only
  // 'community' rounds ever add to this.
  const [eloChanges, setEloChanges] = useState<EloChange[]>([])

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
    const ok = await submitVote(pair, winnerIdx, roundTestType, roundStrategy)
    setShapeCounts((prev) => ({ ...prev, [winner.shape]: (prev[winner.shape] ?? 0) + 1 }))
    setTestTypeCounts((prev) => ({ ...prev, [roundTestType]: (prev[roundTestType] ?? 0) + 1 }))
    if (roundStrategy) {
      setStrategyCounts((prev) => ({ ...prev, [roundStrategy]: (prev[roundStrategy] ?? 0) + 1 }))
    }
    // Only 'community' rounds move Elo (see 0013_palette_elo.sql's trigger
    // condition) — every other round pairs against a generated/mutated
    // candidate with no paletteId, so there's nothing to look up.
    if (ok && roundTestType === 'community') {
      const [a, b] = pair
      if (a.paletteId && b.paletteId && a.eloRatingBefore != null && b.eloRatingBefore != null) {
        const after = await fetchEloRatings([a.paletteId, b.paletteId])
        const deltas: { candidate: Candidate; delta: number }[] = [a, b]
          .map((c) => ({ candidate: c, delta: (after[c.paletteId!] ?? c.eloRatingBefore!) - c.eloRatingBefore! }))
          .filter((d) => d.delta !== 0)
        if (deltas.length > 0) {
          setEloChanges((prev) => {
            const next = [...prev]
            for (const { candidate, delta } of deltas) {
              const existing = next.findIndex((e) => e.paletteId === candidate.paletteId)
              if (existing >= 0) next[existing] = { ...next[existing], delta: next[existing].delta + delta }
              else next.push({ paletteId: candidate.paletteId!, name: candidate.name, colors: candidate.colors, delta })
            }
            return next
          })
        }
      }
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
    const sorted = [...eloChanges].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    return (
      <div className={styles.overlay}>
        <button type="button" className={`${styles.closeButton} ${MEDIA_ICON}`} onClick={onClose} aria-label="Close">
          <Icon name="close" size="md" />
        </button>
        <div className={styles.complete}>
          <div className={styles.completeTitle}>Nice work — {count} voted</div>
          <p className={styles.completeBody}>Every vote helps rank the community's best gradients.</p>
          {sorted.length > 0 && (
            <div className={styles.eloSummary}>
              {sorted.map((e) => (
                <div key={e.paletteId} className={styles.eloRow}>
                  <div className={styles.eloSwatch} style={{ background: `linear-gradient(90deg, ${e.colors.join(', ')})` }} />
                  <span className={styles.eloName}>{e.name ?? 'Untitled'}</span>
                  <span className={e.delta > 0 ? styles.eloUp : styles.eloDown}>
                    {e.delta > 0 ? '▲' : '▼'} {Math.abs(e.delta)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
      <button type="button" className={`${styles.closeButton} ${MEDIA_ICON}`} onClick={onClose} aria-label="Close">
        <Icon name="close" size="md" />
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
