import { useEffect, useRef, useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import type { GradientType } from '../lib/gradient'
import { gradientHueFamily, HUE_FAMILIES } from '../lib/hueFilter'
import { loadCurated } from '../lib/curated'
import type { CuratedEntry } from '../lib/curated'
import { encodeToFragment, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { useHint } from '../hooks/useHint'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import { ExportModal } from './ExportModal'
import styles from './Gallery.module.css'

type Segment = 'yours' | 'inspiration'

const TYPE_CHIPS: GradientType[] = ['linear', 'radial', 'angular', 'square']

/** A gallery item is either a local pin or a curated entry; both render the
 * same full-bleed tile, curated adds the picked badge + caption. */
interface GalleryItem {
  gradient: Gradient
  note?: string
  curated: boolean
}

function curatedToGradient(entry: CuratedEntry): Gradient {
  // Curated entries keep a stable per-entry id so React keys and viewer
  // identity survive reloads; the share codec strips ids, so reuse the
  // entry's own.
  return { ...entry.gradient, id: entry.id }
}

function shareLink(gradient: Gradient): string {
  const fragment = encodeToFragment({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

function matchesFilters(item: GalleryItem, type: GradientType | null, hue: string | null): boolean {
  if (type && item.gradient.type !== type) return false
  if (hue && gradientHueFamily(item.gradient.stops) !== hue) return false
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

function Tile({ item, onOpen }: { item: GalleryItem; onOpen: (item: GalleryItem) => void }) {
  const { gradient } = item
  return (
    <button
      type="button"
      data-testid="gallery-tile"
      className={styles.tile}
      aria-label={`${gradient.name ?? 'Untitled'}, ${gradient.type} gradient${item.curated ? ', picked' : ''}`}
      style={{ backgroundImage: tileBackground(gradient) }}
      onClick={() => onOpen(item)}
    >
      {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={6} />}
      <span className={styles.tileScrim}>
        <span className={styles.tileName}>
          {item.curated && <span className={styles.badge} aria-hidden="true" />}
          {gradient.name ?? 'Untitled'}
        </span>
        {item.curated && item.note && <span className={styles.tileCaption}>{item.note}</span>}
      </span>
    </button>
  )
}

interface ViewerProps {
  item: GalleryItem
  onClose: () => void
  onRiff: (gradient: Gradient) => void
}

function Viewer({ item, onClose, onRiff }: ViewerProps) {
  const { gradient } = item
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
        {item.curated && item.note && <p className={styles.viewerCaption}>{item.note}</p>}
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
          {!item.curated && (
            <>
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
            </>
          )}
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
}

export function Gallery({ onRiff }: GalleryProps) {
  const saved = useAppStore((s) => s.saved)
  const setMode = useAppStore((s) => s.setMode)
  const [segment, setSegment] = useState<Segment>('yours')
  const [curated, setCurated] = useState<CuratedEntry[] | null>(null)
  const [curatedError, setCuratedError] = useState(false)
  const [typeFilter, setTypeFilter] = useState<GradientType | null>(null)
  const [hueFilter, setHueFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<GalleryItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const inspirationHint = useHint('inspiration')
  const galleryHint = useHint('gallery')

  // Visiting the Gallery answers the "Saved to your Gallery" hint forever.
  useEffect(() => {
    galleryHint.dismiss()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    setCurated(null)
    setCuratedError(false)
    loadCurated().then((result) => {
      if (cancelled) return
      setCurated(result.entries)
      setCuratedError(result.error)
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const items: GalleryItem[] =
    segment === 'yours'
      ? saved.map((gradient) => ({ gradient, curated: false }))
      : (curated ?? []).map((entry) => ({ gradient: curatedToGradient(entry), note: entry.note, curated: true }))
  const filtered = items.filter((item) => matchesFilters(item, typeFilter, hueFilter))
  const hasFilters = typeFilter !== null || hueFilter !== null
  const loading = segment === 'inspiration' && curated === null

  return (
    <div data-testid="gallery" className={styles.container}>
      <div role="tablist" aria-label="Gallery sections" className={styles.segments}>
        <button
          type="button"
          role="tab"
          aria-selected={segment === 'yours'}
          className={segment === 'yours' ? styles.segmentOn : styles.segment}
          onClick={() => setSegment('yours')}
        >
          Yours
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={segment === 'inspiration'}
          className={segment === 'inspiration' ? styles.segmentOn : styles.segment}
          onClick={() => {
            setSegment('inspiration')
            inspirationHint.dismiss()
          }}
        >
          Inspiration
          {inspirationHint.visible && <span className={styles.segmentDot} aria-hidden="true" />}
        </button>
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
          All <span className={styles.chipCount}>{items.length}</span>
        </button>
        {TYPE_CHIPS.map((type) => {
          const count = items.filter((item) => item.gradient.type === type).length
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
          const count = items.filter((item) => gradientHueFamily(item.gradient.stops) === family.key).length
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

      {segment === 'inspiration' && curatedError && (
        <div className={styles.toast} role="status">
          Couldn't load picks —{' '}
          <button type="button" className={styles.toastRetry} onClick={() => setReloadKey((k) => k + 1)}>
            retry
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.placeholder} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {hasFilters && items.length > 0 ? (
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
          ) : segment === 'yours' ? (
            <>
              <p className={styles.emptyText}>Make something — your pins land here.</p>
              <button type="button" className={styles.emptyAction} onClick={() => setMode('create')}>
                Create
              </button>
            </>
          ) : (
            <p className={styles.emptyText}>Nothing picked yet — check back soon.</p>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <Tile key={item.gradient.id} item={item} onOpen={setOpen} />
          ))}
        </div>
      )}

      {open && <Viewer item={open} onClose={() => setOpen(null)} onRiff={onRiff} />}
    </div>
  )
}
