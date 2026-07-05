import { buildGradientCss } from '../lib/gradient'
import type { Gradient } from '../store/types'
import styles from './EditModeStub.module.css'

interface EditModeStubProps {
  gradient: Gradient
  onExit: () => void
}

export function EditModeStub({ gradient, onExit }: EditModeStubProps) {
  return (
    <div data-testid="edit-mode-stub" className={styles.container}>
      <div
        className={styles.preview}
        style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops) }}
      />
      <div className={styles.placeholder} onClick={onExit}>
        Edit Mode coming soon — tap to go back
      </div>
    </div>
  )
}
