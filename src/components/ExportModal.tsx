import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import { downloadVignettePng, type VignetteShape } from '../lib/vignette'
import { publishGradient } from '../lib/publishPalette'
import { TurrellSquare } from './TurrellSquare'
import { titleColorAt } from '../lib/titleColor'
import { namePalette } from '../lib/naming'
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
    id: 'post',
    label: 'Instagram Post',
    width: 1080,
    height: 1350,
    description: 'Portrait 4:5 layout for daily feed posts',
    aspectRatio: '4:5',
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
  const saveGradient = useAppStore((s) => s.saveGradient)

  const isSquare = gradient.type === 'square'
  const backgroundStyle = isSquare
    ? undefined
    : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
        repeat: gradient.repeatEnabled,
        hard: gradient.hardStops,
        smooth: gradient.smoothEnabled,
        prism: gradient.prismEnabled,
        rainbow: gradient.rainbowEnabled,
        ring: gradient.ringEnabled,
        fanAnchor: gradient.fanAnchor, angle: gradient.angle,
      })

  async function handleExport(preset: ExportPreset) {
    if (exportingId) return
    setExportingId(preset.id)
    try {
      saveGradient(gradient)
      // Also register it in the shared gallery so it's searchable later;
      // fire-and-forget so it never blocks the export.
      publishGradient(gradient).catch((err) => console.error('Publish on export failed', err))
      // Small timeout to let UI update and render the exporting state
      await new Promise((resolve) => setTimeout(resolve, 100))
      const targetShape: VignetteShape = preset.id === 'post' ? 'post' : 'full'
      await downloadVignettePng(gradient, preset.width, preset.height, targetShape)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExportingId(null)
    }
  }

  const titleColor = titleColorAt(gradient, 0.06, 0.5)

  const gradientLayer = (
    <div
      style={{ position: 'absolute', inset: 0, backgroundImage: backgroundStyle }}
    >
      {isSquare && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} blurPx={8} angle={gradient.angle} />}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: '6%',
          color: titleColor,
          fontFamily: 'var(--th-display)',
          fontWeight: 600,
          fontSize: '9px', // scaled down for preview
        }}
      >
        {gradient.name ?? namePalette(gradient.stops.map(s => s.hex))}
      </div>
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
        <p className={styles.subtitle}>Save &ldquo;{gradient.name ?? namePalette(gradient.stops.map(s => s.hex))}&rdquo; as a high-resolution PNG</p>

        <div className={styles.content}>
          {/* Gradient Preview Card */}
          <div className={styles.previewContainer}>
            <div className={styles.previewCard}>
              {gradientLayer}
            </div>
            <span className={styles.previewName}>{gradient.name ?? namePalette(gradient.stops.map(s => s.hex))}</span>
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
