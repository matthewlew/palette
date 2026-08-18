import { useRef, useState } from 'react'
import type { Gradient } from '../store/types'
import { tileBackground } from '../lib/tileBackground'
import { namePalette } from '../lib/naming'
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

/** Card size, and the width the fan is allowed to occupy. Cards close up as
 * the hand grows so the deck keeps its footprint. */
const CARD_W = 94
const FAN_WIDTH_PX = 250
const MAX_STEP_PX = 58
const MAX_TILT_DEG = 5
const FAN_ARC_DEG = 26

/** How far the card under the pointer pushes its neighbours aside, and how far
 * it lifts. This is the browsing gesture: run along the deck and each card in
 * turn opens out of the pile far enough to be seen whole. */
const RIFFLE_PUSH_PX = 26
const RIFFLE_LIFT_PX = 16

/**
 * The picks as a hand of cards, fanned — and riffle-able, so a deck can be
 * browsed rather than merely counted.
 *
 * Overlapping cards are a compression scheme: they fit ten picks in the space
 * of three at the cost of showing most of them only as a sliver. That trade is
 * only worth making if there is a way to decompress, which is what the riffle
 * is. Moving along the deck pushes the card under the pointer clear of its
 * neighbours and lifts it, so every card can be seen whole without the deck
 * ever growing.
 *
 * The whole deck is one button rather than a card each. Overlapping hit targets
 * are a coin toss on a phone, and since every card leads to the same screen,
 * asking which one you meant would be a question with no consequence.
 */
export function CarouselDeck({ gradients, onOpen }: CarouselDeckProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [focus, setFocus] = useState<number | null>(null)

  const count = gradients.length
  const cards = gradients.slice(0, MAX_CARDS)
  const hidden = count - cards.length
  const spread = Math.max(0, cards.length - 1)

  // Cards close up as the hand grows, so the deck's footprint stays put.
  const step = spread === 0 ? 0 : Math.min(MAX_STEP_PX, FAN_WIDTH_PX / spread)
  const tilt = spread === 0 ? 0 : Math.min(MAX_TILT_DEG, FAN_ARC_DEG / spread)
  const width = spread * step + CARD_W

  if (count === 0) return null

  /** Which card the pointer is over, in fractional card positions, so the
   * riffle tracks the finger continuously instead of snapping card to card. */
  function handleMove(e: React.PointerEvent) {
    const box = ref.current?.getBoundingClientRect()
    if (!box || step === 0) return
    setFocus((e.clientX - box.left - CARD_W / 2) / step)
  }

  return (
    <button
      ref={ref}
      type="button"
      className={styles.deck}
      onClick={onOpen}
      onPointerMove={handleMove}
      onPointerLeave={() => setFocus(null)}
      data-testid="carousel-deck"
      aria-label={`${count} gradient${count === 1 ? '' : 's'} selected. Open the carousel editor.`}
      style={{ width }}
    >
      {cards.map((gradient, i) => {
        const offset = i - spread / 2
        // Distance from the middle of the fan, so the outer cards sit a touch
        // lower — a hand is held at the bottom, so it arcs.
        const norm = spread === 0 ? 0 : offset / (spread / 2)

        // Cards before the focused one slide left, cards after slide right,
        // opening a gap around it. Falls off over about one card's width so
        // the deck ripples rather than snapping open.
        let push = 0
        let lift = 0
        if (focus !== null) {
          const d = i - focus
          const near = Math.max(0, 1 - Math.abs(d))
          lift = near * RIFFLE_LIFT_PX
          push = Math.sign(d) * Math.max(0, 1 - Math.abs(d) / 2) * RIFFLE_PUSH_PX
        }

        return (
          <span
            key={gradient.id}
            className={styles.card}
            aria-hidden="true"
            style={{
              backgroundImage: tileBackground(gradient),
              zIndex: focus !== null && Math.round(focus) === i ? MAX_CARDS + 1 : i,
              transform: `translateX(${offset * step + push}px) translateY(${norm * norm * 6 - lift}px) rotate(${offset * tilt}deg)`,
            }}
          >
            {gradient.type === 'square' && (
              <TurrellSquare
                stops={gradient.stops}
                reversed={gradient.reversed}
                repeatEnabled={gradient.repeatEnabled} repeatCount={gradient.repeatCount}
                blurPx={5}
                angle={gradient.angle}
              />
            )}
            <span className={styles.index}>{i + 1}</span>
            <span className={styles.cardName}>
              {gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
            </span>
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
