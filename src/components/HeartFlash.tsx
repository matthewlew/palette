import styles from './HeartFlash.module.css'

interface HeartFlashProps {
  visible: boolean
}

export function HeartFlash({ visible }: HeartFlashProps) {
  if (!visible) return null
  return (
    <svg data-testid="heart-flash" className={styles.heartFlash} viewBox="0 0 32 32">
      <polygon points="16,4 20,12 28,12 22,18 24,28 16,22 8,28 10,18 4,12 12,12" fill="white" />
    </svg>
  )
}
