import styles from './ShortcutHints.module.css'

export interface ShortcutHintItem {
  keys: string[]
  label: string
}

interface ShortcutHintsProps {
  items: ShortcutHintItem[]
  visible?: boolean
  /** 'bottom' sits above the tab bar (Create feed); 'top' tucks under the
   * back button; 'inline' renders in normal flow (e.g. inside the edit panel
   * itself, rather than floating on the canvas). */
  placement?: 'bottom' | 'top' | 'inline'
  /** Palette-derived foreground color (same strategy as the title), so the
   * hints sit subtly on the gradient instead of floating on a glass pill. */
  color?: string
}

/**
 * Bottom-left strip of keyboard hints for the major actions. Hidden on
 * touch-only devices (no keyboard) via CSS, and fades with the rest of the
 * idle-fading chrome.
 */
export function ShortcutHints({ items, visible = true, placement = 'bottom', color = '#ffffff' }: ShortcutHintsProps) {
  return (
    <div
      className={[
        styles.strip,
        placement === 'top' && styles.top,
        placement === 'inline' && styles.inline,
        visible ? '' : styles.hidden,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ color }}
      aria-label="Keyboard shortcuts"
    >
      {items.map((item) => (
        <span key={item.label} className={styles.hint}>
          {item.keys.map((k) => (
            <kbd key={k} className={styles.key}>
              {k}
            </kbd>
          ))}
          <span className={styles.label}>{item.label}</span>
        </span>
      ))}
    </div>
  )
}
