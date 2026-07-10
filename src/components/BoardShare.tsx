import { useState, useEffect, useRef } from 'react'
import { encodeToFragment, toExportJson, toSharePayloadGradient } from '../lib/gradientCodec'
import { toCuratedEntryJson } from '../lib/curated'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { GlassTone } from '../lib/glassTone'
import type { Gradient } from '../store/types'
import { ExportModal } from './ExportModal'
import styles from './BoardShare.module.css'

interface BoardShareProps {
  saved: Gradient[]
  /** The gradient currently on screen — source for "Copy as curated entry". */
  current?: Gradient | null
  onImport: (jsonText: string) => void
  chromeVisible?: boolean
  /** 'dark' flips the glass trigger for legibility over bright backdrops. */
  tone?: GlassTone
}

function getShareLink(gradients: Gradient[]): string {
  const fragment = encodeToFragment({ kind: 'board', gradients: gradients.map(toSharePayloadGradient) })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

export function BoardShare({ saved, current = null, onImport, chromeVisible = true, tone = 'light' }: BoardShareProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [jsonModal, setJsonModal] = useState<'export' | 'import' | null>(null)
  const [importDraft, setImportDraft] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shareFeedback = useCopyFeedback()
  const jsonFeedback = useCopyFeedback()
  const curatedFeedback = useCopyFeedback()

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
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
    }
  }, [chromeVisible])

  async function handleShareBoard() {
    if (saved.length === 0) return
    const link = getShareLink(saved)
    const shareData = {
      title: 'Palette Board',
      text: `Check out my palette board with ${saved.length} gradients!`,
      url: link,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        setIsOpen(false)
        return
      } catch (err) {
        // User cancelled or share failed, fallback to clipboard copy
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err)
        }
      }
    }

    // Fallback: Copy link
    shareFeedback.copy(link)
  }

  function handleCopyJson() {
    if (saved.length === 0) return
    const json = toExportJson({ kind: 'board', gradients: saved.map(toSharePayloadGradient) })
    jsonFeedback.copy(json)
  }

  function handleImportClick() {
    setIsOpen(false)
    setJsonModal('import')
    setImportDraft('')
  }

  function handleViewJson() {
    if (saved.length === 0) return
    setIsOpen(false)
    setJsonModal('export')
  }

  const hasSaved = saved.length > 0

  return (
    <div ref={menuRef} className={`${styles.container} ${!chromeVisible && !jsonModal ? styles.hidden : ''}`}>
      <button
        type="button"
        className={tone === 'dark' ? `${styles.triggerButton} glass-dark` : styles.triggerButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Share options"
        aria-expanded={isOpen}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown} data-testid="share-dropdown">
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleShareBoard}
            disabled={!hasSaved}
          >
            <span className={styles.menuItemText}>
              {shareFeedback.copied ? 'Link Copied!' : 'Share Board Link'}
            </span>
            <span className={styles.menuItemHint}>Rich preview link anyone can open</span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleViewJson}
            disabled={!hasSaved}
          >
            <span className={styles.menuItemText}>Export JSON…</span>
            <span className={styles.menuItemHint}>Raw data for backup or tools</span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleImportClick}
          >
            <span className={styles.menuItemText}>Import JSON…</span>
            <span className={styles.menuItemHint}>Paste a board or gradient export</span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setIsOpen(false)
              setExportOpen(true)
            }}
            disabled={!current}
          >
            <span className={styles.menuItemText}>Export Image…</span>
            <span className={styles.menuItemHint}>Save wallpaper or story size</span>
          </button>
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('curator') && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => current && curatedFeedback.copy(toCuratedEntryJson(current))}
              disabled={!current}
            >
              <span className={styles.menuItemText}>
                {curatedFeedback.copied ? '✓ Copied' : 'Copy as curated entry'}
              </span>
              <span className={styles.menuItemHint}>Ready to paste into curated.json</span>
            </button>
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
            aria-label={jsonModal === 'export' ? 'Export board JSON' : 'Import board JSON'}
          >
            <h3 className={styles.modalTitle}>{jsonModal === 'export' ? 'Board JSON' : 'Import JSON'}</h3>
            <textarea
              className={styles.jsonArea}
              aria-label={jsonModal === 'export' ? 'Board JSON' : 'Paste JSON here'}
              rows={10}
              readOnly={jsonModal === 'export'}
              value={
                jsonModal === 'export'
                  ? toExportJson({ kind: 'board', gradients: saved.map(toSharePayloadGradient) })
                  : importDraft
              }
              placeholder={jsonModal === 'import' ? 'Paste gradient or board JSON…' : undefined}
              onChange={(e) => setImportDraft(e.target.value)}
              onFocus={(e) => jsonModal === 'export' && e.currentTarget.select()}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalButton} onClick={() => setJsonModal(null)}>
                Close
              </button>
              {jsonModal === 'export' ? (
                <button type="button" className={styles.modalButtonPrimary} onClick={handleCopyJson}>
                  {jsonFeedback.copied ? '✓ Copied' : 'Copy JSON'}
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
