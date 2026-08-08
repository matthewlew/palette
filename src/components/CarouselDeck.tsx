import type { Gradient } from '../store/types'
import { tileBackground } from '../lib/tileBackground'
import { TurrellSquare } from './TurrellSquare'
import styles from './CarouselDeck.module.css'

interface CarouselDeckProps {
  /** The picked gradients, resolved and in slide order. */
  gradients: Gradient[]
  /** Tapping the deck opens the full-screen editor. */
  onOpen: () => void
}

/** Beyond this the fan is unreadable, so the rest hide behind a "+N". A hand
 * of cards is legible up to about here too, which is not a coincidence. */
const MAX_CARDS = 8

/** The fan, in pixels and degrees between adjacent cards. Both shrink as the
 * hand grows: the deck keeps its footprint and the cards close up, which is
 * what "more cards in your hand" actually looks like. */
const MAX_STEP_PX = 26
const FAN_WIDTH_PX = 132
const MAX_TILT_DEG = 6.5
const FAN_ARC_DEG = 30

const CARD_W = 46

/**
 * The picks as a hand of cards, fanned.
 *
 * This replaces a scrolling filmstrip in the dock. The filmstrip was trying to
 * be two things at once — a record of what you have AND the place you reorder
 * it — and was poor at both: too small to judge an order, too wide to sit under
 * a gallery. Splitting them lets each be good. The deck answers "what have I
 * got" in one glance and grows visibly as you pick, and reordering moves to the
 * editor, where there is room to see every slide at once.
 *
 * The whole deck is one button rather than a card each. Overlapping hit targets
 * a few pixels wide are a coin toss on a phone, and since every card leads to
 * the same screen, asking which one you meant would be a question with no
 * consequence.
 */
export function CarouselDeck({ gradients, onOpen }: CarouselDeckProps) {
  const count = gradients.length
  if (count === 0) return null

  const cards = gradients.slice(0, MAX_CARDS)
  const hidden = count - cards.length
  const spread = cards.length - 1

  // Cards close up as the hand grows, so the deck's footprint stays put.
  const step = spread === 0 ? 0 : Math.min(MAX_STEP_PX, FAN_WIDTH_PX / spread)
  const tilt = spread === 0 ? 0 : Math.min(MAX_TILT_DEG, FAN_ARC_DEG / spread)

  return (
    <button
      type="button"
      className={styles.deck}
      onClick={onOpen}
      data-testid="carousel-deck"
      aria-label={`${count} gradient${count === 1 ? '' : 's'} selected. Open the carousel editor.`}
      style={{ width: spread * step + CARD_W }}
    >
      {cards.map((gradient, i) => {
        const offset = i - spread / 2
        // Normalised distance from the middle of the fan, so the outer cards
        // sit a touch lower — a hand is held at the bottom, so it arcs.
        const norm = spread === 0 ? 0 : offset / (spread / 2)
        return (
          <span
            key={gradient.id}
            className={styles.card}
            aria-hidden="true"
            style={{
              backgroundImage: tileBackground(gradient),
              zIndex: i,
              transform: `translateX(${offset * step}px) translateY(${norm * norm * 5}px) rotate(${offset * tilt}deg)`,
            }}
          >
            {gradient.type === 'square' && (
              <TurrellSquare
                stops={gradient.stops}
                reversed={gradient.reversed}
                repeatEnabled={gradient.repeatEnabled}
                blurPx={3}
                angle={gradient.angle}
              />
            )}
          </span>
        )
      })}
      {hidden > 0 && (
        <span className={styles.more} aria-hidden="true">
          +{hidden}
        </span>
      )}
    </button>
  )
}
