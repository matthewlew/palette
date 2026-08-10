import { useEffect, useMemo, useState } from 'react'
import { useAppStore, pickedCarouselGradients } from '../store/useAppStore'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import {
  buildCarousel,
  coverStylesForCount,
  COVER_STYLES,
  maxPicksFor,
  MAX_SLIDES,
  type CoverStyle,
} from '../lib/carouselTemplates'
import { buildCaption, captionParts, CAPTION_MAX } from '../lib/carouselCaption'
import { SLIDE_SIZES, type SlideRatio } from '../lib/carouselRender'
import { exportCarousel } from '../lib/carouselExport'
import { CarouselSequence } from './CarouselSequence'
import { SlideViewer } from './SlideViewer'
import { TemplateThumb } from './TemplateThumb'
import styles from './CarouselStudio.module.css'

interface CarouselStudioProps {
  /** Leave the flow entirely, back to the Gallery with picks intact. */
  onClose: () => void
  /** Back to the Gallery to add more picks, with the dock still up. */
  onAddMore: () => void
}

/**
 * The carousel editor: a full-screen curation session.
 *
 * Full-screen, with the app's own tab bar hidden, because this is a
 * create-a-post flow — one screen with one intention. Leaving it half-modal
 * over a Gallery meant the Gallery and Create tabs stayed live underneath, so
 * the surface offered two ways to abandon the thing you were in the middle of
 * making. A curation session should have one exit, and it should be labelled.
 *
 * The screen is one sequence of slides plus the switches that change it. There
 * is no separate "order" list and no separate "preview": they were the same
 * sequence drawn twice, and they disagreed about what a slide was as soon as a
 * cover was involved.
 */
export function CarouselStudio({ onClose, onAddMore }: CarouselStudioProps) {
  const saved = useAppStore((s) => s.saved)
  const picks = useAppStore((s) => s.carouselPicks)
  const toggleCarouselPick = useAppStore((s) => s.toggleCarouselPick)
  const reorderCarouselPick = useAppStore((s) => s.reorderCarouselPick)
  const moveCarouselPick = useAppStore((s) => s.moveCarouselPick)
  const setStudioOpen = useAppStore((s) => s.setCarouselStudioOpen)

  // App owns the tab bar and has to hide it for the duration of the session,
  // so the flag is shared. Raised and lowered here rather than by whoever
  // renders the studio: tying it to this component's own lifetime is what
  // makes it impossible to unmount the studio and leave the tab bar hidden
  // with nothing on screen to bring it back.
  useEffect(() => {
    setStudioOpen(true)
    return () => setStudioOpen(false)
  }, [setStudioOpen])

  const gradients = useMemo(() => pickedCarouselGradients(saved, picks), [saved, picks])
  const count = gradients.length

  const [ratio, setRatio] = useState<SlideRatio>('portrait')
  const [framed, setFramed] = useState(false)
  const [summary, setSummary] = useState(true)
  const [cover, setCover] = useState<CoverStyle | null>('stack')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  /** Index into `slides` of the slide being viewed full screen, or null. */
  const [viewing, setViewing] = useState<number | null>(null)
  const copy = useCopyFeedback()

  const availableCovers = useMemo(() => coverStylesForCount(count), [count])

  // Changing the pick count can strip the chosen cover style out from under you
  // — Grid can't hold two picks. Fall back to one that fits rather than leaving
  // a switch on that silently does nothing.
  useEffect(() => {
    if (!cover) return
    if (!availableCovers.some((s) => s.id === cover)) {
      setCover(availableCovers[0]?.id ?? null)
    }
  }, [availableCovers, cover])

  const carouselOptions = useMemo(() => ({ cover, summary }), [cover, summary])
  const slides = useMemo(
    () => buildCarousel(count, carouselOptions),
    [count, carouselOptions]
  )

  const captionOptions = useMemo(() => ({ title, note }), [title, note])
  const parts = useMemo(() => captionParts(gradients, captionOptions), [gradients, captionOptions])
  const caption = useMemo(() => buildCaption(gradients, captionOptions), [gradients, captionOptions])

  // The 20-slide ceiling is Instagram's, and turning on a bookend spends one of
  // them — worth saying out loud rather than silently dropping the last pick.
  const overflow = count - maxPicksFor(carouselOptions)

  async function handleExport() {
    if (exporting || slides.length === 0) return
    setExporting(true)
    setStatus(null)
    setProgress({ done: 0, total: slides.length })
    try {
      const result = await exportCarousel(
        {
          gradients,
          ratio,
          style: { framed, grain: true },
          caption: captionOptions,
          carousel: carouselOptions,
        },
        (rendered, total) => setProgress({ done: rendered, total })
      )
      // Where the files went is genuinely different per device, and guessing
      // wrong sends someone hunting in the wrong app.
      if (result.delivery === 'shared') {
        setStatus(`Shared ${result.count} images — pick “Save Images” to send them to Photos.`)
      } else if (result.delivery === 'downloaded') {
        setStatus(`Saved ${result.count} images, numbered in slide order.`)
      }
    } catch (e) {
      console.error('Carousel export failed', e)
      setStatus('Export failed — try again.')
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
    <div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-label="Carousel studio"
      data-testid="carousel-studio"
    >
      <header className={styles.header}>
        <button type="button" className={styles.close} onClick={onClose}>
          Cancel
        </button>
        <div className={styles.heading}>
          <h3 className={styles.title}>New carousel</h3>
          <p className={styles.subtitle}>
            {slides.length} slide{slides.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className={styles.save}
          onClick={handleExport}
          disabled={exporting || slides.length === 0}
        >
          {progress ? `${progress.done}/${progress.total}` : 'Save'}
        </button>
      </header>

      {count === 0 ? (
        <div className={styles.empty}>
          <p>Nothing picked yet.</p>
          <button type="button" className={styles.emptyAdd} onClick={onAddMore}>
            Pick gradients
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          {/* The canvas: what the carousel actually looks like. Same role as
              EditMode's preview pane — the thing you're making stays the main
              event, and every switch that changes it lives in the panel
              beside it instead of interrupting the view. */}
          <div className={styles.canvasArea}>
            <p className={styles.hint}>Tap a slide to see it full screen. Drag one to reorder.</p>
            <CarouselSequence
              slides={slides}
              gradients={gradients}
              parts={parts}
              ratio={ratio}
              framed={framed}
              onRemove={toggleCarouselPick}
              onReorder={reorderCarouselPick}
              onMove={moveCarouselPick}
              onAdd={onAddMore}
              onOpen={setViewing}
            />
            {overflow > 0 && (
              <p className={styles.warn} data-testid="overflow-warning">
                Instagram allows {MAX_SLIDES} slides. The last {overflow} pick
                {overflow === 1 ? '' : 's'} won’t be included.
              </p>
            )}
          </div>

          {/* Everything that changes the canvas, not the canvas itself — same
              split as EditMode's side panel. */}
          <div className={styles.panel}>
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Bookends</h4>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={cover ? styles.chipActive : styles.chip}
                  onClick={() => setCover(cover ? null : (availableCovers[0]?.id ?? null))}
                  disabled={availableCovers.length === 0}
                  aria-pressed={!!cover}
                >
                  Add cover slide
                </button>
                <button
                  type="button"
                  className={summary ? styles.chipActive : styles.chip}
                  onClick={() => setSummary((v) => !v)}
                  aria-pressed={summary}
                >
                  Add summary slide
                </button>
              </div>

              {/* Only once a cover is on: the style is a detail of a thing you
                  have already decided you want. */}
              {cover && (
                <div className={styles.coverGrid}>
                  {COVER_STYLES.map((style) => {
                    const enabled = availableCovers.some((s) => s.id === style.id)
                    // Preview at this style's own nearest workable count, so a
                    // card you can't pick yet still shows what it would do.
                    const previewCount = Math.min(Math.max(count, style.minCount), style.maxCount)
                    return (
                      <button
                        key={style.id}
                        type="button"
                        className={style.id === cover ? styles.coverCardActive : styles.coverCard}
                        onClick={() => setCover(style.id)}
                        disabled={!enabled}
                        title={enabled ? style.description : `Needs ${style.minCount}–${style.maxCount} picks`}
                      >
                        <TemplateThumb slide={style.build(previewCount)} gradients={gradients} />
                        <span className={styles.coverText}>
                          <span className={styles.coverLabel}>{style.label}</span>
                          <span className={styles.coverDesc}>{style.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
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
                <button
                  type="button"
                  className={framed ? styles.chipActive : styles.chip}
                  onClick={() => setFramed((v) => !v)}
                  aria-pressed={framed}
                >
                  Framed
                </button>
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
        </div>
      )}

      {viewing !== null && (
        <SlideViewer
          slides={slides}
          index={Math.min(viewing, slides.length - 1)}
          gradients={gradients}
          parts={parts}
          ratio={ratio}
          framed={framed}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
        />
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
            : `Save ${slides.length} image${slides.length === 1 ? '' : 's'}`}
        </button>
        {status && (
          <p className={styles.done} role="status" data-testid="export-status">
            {status}
          </p>
        )}
      </footer>
    </div>
  )
}
