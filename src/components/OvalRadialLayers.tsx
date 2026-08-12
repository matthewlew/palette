import type { GradientStop } from '../lib/gradient'
import { getRadialConfig, sampleStops } from '../lib/gradient'
import { cropClipPath } from '../lib/gradientCrop'
import styles from './OvalRadialLayers.module.css'

interface OvalRadialLayersProps {
  stops: GradientStop[]
  angle?: number
  layerCount?: number
}

/**
 * Renders a radial gradient re-fit to an oval (superellipse, n=2.5) crop as a
 * concentric stack of superellipse-clipped layers, most saturated colour
 * innermost — the same nesting pattern TurrellSquare uses, because a plain
 * CSS radial-gradient can only emit elliptical isolines and would produce a
 * visible ring artifact inside a non-circular boundary (see
 * buildCroppedGradientCss).
 *
 * `clip-path` is applied AFTER `filter` in CSS, so a single element carrying
 * both a blur and a clip would have its blur thrown away by the re-clip —
 * each layer here is a clipped inner `div` wrapped by a blurred outer `div`,
 * split across two elements for that reason (same fix as Turrell's own blur).
 */
export function OvalRadialLayers({ stops, angle, layerCount = 24 }: OvalRadialLayersProps) {
  const origin = getRadialConfig(angle)
  const clip = cropClipPath('oval')
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const layers = Array.from({ length: layerCount }, (_, i) => {
    // Innermost (i=0) is the smallest, most saturated ring; outermost reaches
    // the crop boundary — mirrors turrellExtent's floor-to-1 ramp so the
    // innermost colour doesn't get swallowed by the blur.
    const t = i / (layerCount - 1)
    const factor = 0.08 + t * 0.92
    const hex = sampleStops(sorted, t)
    return { id: i, hex, factor }
  }).sort((a, b) => b.factor - a.factor)

  const originX = `${origin.px * 100}%`
  const originY = `${origin.py * 100}%`
  const reachX = Math.max(origin.px, 1 - origin.px)
  const reachY = Math.max(origin.py, 1 - origin.py)

  return (
    <div data-testid="oval-radial-layers" className={styles.container} style={{ clipPath: clip }}>
      {layers.map((layer) => (
        <div key={layer.id} data-testid="oval-radial-blur" className={styles.blurWrap}>
          <div
            data-testid="oval-radial-layer"
            className={styles.layer}
            style={{
              backgroundColor: layer.hex,
              width: `${2 * reachX * layer.factor * 100}%`,
              height: `${2 * reachY * layer.factor * 100}%`,
              left: originX,
              top: originY,
              clipPath: clip,
            }}
          />
        </div>
      ))}
    </div>
  )
}
