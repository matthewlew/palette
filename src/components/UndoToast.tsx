import styles from './UndoToast.module.css'

interface UndoToastProps {
  message: string
  onUndo?: () => void
}

/** App-wide confirmation toast. With `onUndo` it shows an Undo action (paste /
 * import); without it, it's a plain confirmation (copy). */
export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div data-testid="undo-toast" className={styles.toast} role="status">
      <span className={styles.text}>{message}</span>
      {onUndo && (
        <button type="button" data-testid="undo-import" className={styles.button} onClick={onUndo}>
          Undo
        </button>
      )}
    </div>
  )
}
