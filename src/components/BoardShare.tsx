import { useState, useEffect, useRef } from 'react'
import { encodeToFragment, toExportJson, toSharePayloadGradient } from '../lib/gradientCodec'
import { publishPalette, publishGradient } from '../lib/publishPalette'
import { previewShareUrl } from '../lib/shareLink'
import { toCuratedEntryJson } from '../lib/curated'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Gradient } from '../store/types'
import { renderVignetteToCanvas } from '../lib/vignette'
import { shareOrDownloadCanvas } from '../lib/canvasExport'
import { ExportModal } from './ExportModal'
import { MEDIA_ICON } from '../lib/mediaChrome'
import { Icon } from '../icons'
import styles from './BoardShare.module.css'

interface BoardShareProps {
  saved: Gradient[]
  /** The gradient currently on screen — source for sharing. */
  current?: Gradient | null
  onImport: (jsonText: string) => void
  chromeVisible?: boolean
  /** Where the trigger sits, which is also what it looks like: `fixed` and
   * `viewer` float it over a gradient, so it takes the shared .ghost-chip
   * treatment along with back/save/edit; `inline` puts it in the Gallery
   * header bar, where it is a bar control sized to --control-h instead.
   *
   * This used to be decided by whether a `color` prop was passed, back when
   * floating chrome sampled a palette-derived ink per corner. The ink is fixed
   * now (see .ghost-chip), so the surface is chosen by where it lives. */
  position?: 'fixed' | 'inline' | 'viewer' | 'editor'
  /** Bulk "Export Posts" (zip of 1080x1350 PNGs). Optional because only the
   * gallery header offers it. It lives in this menu rather than as its own
   * header button: it is a slow bulk action, and as a labelled pill next to
   * the icon-only share trigger it was the odd one out in a row where nothing
   * shared a size. */
  onExportAll?: () => void
  exportingAll?: boolean
}

function getSingleShareLink(gradient: Gradient): string {
  const fragment = encodeToFragment({ kind: 'gradient', gradients: [toSharePayloadGradient(gradient)] })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

// Board-level share link (reserved for future multi-gradient sharing)
// function getShareLink(gradients: Gradient[]): string {
//   const fragment = encodeToFragment({ kind: 'board', gradients: gradients.map(toSharePayloadGradient) })
//   return `${window.location.origin}${window.location.pathname}#${fragment}`
// }

export function BoardShare({
  saved,
  current = null,
  onImport,
  chromeVisible = true,
  position = 'fixed',
  onExportAll,
  exportingAll = false,
}: BoardShareProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [jsonModal, setJsonModal] = useState<'export-board' | 'export-single' | 'import' | null>(null)
  const [importDraft, setImportDraft] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const linkFeedback = useCopyFeedback()
  const jsonFeedback = useCopyFeedback()
  const jsonSingleFeedback = useCopyFeedback()
  const curatedFeedback = useCopyFeedback()

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowMore(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close dropdown if chrome hides (user goes idle)
  useEffect(() => {
    if (!chromeVisible) {
      setIsOpen(false)
      setShowMore(false)
    }
  }, [chromeVisible])

  /** Primary action: render a poster image and hand it to the OS share sheet. */
  async function handleShareAsImage() {
    if (!current || sharing) return
    setSharing(true)
    setIsOpen(false)
    // Exporting an image also registers the gradient in the shared gallery so
    // it's searchable later; fire-and-forget so it never blocks the export.
    publishGradient(current).catch((err) => console.error('Publish on share failed', err))
    try {
      const canvas = document.createElement('canvas')
      await renderVignetteToCanvas(canvas, current, 1080, 1350, 'post')
      const slug = (current.name ?? 'gradient').toLowerCase().replace(/\s+/g, '-')
      await shareOrDownloadCanvas(canvas, `${slug}-post.png`, current.name ?? 'Gradient')
    } catch (e) {
      console.error('Share as image failed', e)
    } finally {
      setSharing(false)
    }
  }

  /** Secondary action: copy link or invoke share sheet with a URL.
   *
   * Publishes the gradient so it gets a canonical slug, then shares the
   * Edge-Function preview URL — that URL gives iMessage / IG DMs a rich card
   * (name + generated image) and 302s the recipient into the app. If the
   * publish fails (offline / Supabase down) we fall back to the self-contained
   * fragment link, which still opens the gradient but without a rich preview. */
  async function handleCopyLink() {
    if (!current) return
    let link = getSingleShareLink(current)
    try {
      const hexes = current.stops.map((s) => s.hex)
      const offsets = current.stops.map((s) => s.position)
      const result = await publishPalette(hexes, current.type, current.angle, current.name, offsets)
      if (result?.slug) link = previewShareUrl(result.slug)
    } catch (err) {
      console.error('Publish for share link failed; using fragment link', err)
    }

    if (navigator.share && navigator.canShare?.({ url: link })) {
      try {
        await navigator.share({
          title: current.name ?? 'Gradient',
          url: link,
        })
        setIsOpen(false)
        return
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err)
        }
      }
    }
    linkFeedback.copy(link)
  }

  function handleCopyJson() {
    if (jsonModal === 'export-single') {
      if (!current) return
      const json = toExportJson({ kind: 'gradient', gradients: [toSharePayloadGradient(current)] })
      jsonSingleFeedback.copy(json)
    } else {
      if (saved.length === 0) return
      const json = toExportJson({ kind: 'board', gradients: saved.map(toSharePayloadGradient) })
      jsonFeedback.copy(json)
    }
  }

  const positionClass =
    position === 'inline'
      ? styles.inline
      : position === 'viewer'
      ? styles.viewer
      : position === 'editor'
      ? styles.editor
      : styles.fixed

  const hasCurrent = current !== null
  const isCurator = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('curator')

  return (
    <div
      ref={menuRef}
      className={`${positionClass} ${!chromeVisible && !jsonModal ? styles.hidden : ''}`}
    >
      <button
        type="button"
        className={position === 'inline' ? styles.triggerButton : `${styles.triggerBase} ${MEDIA_ICON}`}
        onClick={() => { setIsOpen(!isOpen); setShowMore(false) }}
        aria-label="Share options"
        aria-expanded={isOpen}
      >
        <Icon name="share" size="md" />
      </button>

      {isOpen && (
        <div className={styles.dropdown} data-testid="share-dropdown">
          {/* ───── Primary: Share as Image ─────
              Rendered only when there IS a gradient to share. Opened from the
              gallery header there is no current gradient, so every primary
              action greyed out and the menu's only live row was "More options
              •••" — a menu whose sole offer is a second menu. An action that
              cannot be taken here is not information; it is a dead row with a
              tooltip nobody reads. */}
          {hasCurrent && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={handleShareAsImage}
              disabled={sharing}
            >
              <span className={styles.menuItemText}>
                {sharing ? 'Generating…' : 'Share as Image'}
              </span>
              <span className={styles.menuItemHint}>Poster with gradient + name</span>
            </button>
          )}

          {/* ───── Secondary: Copy / Share Link ───── */}
          {hasCurrent && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={handleCopyLink}
            >
              <span className={styles.menuItemText}>
                {linkFeedback.copied ? '✓ Link Copied!' : 'Copy Link'}
              </span>
              <span className={styles.menuItemHint}>Opens this gradient in the app</span>
            </button>
          )}

          {/* ───── Divider and the collapse ─────
              Both only earn their place when something sits above them to be
              collapsed away from. With no current gradient the primary section
              is empty, so the overflow IS the menu and opens expanded. */}
          {hasCurrent && (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => setShowMore(!showMore)}
              >
                <span className={styles.menuItemText}>
                  {showMore ? 'Less options' : 'More options •••'}
                </span>
              </button>
            </>
          )}

          {/* ───── Overflow submenu ───── */}
          {(showMore || !hasCurrent) && (
            <>
              {hasCurrent && (
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => { setIsOpen(false); setExportOpen(true) }}
                >
                  <span className={styles.menuItemText}>Export Image…</span>
                  <span className={styles.menuItemHint}>Wallpaper, Story, OG sizes</span>
                </button>
              )}

              {onExportAll && saved.length > 0 && (
                <button
                  type="button"
                  data-testid="export-all-posts"
                  className={styles.menuItem}
                  onClick={() => { setIsOpen(false); onExportAll() }}
                  disabled={exportingAll}
                >
                  <span className={styles.menuItemText}>
                    {exportingAll ? 'Zipping…' : 'Export Posts…'}
                  </span>
                  <span className={styles.menuItemHint}>ZIP of 1080×1350 PNGs</span>
                </button>
              )}

              {saved.length > 0 && (
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => { setIsOpen(false); setJsonModal('export-board') }}
                >
                  <span className={styles.menuItemText}>Export Board JSON…</span>
                  <span className={styles.menuItemHint}>Backup your full collection</span>
                </button>
              )}

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setIsOpen(false)
                  setJsonModal('import')
                  setImportDraft('')
                }}
              >
                <span className={styles.menuItemText}>Import JSON…</span>
                <span className={styles.menuItemHint}>Paste a board or gradient export</span>
              </button>

              {isCurator && hasCurrent && (
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => current && curatedFeedback.copy(toCuratedEntryJson(current))}
                >
                  <span className={styles.menuItemText}>
                    {curatedFeedback.copied ? '✓ Copied' : 'Copy as curated entry'}
                  </span>
                  <span className={styles.menuItemHint}>Ready to paste into curated.json</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {jsonModal && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setJsonModal(null)} />
          <div
            className={styles.modal}
            data-testid="json-modal"
            role="dialog"
            aria-label={
              jsonModal === 'export-board'
                ? 'Export board JSON'
                : jsonModal === 'export-single'
                ? 'Export gradient JSON'
                : 'Import JSON'
            }
          >
            <h3 className={styles.modalTitle}>
              {jsonModal === 'export-board'
                ? 'Board JSON'
                : jsonModal === 'export-single'
                ? 'Gradient JSON'
                : 'Import JSON'}
            </h3>
            <textarea
              className={styles.jsonArea}
              aria-label={
                jsonModal === 'export-board'
                  ? 'Board JSON'
                  : jsonModal === 'export-single'
                  ? 'Gradient JSON'
                  : 'Paste JSON here'
              }
              rows={10}
              readOnly={jsonModal !== 'import'}
              value={
                jsonModal === 'export-board'
                  ? toExportJson({ kind: 'board', gradients: saved.map(toSharePayloadGradient) })
                  : jsonModal === 'export-single' && current
                  ? toExportJson({ kind: 'gradient', gradients: [toSharePayloadGradient(current)] })
                  : importDraft
              }
              placeholder={jsonModal === 'import' ? 'Paste gradient or board JSON…' : undefined}
              onChange={(e) => setImportDraft(e.target.value)}
              onFocus={(e) => jsonModal !== 'import' && e.currentTarget.select()}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalButton} onClick={() => setJsonModal(null)}>
                Close
              </button>
              {jsonModal !== 'import' ? (
                <button type="button" className={styles.modalButtonPrimary} onClick={handleCopyJson}>
                  {jsonModal === 'export-single'
                    ? jsonSingleFeedback.copied
                      ? '✓ Copied'
                      : 'Copy JSON'
                    : jsonFeedback.copied
                    ? '✓ Copied'
                    : 'Copy JSON'}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.modalButtonPrimary}
                  disabled={importDraft.trim().length === 0}
                  onClick={() => {
                    onImport(importDraft)
                    setJsonModal(null)
                  }}
                >
                  Import
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {exportOpen && current && (
        <ExportModal gradient={current} onClose={() => setExportOpen(false)} />
      )}
    </div>
  )
}
