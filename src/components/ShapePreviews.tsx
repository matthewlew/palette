import { useRef } from 'react'
import { buildGradientCss } from '../lib/gradient'
import type { GradientStop } from '../lib/gradient'
import styles from './ShapePreviews.module.css'

interface ShapePreviewsProps {
  stops: GradientStop[]
  reversed?: boolean
  repeatEnabled?: boolean
  hardStops?: boolean
  /** The currently active shape key, if any — highlights that thumbnail. */
  activeShape?: string | null
  /** Called when the user taps a shape thumbnail. */
  onSelectShape?: (shape: string) => void
}

const SHAPES: { key: string; label: string; className: string }[] = [
  { key: 'full', label: 'Full', className: styles.full },
  { key: 'circle', label: 'Circle', className: styles.circle },
  { key: 'squircle', label: 'Squircle', className: styles.squircle },
  { key: 'diamond', label: 'Diamond', className: styles.diamond },
  { key: 'pill', label: 'Pill', className: styles.pill },
  { key: 'arch', label: 'Arch', className: styles.arch },
]

/** A row of small shape thumbnails that each show the current gradient
 * rendered inside a different geometric mask (circle, diamond, etc.).
 * Gives users a quick feel for how their palette will read at different
 * silhouettes. */
export function ShapePreviews({
  stops,
  reversed = false,
  repeatEnabled = false,
  hardStops = false,
  activeShape = null,
  onSelectShape,
}: ShapePreviewsProps) {
  const trayRef = useRef<HTMLDivElement>(null)

  function handleWheel(e: React.WheelEvent) {
    const el = trayRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }

  // Build the background CSS once — every thumbnail shares the same
  // gradient, just masked into different shapes.
  const gradientCss =
    stops.length >= 2
      ? buildGradientCss('linear', stops, reversed, {
          repeat: repeatEnabled,
          hard: hardStops,
        })
      : stops.length === 1
        ? stops[0].hex
        : 'transparent'

  return (
    <div ref={trayRef} className={styles.tray} onWheel={handleWheel} data-testid="shape-previews">
      {SHAPES.map(({ key, label, className }) => {
        const isActive = activeShape === key
        return (
          <button
            key={key}
            type="button"
            data-testid={`shape-${key}`}
            aria-pressed={isActive}
            className={isActive ? styles.thumbActive : styles.thumb}
            onClick={() => onSelectShape?.(key)}
          >
            <div className={`${styles.preview} ${className}`}>
              <div
                className={styles.shapeInner}
                style={{ backgroundImage: gradientCss }}
              />
            </div>
            <span className={styles.label}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
