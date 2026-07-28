import styles from './Hint.module.css'

interface HintProps {
  text: string
  visible: boolean
  /**
   * 'bottom' (default) floats just above the tab bar, where the create feed's
   * hints live. 'raised' clears a crowded bottom-right — the gallery viewer
   * stacks up to three action pills there, and the default position lands the
   * pill straight on top of them.
   */
  placement?: 'bottom' | 'raised'
}

export function Hint({ text, visible, placement = 'bottom' }: HintProps) {
  return (
    <div
      role="status"
      className={placement === 'raised' ? `${styles.hint} ${styles.raised}` : styles.hint}
      style={{ opacity: visible ? 1 : 0, pointerEvents: 'none' }}
    >
      {text}
    </div>
  )
}
