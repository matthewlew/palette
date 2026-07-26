import { useEffect, useState } from 'react'
import styles from './WelcomeOverlay.module.css'

export function WelcomeOverlay() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hasSeen = localStorage.getItem('palette-welcome-seen')
    if (!hasSeen) {
      setVisible(true)
    }
  }, [])

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem('palette-welcome-seen', '1')
  }

  if (!visible) return null

  return (
    <div className={styles.backdrop} onClick={handleDismiss} data-testid="welcome-overlay">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Welcome to Palette</h2>
          <button className={styles.closeButton} onClick={handleDismiss} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.content}>
          <p className={styles.description}>
            A premium, interactive aesthetic gradient playground and generator.
          </p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>✨</div>
              <div className={styles.featureText}>
                <strong>Discover</strong>
                <p>Scroll or swipe to smoothly explore curated gradients.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🎨</div>
              <div className={styles.featureText}>
                <strong>Customize</strong>
                <p>Tap a gradient to enter Edit Mode. Drag and drop colors to tweak.</p>
              </div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📤</div>
              <div className={styles.featureText}>
                <strong>Export & Share</strong>
                <p>Save your favorites, copy CSS, or export beautiful images.</p>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.getStartedButton} onClick={handleDismiss}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
