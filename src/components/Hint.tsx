import styles from './Hint.module.css'

interface HintProps {
  text: string
  visible: boolean
}

export function Hint({ text, visible }: HintProps) {
  return (
    <div role="status" className={styles.hint} style={{ opacity: visible ? 1 : 0, pointerEvents: 'none' }}>
      {text}
    </div>
  )
}
