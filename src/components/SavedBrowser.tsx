import { useState } from 'react'
import { buildCroppedGradientCss, cropClipPath } from '../lib/gradientCrop'
import { gradientMetric } from '../lib/sortColors'
import { encodeToFragment, toSharePayloadGradient } from '../lib/gradientCodec'
import { namePalette } from '../lib/naming'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import { OvalRadialLayers } from './OvalRadialLayers'
import { renderVignetteToCanvas } from '../lib/vignette'
import JSZip from 'jszip'
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
          aspectRatio: gradient.crop === 'circle' ? '1 / 1' : thumbAspect(gradient.id),
          backgroundImage:
            gradient.type === 'square' || (gradient.type === 'radial' && gradient.crop === 'oval')
              ? undefined
              : (buildCroppedGradientCss(gradient.type, gradient.stops, gradient.reversed ?? false, {
                  repeat: gradient.repeatEnabled,
                  hard: gradient.hardStops,
                  smooth: gradient.smoothEnabled,
                  fanAnchor: gradient.fanAnchor,
                  angle: gradient.angle,
                }, gradient.crop) ?? undefined),
          clipPath: cropClipPath(gradient.crop),
          backgroundColor: gradient.crop && gradient.crop !== 'rectangle' ? 'var(--crop-backdrop, Canvas)' : undefined,
        }}
        onClick={() => onSelect(gradient)}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} blurPx={6} angle={gradient.angle} crop={gradient.crop} />}
        {gradient.type === 'radial' && gradient.crop === 'oval' && (
          <OvalRadialLayers stops={gradient.stops} angle={gradient.angle} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} hardStops={gradient.hardStops} smoothEnabled={gradient.smoothEnabled} layerCount={20} />
        )}
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
          {gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
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
  const [exporting, setExporting] = useState(false)
  const sorted = sortSaved(saved, sortKey)

  async function handleExportAll() {
    if (exporting || saved.length === 0) return
    setExporting(true)
    try {
      const zip = new JSZip()
      for (const gradient of saved) {
        const canvas = document.createElement('canvas')
        await renderVignetteToCanvas(canvas, gradient, 1080, 1350, 'post')
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) {
          const name = gradient.name ?? namePalette(gradient.stops.map(s => s.hex))
          const slug = name.toLowerCase().replace(/\s+/g, '-')
          const filename = `${slug}-post.png`
          zip.file(filename, blob)
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const dataUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'palettes-ig-posts.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
    } catch (e) {
      console.error('Batch export failed', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className={styles.backdrop} data-testid="saved-browser-backdrop" onClick={onClose} />
      <div className={styles.panel} data-testid="saved-browser" role="dialog" aria-label="Saved palettes">
        <div className={styles.header}>
          <h2 className={styles.title}>
            Saved <span className={styles.count}>{saved.length}</span>
          </h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={handleExportAll} 
              disabled={exporting || saved.length === 0}
              className={styles.exportAllButton}
            >
              {exporting ? 'Generating ZIP...' : 'Export All as Posts'}
            </button>
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
