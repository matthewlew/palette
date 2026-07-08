import { useState, useEffect, useRef } from 'react'
import { encodeToFragment, toExportJson, toSharePayloadGradient } from '../lib/gradientCodec'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Gradient } from '../store/types'
import styles from './BoardShare.module.css'

interface BoardShareProps {
  saved: Gradient[]
  onImport: (jsonText: string) => void
  chromeVisible?: boolean
}

function getShareLink(gradients: Gradient[]): string {
  const fragment = encodeToFragment({ kind: 'board', gradients: gradients.map(toSharePayloadGradient) })
  return `${window.location.origin}${window.location.pathname}#${fragment}`
}

export function BoardShare({ saved, onImport, chromeVisible = true }: BoardShareProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shareFeedback = useCopyFeedback()
  const jsonFeedback = useCopyFeedback()

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
    const text = window.prompt('Paste gradient/board JSON to import:')
    if (text) {
      onImport(text)
    }
  }

  const hasSaved = saved.length > 0

  return (
    <div ref={menuRef} className={`${styles.container} ${!chromeVisible ? styles.hidden : ''}`}>
      <button
        type="button"
        className={styles.triggerButton}
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
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleCopyJson}
            disabled={!hasSaved}
          >
            <span className={styles.menuItemText}>
              {jsonFeedback.copied ? 'JSON Copied!' : 'Copy Board JSON'}
            </span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleImportClick}
          >
            <span className={styles.menuItemText}>Import Board JSON</span>
          </button>
        </div>
      )}
    </div>
  )
}
