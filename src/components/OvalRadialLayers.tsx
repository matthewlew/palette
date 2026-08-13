import type { GradientStop } from '../lib/gradient'
import { getRadialConfig, resolvedCssStops, sampleStops, sampleStopsCss } from '../lib/gradient'
import { cropClipPath, cropRadialExtent } from '../lib/gradientCrop'
import { FIDELITY_SAMPLING, type LayerSamplingConfig } from '../lib/layerSampling'
import styles from './OvalRadialLayers.module.css'

interface OvalRadialLayersProps {
  stops: GradientStop[]
  angle?: number
  reversed?: boolean
  repeatEnabled?: boolean
  hardStops?: boolean
  smoothEnabled?: boolean
  /** Shorthand for `sampling.layerCount` — surfaces the one knob small tiles
   * already tune. */
  layerCount?: number
  sampling?: Partial<LayerSamplingConfig>
}

/**
 * Renders a radial gradient re-fit to an oval (superellipse, n=2.5) crop as a
 * concentric stack of superellipse-clipped layers, most saturated colour
 * innermost — because a plain CSS radial-gradient can only emit elliptical
 * isolines and would produce a visible ring artifact inside a non-circular
 * boundary (see buildCroppedGradientCss).
 *
 * `clip-path` is applied AFTER `filter` in CSS, so a single element carrying
 * both a blur and a clip would have its blur thrown away by the re-clip —
 * each layer here is a clipped inner `div` wrapped by a blurred outer `div`,
 * split across two elements for that reason (same fix as Turrell's own blur).
 */
export function OvalRadialLayers({
  stops,
  angle,
  reversed = false,
  repeatEnabled,
  hardStops,
  smoothEnabled,
  layerCount,
  sampling,
}: OvalRadialLayersProps) {
  const config: LayerSamplingConfig = {
    ...FIDELITY_SAMPLING,
    ...(layerCount != null ? { layerCount } : null),
    ...sampling,
  }
  const sample = config.space === 'css' ? sampleStopsCss : sampleStops
  const origin = getRadialConfig(angle)
  const clip = cropClipPath('oval')
  // Same ramp the CSS path would paint, so an oval crop's colours match the
  // rectangle crop's for identical stops.
  const ramp = resolvedCssStops(stops, reversed, {
    repeat: repeatEnabled,
    hard: hardStops,
    smooth: smoothEnabled,
  })
  // A single extent (not a per-axis reach): the isolines of a radial inside a
  // curved crop must stay similar to the crop's own curve — see
  // cropRadialExtent.
  const reach = cropRadialExtent('oval', origin.px, origin.py)
  const layers = Array.from({ length: config.layerCount }, (_, i) => {
    const t = i / (config.layerCount - 1)
    return { id: i, hex: sample(ramp, t), factor: t }
  })
    .filter((l) => l.factor > 0)
    .sort((a, b) => b.factor - a.factor)

  const originX = `${origin.px * 100}%`
  const originY = `${origin.py * 100}%`

  return (
    <div
      data-testid="oval-radial-layers"
      className={styles.container}
      // Painted in the outermost colour so the boundary has no hairline gap
      // where the largest layer's blur falls off.
      style={{ clipPath: clip, backgroundColor: sample(ramp, 1) }}
    >
      {layers.map((layer) => (
        <div key={layer.id} data-testid="oval-radial-blur" className={styles.blurWrap}>
          <div
            data-testid="oval-radial-layer"
            className={styles.layer}
            style={{
              backgroundColor: layer.hex,
              width: `${2 * reach * layer.factor * 100}%`,
              height: `${2 * reach * layer.factor * 100}%`,
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
