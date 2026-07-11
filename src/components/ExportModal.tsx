import { useState } from 'react'
import type { Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import { downloadVignettePng, VIGNETTE_SHAPES, type VignetteShape } from '../lib/vignette'
import { TurrellSquare } from './TurrellSquare'
import styles from './ExportModal.module.css'

interface ExportModalProps {
  gradient: Gradient
  onClose: () => void
}

interface ExportPreset {
  id: string
  label: string
  width: number
  height: number
  description: string
  aspectRatio: string
}

const PRESETS: ExportPreset[] = [
  {
    id: 'wallpaper',
    label: 'Phone Wallpaper',
    width: 1179,
    height: 2556,
    description: 'Perfect fit for iOS/Android Lock & Home screens',
    aspectRatio: '9:19.5',
  },
  {
    id: 'story',
    label: 'Instagram Story',
    width: 1080,
    height: 1920,
    description: 'Full-screen 9:16 layout for stories and reels',
    aspectRatio: '9:16',
  },
  {
    id: 'og',
    label: 'OG Image / Landscape',
    width: 1200,
    height: 630,
    description: 'Landscape 1.91:1 banner for links & social sharing',
    aspectRatio: '1.91:1',
  },
]

const SHAPE_PREVIEW_CLASS: Record<Exclude<VignetteShape, 'full'>, string> = {
  circle: styles.previewShapeCircle,
  oval: styles.previewShapeOval,
  diamond: styles.previewShapeDiamond,
  poster: styles.previewShapePoster,
}

const SHAPE_GLYPH_CLASS: Record<VignetteShape, string> = {
  full: styles.shapeGlyphFull,
  circle: styles.shapeGlyphCircle,
  oval: styles.shapeGlyphOval,
  diamond: styles.shapeGlyphDiamond,
  poster: styles.shapeGlyphPoster,
}

export function ExportModal({ gradient, onClose }: ExportModalProps) {
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [shape, setShape] = useState<VignetteShape>('full')

  const isSquare = gradient.type === 'square'
  const backgroundStyle = isSquare
    ? undefined
    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
      })

  async function handleExport(preset: ExportPreset) {
    if (exportingId) return
    setExportingId(preset.id)
    try {
      // Small timeout to let UI update and render the exporting state
      await new Promise((resolve) => setTimeout(resolve, 100))
      await downloadVignettePng(gradient, preset.width, preset.height, shape)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExportingId(null)
    }
  }

  const gradientLayer = (
    <div
      className={shape === 'full' ? undefined : `${styles.previewShape} ${SHAPE_PREVIEW_CLASS[shape as Exclude<VignetteShape, 'full'>]}`}
      style={shape === 'full' ? { position: 'absolute', inset: 0, backgroundImage: backgroundStyle } : { backgroundImage: backgroundStyle }}
    >
      {isSquare && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={8} />}
    </div>
  )

  return (
    <>
      <div className={styles.backdrop} onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        className={`${styles.modal} glass-surface`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Export ${gradient.name ?? 'gradient'} image`}
        data-testid="export-modal"
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close export menu">
          ✕
        </button>
        <h3 className={styles.title}>Export Image</h3>
        <p className={styles.subtitle}>Save &ldquo;{gradient.name ?? 'Untitled'}&rdquo; as a high-resolution PNG</p>

        <div className={styles.content}>
          {/* Gradient Preview Card */}
          <div className={styles.previewContainer}>
            <div className={`${styles.previewCard} ${shape !== 'full' ? styles.previewPaper : ''}`}>
              {gradientLayer}
              {shape === 'poster' && (
                <div className={styles.posterCaption}>
                  <span className={styles.posterTitle}>{gradient.name ?? 'Untitled'}</span>
                  <span className={styles.posterMeta}>
                    {gradient.type} gradient · {gradient.stops.length} colors
                  </span>
                </div>
              )}
            </div>
            {/* Vignette shape selector */}
            <div className={styles.shapeRow} role="radiogroup" aria-label="Vignette shape">
              {VIGNETTE_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={shape === s.id}
                  aria-label={`${s.label} vignette`}
                  title={s.label}
                  className={`${styles.shapeButton} ${shape === s.id ? styles.shapeButtonActive : ''}`}
                  onClick={() => setShape(s.id)}
                >
                  <span className={`${styles.shapeGlyph} ${SHAPE_GLYPH_CLASS[s.id]}`} />
                </button>
              ))}
            </div>
            <span className={styles.previewName}>{gradient.name ?? 'Untitled'}</span>
            <span className={styles.previewMeta}>
              {gradient.type[0].toUpperCase() + gradient.type.slice(1)} Gradient
            </span>
          </div>

          {/* Preset Options */}
          <div className={styles.presetsList}>
            {PRESETS.map((preset) => {
              const isExporting = exportingId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.presetButton}
                  onClick={() => handleExport(preset)}
                  disabled={exportingId !== null}
                >
                  <div className={styles.presetInfo}>
                    <span className={styles.presetLabel}>{preset.label}</span>
                    <span className={styles.presetDescription}>{preset.description}</span>
                  </div>
                  <div className={styles.presetMeta}>
                    <span className={styles.presetDim}>
                      {preset.width} × {preset.height} px
                    </span>
                    <span className={styles.presetRatio}>{preset.aspectRatio}</span>
                  </div>
                  {isExporting && <div className={styles.spinner} aria-label="Generating image..." />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
