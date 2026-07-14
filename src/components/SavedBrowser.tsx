import { useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { gradientMetric } from '../lib/sortColors'
import { encodeToFragment, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './SavedBrowser.module.css'

export type SavedSortKey = 'saved' | 'recent' | 'name' | 'hue'

const SORT_OPTIONS: { value: SavedSortKey; label: string }[] = [
  { value: 'saved', label: 'Saved order' },
  { value: 'recent', label: 'Most recent' },
  { value: 'name', label: 'Name' },
  { value: 'hue', label: 'Hue' },
]

export function sortSaved(saved: Gradient[], key: SavedSortKey): Gradient[] {
  switch (key) {
    case 'saved':
      return saved
    case 'recent':
      return [...saved].reverse()
    case 'name':
      return [...saved].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    case 'hue':
      return [...saved].sort(
        (a, b) =>
          gradientMetric(a.stops.map((s) => s.hex), 'hue') - gradientMetric(b.stops.map((s) => s.hex), 'hue')
      )
  }
}

function shareLink(gradient: Gradient): string {
  const fragment = encodeToFragment({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

interface SavedBrowserProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
  onClose: () => void
}

// Pinterest-style masonry needs varied card heights; the aspect is a stable
// function of the gradient id so cards don't reshuffle between opens.
const THUMB_ASPECTS = ['4 / 5', '1 / 1', '3 / 4', '4 / 3']

function thumbAspect(id: string): string {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return THUMB_ASPECTS[sum % THUMB_ASPECTS.length]
}

function SavedCard({ gradient, onSelect }: { gradient: Gradient; onSelect: (g: Gradient) => void }) {
  const renameSavedGradient = useAppStore((s) => s.renameSavedGradient)
  const removeSavedGradientById = useAppStore((s) => s.removeSavedGradientById)
  const duplicateSavedGradient = useAppStore((s) => s.duplicateSavedGradient)
  const shareFeedback = useCopyFeedback()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(gradient.name ?? '')

  function commitName() {
    setEditing(false)
    renameSavedGradient(gradient.id, draft)
  }

  return (
    <div className={styles.card} data-testid="saved-card">
      <button
        type="button"
        className={styles.cardThumb}
        aria-label={`Open ${gradient.name ?? 'saved gradient'}`}
        style={{
          aspectRatio: thumbAspect(gradient.id),
          backgroundImage:
            gradient.type === 'square'
              ? undefined
              : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                  repeat: gradient.repeatEnabled,
                  hard: gradient.hardStops,
                  fanAnchor: gradient.fanAnchor,
                }),
        }}
        onClick={() => onSelect(gradient)}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={6} />}
      </button>
      {editing ? (
        <input
          className={styles.nameInput}
          aria-label="Palette name"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') {
              setDraft(gradient.name ?? '')
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={styles.name}
          aria-label={`Rename ${gradient.name ?? 'saved gradient'}`}
          title="Tap to rename"
          onClick={() => {
            setDraft(gradient.name ?? '')
            setEditing(true)
          }}
        >
          {gradient.name ?? 'Untitled'}
        </button>
      )}
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.cardAction}
          aria-label="Copy share link"
          onClick={() => shareFeedback.copy(shareLink(gradient))}
        >
          {shareFeedback.copied ? '✓ Copied' : 'Share'}
        </button>
        <button
          type="button"
          className={styles.cardAction}
          aria-label={`Duplicate ${gradient.name ?? 'saved gradient'}`}
          onClick={() => duplicateSavedGradient(gradient.id)}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={styles.cardAction}
          aria-label={`Delete ${gradient.name ?? 'saved gradient'}`}
          onClick={() => removeSavedGradientById(gradient.id)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function SavedBrowser({ saved, onSelect, onClose }: SavedBrowserProps) {
  const [sortKey, setSortKey] = useState<SavedSortKey>('saved')
  const sorted = sortSaved(saved, sortKey)

  return (
    <>
      <div className={styles.backdrop} data-testid="saved-browser-backdrop" onClick={onClose} />
      <div className={styles.panel} data-testid="saved-browser" role="dialog" aria-label="Saved palettes">
        <div className={styles.header}>
          <h2 className={styles.title}>
            Saved <span className={styles.count}>{saved.length}</span>
          </h2>
          <label className={styles.sortLabel}>
            Sort
            <select
              className={styles.sortSelect}
              aria-label="Sort saved palettes"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SavedSortKey)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sorted.length === 0 ? (
          <p className={styles.empty}>Nothing saved yet — tap the heart on a gradient you like.</p>
        ) : (
          <div className={styles.grid}>
            {sorted.map((gradient) => (
              <SavedCard key={gradient.id} gradient={gradient} onSelect={onSelect} />
            ))}
          </div>
        )}
        {/* Mirrors the stack trigger's bottom-right spot, so the gallery
            closes from the same place it opened. */}
        <button
          type="button"
          data-testid="saved-browser-close-fab"
          className={styles.closeFab}
          aria-label="Close saved palettes"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </>
  )
}
