import { useEffect, useRef, useState } from 'react'
import { isProfane } from '../lib/profanity'
import styles from './PaletteTitle.module.css'

interface PaletteTitleProps {
  name: string
  onRename: (name: string) => void
  /** Fades the title out (and disables pointer events) while the user is idle. */
  hidden?: boolean
  /** Text color, picked by titleColorAt so it contrasts the gradient behind
   * the title — one of the palette's own stops when possible. */
  color?: string
  /** Shape · stop count · active effects, e.g. "Turrell · 5 colors · ×2" —
   * see lib/gradientSummary. Optional: only the Create feed passes one, so
   * edit mode and the Gallery viewer's title are unaffected. */
  subtitle?: string
}

/** Palette name as plain text at the top center — no glass pill, the color
 * itself carries the contrast (see lib/titleColor). Tapping swaps in an
 * inline input for renaming. Enter/blur commits, Escape cancels. */
export function PaletteTitle({ name, onRename, hidden = false, color = '#ffffff', subtitle }: PaletteTitleProps) {
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
    const trimmed = draft.trim()
    if (isProfane(trimmed)) {
      alert("Let's keep names friendly! Please try a different name.")
      setDraft(name)
      return
    }

    setEditing(false)
    if (trimmed && trimmed !== name) {
      onRename(trimmed)
    } else {
      setDraft(name)
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
          // A palette name is a name, not prose: autocorrect rewriting
          // "Cobalt Solstice" mid-type, or a red spelling squiggle under it,
          // both read as the field belonging to some other app. `done` also
          // labels the keyboard's return key for what Enter actually does
          // here, which is commit and close.
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
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
      {subtitle && (
        <span data-testid="palette-subtitle" className={styles.subtitle} style={{ color }}>
          {subtitle}
        </span>
      )}
    </div>
  )
}
