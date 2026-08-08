import { useEffect, useRef } from 'react'
import type { Gradient } from '../store/types'
import type { CarouselSlide } from '../lib/carouselTemplates'
import type { CaptionParts } from '../lib/carouselCaption'
import { renderSlide, SLIDE_SIZES, type SlideRatio } from '../lib/carouselRender'
import { namePalette } from '../lib/naming'
import { useReorderDrag, NO_DRAG_ATTR } from '../hooks/useReorderDrag'
import styles from './CarouselSequence.module.css'

/** Preview canvases render at a fraction of export size — a framed nine-slide
 * carousel at 1080px is seconds of work for pixels nobody sees at 150px wide. */
const PREVIEW_WIDTH = 300

interface CarouselSequenceProps {
  /** The built carousel, cover and summary included. */
  slides: CarouselSlide[]
  /** The picked gradients, in slide order. */
  gradients: Gradient[]
  parts: CaptionParts
  ratio: SlideRatio
  framed: boolean
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  /** Go back to the Gallery to pick more. */
  onAdd: () => void
  /** Open this slide full screen, by its index in `slides`. */
  onOpen: (index: number) => void
}

/**
 * The carousel as one list: what the slides look like AND what order they are
 * in, on the same cards.
 *
 * These used to be two sections — a strip of gradient thumbnails you dragged,
 * and below it a strip of rendered slide previews. They showed the same
 * sequence twice and disagreed about what a "slide" was: the order strip had
 * one entry per gradient, the preview had one per slide, so with a cover
 * turned on the two lists were different lengths and item 3 in one was item 4
 * in the other. Merging them removes the translation step — you drag the thing
 * you are looking at, and the cover and summary redraw around it.
 *
 * The bookends are shown but not draggable. A cover composed of every pick has
 * no position of its own to move to, and a summary that isn't last isn't a
 * summary; showing them in place is what makes that legible without a rule
 * anyone has to be told.
 */
export function CarouselSequence({
  slides,
  gradients,
  parts,
  ratio,
  framed,
  onRemove,
  onReorder,
  onMove,
  onAdd,
  onOpen,
}: CarouselSequenceProps) {
  // A press that never travels is a tap, so opening a slide and dragging it
  // are the same gesture told apart by whether it moved — no separate hit
  // target, and no "which part of the card do I press" to learn.
  const indexOfGradient = (id: string) =>
    slides.findIndex((s) => s.role === 'body' && gradients[s.slices[0]?.index]?.id === id)
  const { activeId, overId, getItemProps } = useReorderDrag({
    onReorder,
    onTap: (id) => {
      const i = indexOfGradient(id)
      if (i >= 0) onOpen(i)
    },
  })

  // Body slides carry the order, so the last one is the last thing a reader
  // sees before the summary — worth labelling.
  const bodyCount = slides.filter((s) => s.role === 'body').length

  return (
    <ol className={styles.sequence} data-testid="carousel-sequence" aria-label="Carousel slides">
      {slides.map((slide, i) => {
        const gradient = slide.role === 'body' ? gradients[slide.slices[0]?.index] : undefined
        const name = gradient
          ? gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
          : null
        const bodyIndex = slide.role === 'body' ? slide.slices[0]?.index ?? 0 : -1

        const badge =
          slide.role === 'cover'
            ? 'Cover'
            : slide.role === 'summary'
              ? 'Summary'
              : bodyIndex === 0
                ? 'Start'
                : bodyIndex === bodyCount - 1
                  ? 'End'
                  : null

        const dragProps = gradient ? getItemProps(gradient.id) : {}
        const className = [
          styles.item,
          slide.role === 'body' ? styles.itemBody : styles.itemFixed,
          gradient && activeId === gradient.id ? styles.itemActive : '',
          gradient && overId === gradient.id ? styles.itemOver : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <li
            key={`${slide.role}-${gradient?.id ?? i}`}
            className={className}
            data-testid="sequence-item"
            data-slide-role={slide.role}
            data-slide-id={gradient?.id}
            tabIndex={0}
            aria-label={
              gradient
                ? `Slide ${i + 1}, ${name}. Enter opens it, arrow keys reorder, Delete removes.`
                : `Slide ${i + 1}, ${badge}. Enter opens it.`
            }
            aria-keyshortcuts={gradient ? 'Enter ArrowLeft ArrowRight Delete' : 'Enter'}
            // The bookends have no drag to hang a tap off, so they carry a
            // plain click; the body slides get theirs from the drag hook.
            onClick={gradient ? undefined : () => onOpen(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(i)
                return
              }
              if (!gradient) return
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
            {...dragProps}
          >
            <div className={styles.frame}>
              <SlideCanvas
                slide={slide}
                gradients={gradients}
                parts={parts}
                ratio={ratio}
                framed={framed}
              />
              <span className={styles.number} aria-hidden="true">
                {i + 1}
              </span>
              {gradient && (
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => onRemove(gradient.id)}
                  aria-label={`Remove ${name} from the carousel`}
                  {...{ [NO_DRAG_ATTR]: '' }}
                >
                  ✕
                </button>
              )}
            </div>
            <span className={styles.caption}>
              {badge ? <span className={styles.badge}>{badge}</span> : <span className={styles.name}>{name}</span>}
            </span>
          </li>
        )
      })}

      {/* Adding lives here because this is where you find out you need it —
          you count the slides, decide it's thin, and want one more. */}
      <li className={styles.addItem}>
        <button type="button" className={styles.add} onClick={onAdd} data-testid="sequence-add">
          <span className={styles.plus} aria-hidden="true">
            +
          </span>
          <span className={styles.addLabel}>Add</span>
        </button>
      </li>
    </ol>
  )
}

interface SlideCanvasProps {
  slide: CarouselSlide
  gradients: Gradient[]
  parts: CaptionParts
  ratio: SlideRatio
  framed: boolean
}

/** One slide, through the same code path as the export, so what you drag
 * cannot disagree with the file you get. */
function SlideCanvas({ slide, gradients, parts, ratio, framed }: SlideCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = SLIDE_SIZES[ratio]
  const height = Math.round((PREVIEW_WIDTH * size.height) / size.width)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      renderSlide(canvas, slide, gradients, parts, PREVIEW_WIDTH, height, { framed, grain: false })
    } catch (e) {
      // jsdom and locked-down canvas contexts have no 2d surface; a blank
      // preview is the right degradation, not a crashed screen.
      console.warn('Slide preview render failed', e)
    }
  }, [slide, gradients, parts, framed, height])

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      aria-hidden="true"
    />
  )
}
