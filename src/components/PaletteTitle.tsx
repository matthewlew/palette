import { useEffect, useRef, useState } from 'react'
import type { GlassTone } from '../lib/glassTone'
import styles from './PaletteTitle.module.css'

interface PaletteTitleProps {
  name: string
  onRename: (name: string) => void
  /** Fades the title out (and disables pointer events) while the user is idle. */
  hidden?: boolean
  /** 'dark' flips the glass surface for legibility over bright backdrops. */
  tone?: GlassTone
}

/** Glass pill at the top center showing the palette's name; tapping it swaps
 * in an inline input for renaming. Enter/blur commits, Escape cancels. */
export function PaletteTitle({ name, onRename, hidden = false, tone = 'light' }: PaletteTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) {
      onRename(trimmed)
    }
  }

  return (
    <div
      data-testid="palette-title"
      className={hidden ? `${styles.title} ${styles.hidden}` : styles.title}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {editing ? (
        <input
          ref={inputRef}
          data-testid="palette-title-input"
          aria-label="Palette name"
          className={tone === 'dark' ? `${styles.input} glass-dark` : styles.input}
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          data-testid="palette-title-button"
          aria-label={`Palette name: ${name}. Tap to rename`}
          className={tone === 'dark' ? `${styles.pill} glass-dark` : styles.pill}
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
        >
          {name}
        </button>
      )}
    </div>
  )
}
