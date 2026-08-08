import type { Gradient } from '../store/types'
import { CarouselDeck } from './CarouselDeck'
import styles from './CarouselDock.module.css'

interface CarouselDockProps {
  /** The picked gradients, resolved and in slide order. */
  gradients: Gradient[]
  /** Opens the full-screen editor. */
  onNext: () => void
  /** Empties the deck and leaves selection mode. */
  onClear: () => void
}

/**
 * The collecting surface: the hand of cards you have picked, and the way
 * forward.
 *
 * One primary action, because collecting has exactly one next step. The dock
 * used to carry four buttons — Carousel, Download, Delete, Done — which made
 * picking gradients feel like a file manager. Download and Delete are things
 * you do to gradients, not things you do to a carousel-in-progress, and Done
 * and Carousel were two names for leaving the same screen. What is left is
 * Next, and a quiet Clear for backing out of the whole selection.
 *
 * Docked rather than modal, and rendered over a Gallery that stays scrollable,
 * because collecting is a loop: pick one more, pick another.
 */
export function CarouselDock({ gradients, onNext, onClear }: CarouselDockProps) {
  const count = gradients.length

  return (
    <div className={styles.dock} data-testid="selection-bar" aria-label="Carousel selection">
      <CarouselDeck gradients={gradients} onOpen={onNext} />
      <div className={styles.actions} role="toolbar" aria-label="Selection actions">
        <button type="button" className={styles.clear} onClick={onClear} data-testid="selection-clear">
          Clear
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={onNext}
          data-testid="selection-next"
        >
          Next
          <span className={styles.count} data-testid="selection-count">
            {count}
          </span>
        </button>
      </div>
    </div>
  )
}
