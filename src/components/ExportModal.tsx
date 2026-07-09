import { useState } from 'react'
import type { Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import { downloadGradientAsPng } from '../lib/canvasExport'
import { TurrellSquare } from './TurrellSquare'
import { FlutedOverlay } from './FlutedOverlay'
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

export function ExportModal({ gradient, onClose }: ExportModalProps) {
  const [exportingId, setExportingId] = useState<string | null>(null)

  const isSquare = gradient.type === 'square'
  const backgroundStyle = isSquare
    ? undefined
    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
        smooth: gradient.smoothEnabled,
      })

  async function handleExport(preset: ExportPreset) {
    if (exportingId) return
    setExportingId(preset.id)
    try {
      // Small timeout to let UI update and render the exporting state
      await new Promise((resolve) => setTimeout(resolve, 100))
      await downloadGradientAsPng(gradient, preset.width, preset.height)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        className={`${styles.modal} glass-surface`}
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
            <div
              className={styles.previewCard}
              style={{ backgroundImage: backgroundStyle }}
            >
              {isSquare && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={8} />}
              <FlutedOverlay visible={!!gradient.flutedEnabled} />
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
