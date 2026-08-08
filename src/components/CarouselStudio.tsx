import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, pickedCarouselGradients } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import {
  buildCarousel,
  templatesForCount,
  CAROUSEL_TEMPLATES,
  MAX_SLIDES,
} from '../lib/carouselTemplates'
import { buildCaption, captionParts, CAPTION_MAX } from '../lib/carouselCaption'
import { renderSlide, SLIDE_SIZES, type SlideRatio } from '../lib/carouselRender'
import { downloadCarouselZip } from '../lib/carouselExport'
import { CarouselTray } from './CarouselTray'
import styles from './CarouselStudio.module.css'

interface CarouselStudioProps {
  onClose: () => void
}

/** Preview canvases render at a fraction of export size — a nine-slide framed
 * preview at 1080px is seconds of work for pixels nobody sees at 150px wide. */
const PREVIEW_WIDTH = 300

/**
 * Assembles picked gradients into an Instagram carousel: choose a template for
 * the count you have, reorder the slides, and export the PNGs plus a
 * ready-to-paste caption.
 *
 * The studio is deliberately driven off pick *order* rather than a grid the
 * user arranges directly — order is the one thing that has to survive into the
 * export, and a list you can drag is far easier to get right than a mosaic you
 * position by hand.
 */
export function CarouselStudio({ onClose }: CarouselStudioProps) {
  const saved = useAppStore((s) => s.saved)
  const picks = useAppStore((s) => s.carouselPicks)
  const toggleCarouselPick = useAppStore((s) => s.toggleCarouselPick)
  const reorderCarouselPick = useAppStore((s) => s.reorderCarouselPick)
  const moveCarouselPick = useAppStore((s) => s.moveCarouselPick)
  const clearCarouselPicks = useAppStore((s) => s.clearCarouselPicks)

  const gradients = useMemo(() => pickedCarouselGradients(saved, picks), [saved, picks])
  const count = gradients.length

  const [ratio, setRatio] = useState<SlideRatio>('portrait')
  const [framed, setFramed] = useState(false)
  const [captionTile, setCaptionTile] = useState(true)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [templateId, setTemplateId] = useState('bars')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const copy = useCopyFeedback()

  const available = useMemo(() => templatesForCount(count), [count])

  // Changing the pick count can strip the chosen template out from under you
  // (Grid is gone at 5 picks). Fall back to the first template that fits
  // rather than previewing a template that can no longer hold the set.
  useEffect(() => {
    if (available.length === 0) return
    if (!available.some((t) => t.id === templateId)) {
      setTemplateId(available[0].id)
    }
  }, [available, templateId])

  const slides = useMemo(
    () => buildCarousel(templateId, count, { captionTile }),
    [templateId, count, captionTile]
  )

  const captionOptions = useMemo(() => ({ title, note }), [title, note])
  const parts = useMemo(() => captionParts(gradients, captionOptions), [gradients, captionOptions])
  const caption = useMemo(
    () => buildCaption(gradients, captionOptions),
    [gradients, captionOptions]
  )

  async function handleExport() {
    if (exporting || slides.length === 0) return
    setExporting(true)
    setProgress({ done: 0, total: slides.length })
    try {
      await downloadCarouselZip(
        {
          templateId,
          gradients,
          ratio,
          style: { framed, grain: true },
          caption: captionOptions,
          carousel: { captionTile },
        },
        (done, total) => setProgress({ done, total })
      )
    } catch (e) {
      console.error('Carousel export failed', e)
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  async function handleCopyCaption() {
    try {
      await copy.copy(caption)
    } catch (e) {
      console.warn('Caption copy failed', e)
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        className={`${styles.modal} glass-surface`}
        role="dialog"
        aria-modal="true"
        aria-label="Carousel studio"
        data-testid="carousel-studio"
      >
        <header className={styles.header}>
          <div>
            <h3 className={styles.title}>Carousel Studio</h3>
            <p className={styles.subtitle}>
              {count === 0
                ? 'Pick gradients in the Gallery to start'
                : `${count} picked · ${slides.length} slide${slides.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close carousel studio">
            ✕
          </button>
        </header>

        {count === 0 ? (
          <div className={styles.empty}>
            <p>
              Tap <strong>Select</strong> in the Gallery header, then tap gradients in the order you
              want them to appear. They collect in the tray at the bottom, where you can reorder
              them.
            </p>
          </div>
        ) : (
          <div className={styles.body}>
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Order</h4>
              <CarouselTray
                gradients={gradients}
                onRemove={toggleCarouselPick}
                onReorder={reorderCarouselPick}
                onMove={moveCarouselPick}
              />
              <button type="button" className={styles.linkBtn} onClick={clearCarouselPicks}>
                Clear all
              </button>
            </section>

            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Template</h4>
              <div className={styles.templateGrid}>
                {CAROUSEL_TEMPLATES.map((template) => {
                  const enabled = available.some((t) => t.id === template.id)
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={
                        template.id === templateId ? styles.templateCardActive : styles.templateCard
                      }
                      onClick={() => setTemplateId(template.id)}
                      disabled={!enabled}
                      title={
                        enabled
                          ? template.description
                          : `Needs ${template.minCount}–${template.maxCount} picks`
                      }
                    >
                      <span className={styles.templateLabel}>{template.label}</span>
                      <span className={styles.templateDesc}>{template.description}</span>
                    </button>
                  )
                })}
              </div>
              {available.length === 0 && (
                <p className={styles.warn}>
                  No template fits {count} picks — carousels top out at {MAX_SLIDES} slides.
                </p>
              )}
            </section>

            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Format</h4>
              <div className={styles.chipRow}>
                {(Object.keys(SLIDE_SIZES) as SlideRatio[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={id === ratio ? styles.chipActive : styles.chip}
                    onClick={() => setRatio(id)}
                  >
                    {SLIDE_SIZES[id].label}
                  </button>
                ))}
              </div>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={framed ? styles.chipActive : styles.chip}
                  onClick={() => setFramed((v) => !v)}
                  aria-pressed={framed}
                >
                  Framed
                </button>
                <button
                  type="button"
                  className={captionTile ? styles.chipActive : styles.chip}
                  onClick={() => setCaptionTile((v) => !v)}
                  aria-pressed={captionTile}
                >
                  Caption tile
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Preview</h4>
              <div className={styles.slideStrip} data-testid="carousel-preview">
                {slides.map((slide, i) => (
                  <SlidePreview
                    key={`${templateId}-${i}-${slide.kind}`}
                    slide={slide}
                    gradients={gradients}
                    parts={parts}
                    ratio={ratio}
                    framed={framed}
                    index={i}
                    role={i === 0 ? 'Start' : i === slides.length - 1 ? 'End' : null}
                  />
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Caption</h4>
              <input
                className={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={parts.title}
                aria-label="Carousel title"
              />
              <textarea
                className={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a line of your own (optional)"
                aria-label="Caption note"
                rows={2}
              />
              <pre className={styles.captionPreview} data-testid="caption-preview">
                {caption}
              </pre>
              <div className={styles.captionMeta}>
                <span>
                  {caption.length} / {CAPTION_MAX}
                </span>
                <button type="button" className={styles.linkBtn} onClick={handleCopyCaption}>
                  {copy.copied ? 'Copied' : 'Copy caption'}
                </button>
              </div>
            </section>
          </div>
        )}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={exporting || slides.length === 0}
          >
            {progress
              ? `Rendering ${progress.done}/${progress.total}…`
              : `Export ${slides.length} slide${slides.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </>
  )
}

interface SlidePreviewProps {
  slide: ReturnType<typeof buildCarousel>[number]
  gradients: Gradient[]
  parts: ReturnType<typeof captionParts>
  ratio: SlideRatio
  framed: boolean
  index: number
  /** 'Start' or 'End' for the two slides that carry a carousel — the hook and
   * the one people are left looking at. */
  role: 'Start' | 'End' | null
}

/** One slide, rendered through the same code path as the export so the preview
 * cannot disagree with the file you get. */
function SlidePreview({ slide, gradients, parts, ratio, framed, index, role }: SlidePreviewProps) {
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
      // preview is the right degradation, not a crashed modal.
      console.warn('Slide preview render failed', e)
    }
  }, [slide, gradients, parts, framed, height])

  return (
    <figure className={styles.slide}>
      <canvas
        ref={canvasRef}
        className={styles.slideCanvas}
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
        aria-label={`Slide ${index + 1}`}
      />
      <figcaption className={styles.slideCaption}>
        {index + 1}
        {slide.kind === 'caption' && <span className={styles.slideTag}>Caption</span>}
        {role && <span className={styles.slideTag}>{role}</span>}
      </figcaption>
    </figure>
  )
}
