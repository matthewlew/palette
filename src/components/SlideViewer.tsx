import { useEffect, useRef } from 'react'
import type { Gradient } from '../store/types'
import type { CarouselSlide } from '../lib/carouselTemplates'
import type { CaptionParts } from '../lib/carouselCaption'
import { renderSlide, SLIDE_SIZES, type SlideRatio } from '../lib/carouselRender'
import styles from './SlideViewer.module.css'

interface SlideViewerProps {
  slides: CarouselSlide[]
  /** Which slide is on screen, as an index into `slides`. */
  index: number
  gradients: Gradient[]
  parts: CaptionParts
  ratio: SlideRatio
  framed: boolean
  onIndexChange: (index: number) => void
  onClose: () => void
}

/** Rendered near enough to export size that the grain, the type on the summary
 * tile and the seams between wheatpasted sheets are all judgeable — which is
 * the entire reason to open this. The strip's 300px previews are not. */
const VIEW_WIDTH = 1080

/**
 * One slide, full screen, at export fidelity.
 *
 * The sequence strip answers "what order is this in"; it cannot answer "is this
 * good", because at 100px a gradient is a colour and a summary tile is a grey
 * smudge. This is the check before saving: the same render the file will get,
 * big enough to actually look at.
 *
 * Paging left and right rather than closing and reopening, because the thing
 * you are really judging is the run — whether slide 4 sits well after slide 3.
 */
export function SlideViewer({
  slides,
  index,
  gradients,
  parts,
  ratio,
  framed,
  onIndexChange,
  onClose,
}: SlideViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const slide = slides[index]
  const size = SLIDE_SIZES[ratio]
  const height = Math.round((VIEW_WIDTH * size.height) / size.width)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !slide) return
    try {
      // Grain on, unlike the strip: it is part of the image, and judging the
      // image is the point.
      renderSlide(canvas, slide, gradients, parts, VIEW_WIDTH, height, { framed, grain: true })
    } catch (e) {
      console.warn('Slide render failed', e)
    }
  }, [slide, gradients, parts, framed, height])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
      else if (e.key === 'ArrowRight' && index < slides.length - 1) onIndexChange(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, slides.length, onIndexChange, onClose])

  if (!slide) return null

  const roleLabel =
    slide.role === 'cover' ? 'Cover' : slide.role === 'summary' ? 'Summary' : null

  return (
    <div className={styles.viewer} role="dialog" aria-modal="true" aria-label="Slide preview" data-testid="slide-viewer">
      {/* Tapping the surround closes, the way a lightbox does. */}
      <button
        type="button"
        className={styles.scrim}
        onClick={onClose}
        aria-label="Close slide preview"
        tabIndex={-1}
      />

      <header className={styles.bar}>
        <span className={styles.counter} data-testid="slide-viewer-counter">
          {index + 1} / {slides.length}
          {roleLabel && <span className={styles.badge}>{roleLabel}</span>}
        </span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close slide preview">
          ✕
        </button>
      </header>

      <div className={styles.stage}>
        <button
          type="button"
          className={styles.nav}
          onClick={() => onIndexChange(index - 1)}
          disabled={index === 0}
          aria-label="Previous slide"
          data-testid="slide-viewer-prev"
        >
          ‹
        </button>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
          aria-label={`Slide ${index + 1} of ${slides.length}`}
        />
        <button
          type="button"
          className={styles.nav}
          onClick={() => onIndexChange(index + 1)}
          disabled={index === slides.length - 1}
          aria-label="Next slide"
          data-testid="slide-viewer-next"
        >
          ›
        </button>
      </div>
    </div>
  )
}
