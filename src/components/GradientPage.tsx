import { buildGradientCss } from '../lib/gradient'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useHeartFlash } from '../hooks/useHeartFlash'
import { HeartFlash } from './HeartFlash'
import type { Gradient } from '../store/types'
import styles from './GradientPage.module.css'

interface GradientPageProps {
  gradient: Gradient
  onSave: (gradient: Gradient) => void
  onEdit: () => void
}

export function GradientPage({ gradient, onSave, onEdit }: GradientPageProps) {
  const { visible, flash } = useHeartFlash()

  function handleDoubleTap() {
    onSave(gradient)
    flash()
  }

  const { onPointerUp } = useDoubleTap(handleDoubleTap, onEdit)

  return (
    <div
      data-testid="gradient-page"
      className={styles.page}
      style={{
        backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        touchAction: 'manipulation',
      }}
      onPointerUp={onPointerUp}
    >
      <HeartFlash visible={visible} />
    </div>
  )
}
