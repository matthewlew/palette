import styles from './Hint.module.css'

interface HintProps {
  text: string
  visible: boolean
  /**
   * 'bottom' (default) floats just above the tab bar. 'raised' clears a
   * crowded bottom-right — the gallery viewer stacks up to three action pills
   * there, and the default position lands the pill straight on top of them.
   * 'feed' clears the create feed's own two-row stack (Edit/Save, then Play)
   * above the tab bar; the toast is nearly screen-wide, so it has to clear the
   * whole stack rather than tuck beside it.
   */
  placement?: 'bottom' | 'raised' | 'feed'
}

const PLACEMENT_CLASS = { bottom: '', raised: 'raised', feed: 'feed' } as const

export function Hint({ text, visible, placement = 'bottom' }: HintProps) {
  const modifier = PLACEMENT_CLASS[placement]
  return (
    <div
      role="status"
      className={modifier ? `${styles.hint} ${styles[modifier]}` : styles.hint}
      style={{ opacity: visible ? 1 : 0, pointerEvents: 'none' }}
    >
      {text}
    </div>
  )
}
