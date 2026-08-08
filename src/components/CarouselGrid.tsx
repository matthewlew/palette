import type { Gradient } from '../store/types'
import { tileBackground } from '../lib/tileBackground'
import { namePalette } from '../lib/naming'
import { useReorderDrag, NO_DRAG_ATTR } from '../hooks/useReorderDrag'
import { TurrellSquare } from './TurrellSquare'
import styles from './CarouselGrid.module.css'

interface CarouselGridProps {
  /** The picked gradients, already resolved and in slide order. */
  gradients: Gradient[]
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onMove: (id: string, delta: -1 | 1) => void
}

/**
 * The carousel's running order, as a grid you can see all of at once.
 *
 * A filmstrip made you scroll to compare slide 2 against slide 8, which is the
 * one comparison that decides an order. Wrapping to a grid puts the whole
 * sequence on one screen — and because it reads left-to-right, top-to-bottom
 * like the numbers on the tiles, "what order is this in" needs no explaining.
 *
 * Reordering is hold-then-drag (see useReorderDrag). The nudge arrows this
 * replaced were there because HTML5 drag events don't fire on touch, so on a
 * phone they were the only thing that worked — a workaround wearing the costume
 * of a feature. With a drag that actually works on touch there is nothing left
 * for them to do, and the arrow keys still cover the keyboard case.
 */
export function CarouselGrid({ gradients, onRemove, onReorder, onMove }: CarouselGridProps) {
  const { activeId, overId, getItemProps } = useReorderDrag({ onReorder })
  const last = gradients.length - 1

  return (
    <ol className={styles.grid} data-testid="carousel-grid" aria-label="Carousel order">
      {gradients.map((gradient, i) => {
        const name = gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
        const role = i === 0 ? 'Start' : i === last ? 'End' : null
        const className = [
          styles.item,
          activeId === gradient.id ? styles.itemActive : '',
          overId === gradient.id ? styles.itemOver : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <li
            key={gradient.id}
            className={className}
            data-testid="grid-item"
            data-grid-id={gradient.id}
            tabIndex={0}
            // Arrow keys move the slide rather than moving focus between
            // slides: this list exists to be reordered, and a keyboard user
            // otherwise has no way to do the thing it is for.
            aria-label={`Slide ${i + 1}, ${name}. Arrow keys reorder, Delete removes.`}
            aria-keyshortcuts="ArrowLeft ArrowRight Delete"
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                onMove(gradient.id, -1)
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                onMove(gradient.id, 1)
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault()
                onRemove(gradient.id)
              }
            }}
            {...getItemProps(gradient.id)}
          >
            <div className={styles.thumb} style={{ backgroundImage: tileBackground(gradient) }}>
              {gradient.type === 'square' && (
                <TurrellSquare
                  stops={gradient.stops}
                  reversed={gradient.reversed}
                  repeatEnabled={gradient.repeatEnabled}
                  blurPx={4}
                  angle={gradient.angle}
                />
              )}
              <span className={styles.number} aria-hidden="true">
                {i + 1}
              </span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => onRemove(gradient.id)}
                aria-label={`Remove ${name} from the carousel`}
                {...{ [NO_DRAG_ATTR]: '' }}
              >
                ✕
              </button>
            </div>
            <span className={styles.caption}>
              {role ? <span className={styles.role}>{role}</span> : <span className={styles.name}>{name}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
