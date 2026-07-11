import { useEffect, useRef, useState } from 'react'
import styles from './PaletteTitle.module.css'

interface PaletteTitleProps {
  name: string
  onRename: (name: string) => void
  /** Fades the title out (and disables pointer events) while the user is idle. */
  hidden?: boolean
  /** Text color, picked by titleColorAt so it contrasts the gradient behind
   * the title — one of the palette's own stops when possible. */
  color?: string
}

/** Palette name as plain text at the top center — no glass pill, the color
 * itself carries the contrast (see lib/titleColor). Tapping swaps in an
 * inline input for renaming. Enter/blur commits, Escape cancels. */
export function PaletteTitle({ name, onRename, hidden = false, color = '#ffffff' }: PaletteTitleProps) {
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
          className={styles.input}
          style={{ color, borderColor: color }}
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
          className={styles.pill}
          style={{ color }}
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
