import { useEffect, useRef, useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import type { GradientType } from '../lib/gradient'
import { gradientHueFamily, HUE_FAMILIES } from '../lib/hueFilter'
import { encodeToFragment, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { useHint } from '../hooks/useHint'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import { ExportModal } from './ExportModal'
import styles from './Gallery.module.css'

const TYPE_CHIPS: GradientType[] = ['linear', 'radial', 'angular', 'square']

function shareLink(gradient: Gradient): string {
  const fragment = encodeToFragment({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

function matchesFilters(gradient: Gradient, type: GradientType | null, hue: string | null): boolean {
  if (type && gradient.type !== type) return false
  if (hue && gradientHueFamily(gradient.stops) !== hue) return false
  return true
}

function tileBackground(gradient: Gradient): string | undefined {
  return gradient.type === 'square'
    ? undefined
    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
      })
}

function Tile({
  gradient,
  onOpen,
  galleryLayout,
}: {
  gradient: Gradient
  onOpen: (gradient: Gradient) => void
  galleryLayout: 'grid' | 'masonry'
}) {
  // Deterministic aspect ratio based on ID length or character code sum
  const charCodeSum = gradient.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const ratioIndex = charCodeSum % 3
  const aspectRatio = ratioIndex === 0 ? '3 / 4' : ratioIndex === 1 ? '4 / 5' : '2 / 3'

  return (
    <button
      type="button"
      data-testid="gallery-tile"
      className={galleryLayout === 'masonry' ? styles.masonryTile : styles.tile}
      aria-label={`${gradient.name ?? 'Untitled'}, ${gradient.type} gradient`}
      onClick={() => onOpen(gradient)}
    >
      <div
        className={styles.tilePreview}
        style={{
          backgroundImage: tileBackground(gradient),
          aspectRatio: galleryLayout === 'masonry' ? aspectRatio : '4 / 5',
          viewTransitionName: `palette-card-${gradient.id}`,
        }}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={6} />}
      </div>
      <div className={styles.tileMeta}>
        <span className={styles.tileName}>{gradient.name ?? 'Untitled'}</span>
      </div>
    </button>
  )
}

interface ViewerProps {
  gradient: Gradient
  onClose: () => void
  onRiff: (gradient: Gradient) => void
}

function Viewer({ gradient, onClose, onRiff }: ViewerProps) {
  const renameSavedGradient = useAppStore((s) => s.renameSavedGradient)
  const removeSavedGradientById = useAppStore((s) => s.removeSavedGradientById)
  const shareFeedback = useCopyFeedback()
  const [renaming, setRenaming] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [draft, setDraft] = useState(gradient.name ?? '')
  const touchStartYRef = useRef<number | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function commitRename() {
    setRenaming(false)
    renameSavedGradient(gradient.id, draft)
  }

  return (
    <div
      data-testid="gallery-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={gradient.name ?? 'Gradient'}
      className={styles.viewer}
      style={{ backgroundImage: tileBackground(gradient) }}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartYRef.current = e.touches[0]?.clientY ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartYRef.current
        touchStartYRef.current = null
        const end = e.changedTouches[0]?.clientY
        // Swipe down closes, matching the "back is swipe-down/×" rule.
        if (start != null && end != null && end - start > 80) onClose()
      }}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
      <button type="button" className={styles.viewerClose} aria-label="Close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        ✕
      </button>
      <div className={styles.viewerPanel} onClick={(e) => e.stopPropagation()}>
        {renaming ? (
          <input
            className={styles.viewerRenameInput}
            aria-label="Palette name"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft(gradient.name ?? '')
                setRenaming(false)
              }
            }}
          />
        ) : (
          <h2 className={styles.viewerName}>{gradient.name ?? 'Untitled'}</h2>
        )}
        <div className={styles.viewerActions}>
          <button
            type="button"
            className={styles.viewerPrimary}
            onClick={() => onRiff(gradient)}
          >
            Riff
          </button>
          <button
            type="button"
            className={styles.viewerAction}
            onClick={() => shareFeedback.copy(shareLink(gradient))}
          >
            {shareFeedback.copied ? '✓ Copied' : 'Share'}
          </button>
          <button
            type="button"
            className={styles.viewerAction}
            onClick={() => setExportOpen(true)}
          >
            Export
          </button>
          <button
            type="button"
            className={styles.viewerAction}
            onClick={() => {
              setDraft(gradient.name ?? '')
              setRenaming(true)
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className={styles.viewerAction}
            onClick={() => {
              removeSavedGradientById(gradient.id)
              onClose()
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {exportOpen && (
        <ExportModal gradient={gradient} onClose={() => setExportOpen(false)} />
      )}
    </div>
  )
}

interface GalleryProps {
  onRiff: (gradient: Gradient) => void
  onImport?: (jsonText: string) => void
}

export function Gallery({ onRiff, onImport }: GalleryProps) {
  const saved = useAppStore((s) => s.saved)
  const setMode = useAppStore((s) => s.setMode)
  const galleryLayout = useAppStore((s) => s.galleryLayout)
  const setGalleryLayout = useAppStore((s) => s.setGalleryLayout)
  const [typeFilter, setTypeFilter] = useState<GradientType | null>(null)
  const [hueFilter, setHueFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<Gradient | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState('')
  const galleryHint = useHint('gallery')

  // Visiting the Gallery answers the "Saved to your Gallery" hint forever.
  useEffect(() => {
    galleryHint.dismiss()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = saved.filter((gradient) => matchesFilters(gradient, typeFilter, hueFilter))
  const hasFilters = typeFilter !== null || hueFilter !== null

  const gridRef = useRef<HTMLDivElement>(null)

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const active = document.activeElement as HTMLElement
    if (!active || !gridRef.current || !gridRef.current.contains(active)) return

    const tiles = Array.from(gridRef.current.querySelectorAll('.' + styles.tile)) as HTMLElement[]
    const currentIndex = tiles.indexOf(active)
    if (currentIndex === -1) return

    // Calculate columns
    let cols = 1
    if (tiles.length > 1) {
      const firstTop = tiles[0].getBoundingClientRect().top
      for (let i = 1; i < tiles.length; i++) {
        if (Math.abs(tiles[i].getBoundingClientRect().top - firstTop) < 2) {
          cols++
        } else {
          break
        }
      }
    }

    let nextIndex = currentIndex
    switch (e.key) {
      case 'ArrowLeft':
        nextIndex = currentIndex - 1
        break
      case 'ArrowRight':
        nextIndex = currentIndex + 1
        break
      case 'ArrowUp':
        nextIndex = currentIndex - cols
        break
      case 'ArrowDown':
        nextIndex = currentIndex + cols
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = tiles.length - 1
        break
      default:
        return // Let other keys propagate
    }

    if (nextIndex >= 0 && nextIndex < tiles.length) {
      e.preventDefault()
      tiles[nextIndex].focus()
    }
  }

  return (
    <div data-testid="gallery" className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Gallery</h2>
        <div className={styles.headerActions}>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={galleryLayout === 'grid' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setGalleryLayout('grid')}
              aria-label="Show grid layout"
              title="Grid layout"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              className={galleryLayout === 'masonry' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setGalleryLayout('masonry')}
              aria-label="Show Pinterest masonry layout"
              title="Pinterest masonry layout"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className={styles.importButton}
            onClick={() => {
              setImportDraft('')
              setImportOpen(true)
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import JSON
          </button>
        </div>
      </div>

      <div className={styles.chips}>
        <button
          type="button"
          className={!hasFilters ? styles.chipOn : styles.chip}
          onClick={() => {
            setTypeFilter(null)
            setHueFilter(null)
          }}
        >
          All <span className={styles.chipCount}>{saved.length}</span>
        </button>
        {TYPE_CHIPS.map((type) => {
          const count = saved.filter((gradient) => gradient.type === type).length
          return (
            <button
              key={type}
              type="button"
              className={typeFilter === type ? styles.chipOn : styles.chip}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {type[0].toUpperCase() + type.slice(1)}{' '}
              <span className={styles.chipCount}>{count}</span>
            </button>
          )
        })}
        {HUE_FAMILIES.map((family) => {
          const count = saved.filter((gradient) => gradientHueFamily(gradient.stops) === family.key).length
          return (
            <button
              key={family.key}
              type="button"
              aria-label={`Filter by ${family.label} (${count} matches)`}
              className={hueFilter === family.key ? styles.hueChipOn : styles.hueChip}
              onClick={() => setHueFilter(hueFilter === family.key ? null : family.key)}
            >
              <span className={styles.hueDot} style={{ background: family.swatchHex }} />
              <span className={styles.hueCount}>{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {hasFilters && saved.length > 0 ? (
            <>
              <p className={styles.emptyText}>No matches here.</p>
              <button
                type="button"
                className={styles.emptyAction}
                onClick={() => {
                  setTypeFilter(null)
                  setHueFilter(null)
                }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className={styles.emptyText}>Make something — your pins land here.</p>
              <button type="button" className={styles.emptyAction} onClick={() => setMode('create')}>
                Create
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          ref={gridRef}
          onKeyDown={handleGridKeyDown}
          className={galleryLayout === 'masonry' ? styles.masonryGrid : styles.grid}
        >
          {filtered.map((gradient) => (
            <Tile
              key={gradient.id}
              gradient={gradient}
              onOpen={setOpen}
              galleryLayout={galleryLayout}
            />
          ))}
        </div>
      )}

      {open && <Viewer gradient={open} onClose={() => setOpen(null)} onRiff={onRiff} />}

      {importOpen && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setImportOpen(false)} />
          <div
            className={styles.modal}
            role="dialog"
            aria-label="Import board JSON"
          >
            <h3 className={styles.modalTitle}>Import JSON</h3>
            <textarea
              className={styles.jsonArea}
              aria-label="Paste JSON here"
              rows={10}
              value={importDraft}
              placeholder="Paste gradient or board JSON…"
              onChange={(e) => setImportDraft(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalButton} onClick={() => setImportOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className={styles.modalButtonPrimary}
                disabled={importDraft.trim().length === 0}
                onClick={() => {
                  onImport?.(importDraft)
                  setImportOpen(false)
                }}
              >
                Import
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
