import type { GradientStop } from '../lib/gradient'
import { repeatedStops, getRadialConfig, turrellExtent, TURRELL_SOFTNESS_PERCENT } from '../lib/gradient'
import { cropClipPath, type GradientCrop } from '../lib/gradientCrop'
import styles from './TurrellSquare.module.css'

interface TurrellSquareProps {
  stops: GradientStop[]
  reversed?: boolean
  blurPx?: number
  repeatEnabled?: boolean
  /** Origin of the nested squares, mirroring the radial rotate cycle: undefined
   * = centered; a degree (0/45/…/315) anchors the nest at that edge/corner. */
  angle?: number
  /** Circle/oval crop the nest re-fits to. Extents transfer as-is (per the
   * crop design), but each square layer needs its own clip to the crop's
   * boundary curve — an ambient clip-path on a distant ancestor would still
   * cut the shape correctly, but it also hard-crops each layer's blur right
   * at the boundary. Splitting blur (wrapper) from clip (layer), the same way
   * OvalRadialLayers does, keeps the blur soft past the crop edge. */
  crop?: GradientCrop
}

export function TurrellSquare({ stops: initialStops, reversed = false, blurPx, repeatEnabled = false, angle, crop }: TurrellSquareProps) {
  const stops = repeatEnabled ? repeatedStops(initialStops) : initialStops

  // Where the nested squares converge. Center (undefined) keeps the classic
  // Turrell; an angle shifts the shared center to that edge/corner so the
  // smallest square hugs the origin — the square analogue of a radial origin.
  const origin = getRadialConfig(angle)
  const originX = `${origin.px * 100}%`
  const originY = `${origin.py * 100}%`

  // Reach to the farthest edge on each axis from the origin. A centered origin
  // gives 0.5 (the classic square that just fills the canvas); an edge/corner
  // origin grows toward 1.0 so the outermost square still spans the whole
  // canvas — the way an off-center radial gradient still reaches the farthest
  // corner instead of leaving a flat band of the last color.
  const reachX = Math.max(origin.px, 1 - origin.px)
  const reachY = Math.max(origin.py, 1 - origin.py)

  // To match radial gradients, position 0 is the center (innermost) and position 100
  // is the edge (outermost). reversed swaps which color fills which stop.
  const hexes = reversed ? [...stops].map((s) => s.hex).reverse() : stops.map((s) => s.hex)

  // Each stop's half-extent scales with position, from TURRELL_EXTENT_FLOOR of
  // the reach at pos 0 up to the full reach at pos 100; the size is that
  // half-extent doubled and taken per-axis so the nest fills the canvas from any
  // origin. turrellExtent is shared with the sampler and the PNG export.
  const layers = stops.map((stop, i) => {
    const factor = turrellExtent(stop.position, stops.length)
    // Round to shed floating-point noise (0.2 + 0.16 = 0.36000…1) so the inline
    // sizes stay tidy.
    const round = (n: number) => Math.round(n * 1e4) / 1e4
    return {
      id: i,
      hex: hexes[i],
      factor,
      widthPercent: round(2 * reachX * factor * 100),
      heightPercent: round(2 * reachY * factor * 100),
    }
  })

  // To prevent smaller inner layers from being covered by larger outer layers, we must
  // render them in DOM order from largest to smallest (descending size).
  const sortedLayers = [...layers].sort((a, b) => b.factor - a.factor)
  const outerHex = sortedLayers.length > 0 ? sortedLayers[0].hex : 'transparent'

  // Cropped (circle/oval): the outer fill is clipped too, so the ambient
  // --crop-backdrop behind the preview shows through the corners instead of
  // this rectangle's own color painting over it.
  const clip = crop && crop !== 'rectangle' ? cropClipPath(crop) : undefined

  return (
    // The container is painted in the outermost layer's color to prevent stale
    // texture gaps at the edges when the blurred layers are GPU composited.
    <div
      data-testid="turrell-square"
      className={styles.container}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: outerHex,
        clipPath: clip,
      }}
    >
      {sortedLayers.map((layer, index) => {
        const isOutermost = index === 0
        // When blurPx is explicit, the caller has tuned it in px for its own
        // container size and the bleed matches in px. Left undefined, the
        // layer falls back to the CSS module's proportional default blur, so
        // the bleed has to be proportional too — a flat px bleed here would
        // silently reintroduce the resolution-dependence the CSS default was
        // fixed to avoid.
        const bleedPercent = blurPx == null ? TURRELL_SOFTNESS_PERCENT * 4 : undefined
        const bleedPx = blurPx != null ? blurPx * 4 : undefined
        const width = isOutermost
          ? bleedPercent != null
            ? `calc(${layer.widthPercent}% + ${bleedPercent}%)`
            : `calc(${layer.widthPercent}% + ${bleedPx}px)`
          : `${layer.widthPercent}%`
        const height = isOutermost
          ? bleedPercent != null
            ? `calc(${layer.heightPercent}% + ${bleedPercent}%)`
            : `calc(${layer.heightPercent}% + ${bleedPx}px)`
          : `${layer.heightPercent}%`
        const filter = blurPx != null ? `blur(${blurPx}px)` : undefined
        // No crop: same single-element layer as before (clip-path runs after
        // filter, so a plain layer with only its own default/inline blur is
        // unaffected either way). Cropped: split blur (wrapper, unclipped) from
        // clip (inner layer) so the blur stays soft past the crop boundary
        // instead of being hard-cut by a clip-path on the same blurred element.
        if (!clip) {
          return (
            <div
              key={layer.id}
              data-testid="turrell-layer"
              className={styles.layer}
              style={{
                backgroundColor: layer.hex,
                width,
                height,
                left: originX,
                top: originY,
                filter,
              }}
            />
          )
        }
        return (
          <div
            key={layer.id}
            data-testid="turrell-layer-blur"
            style={{
              position: 'absolute',
              inset: 0,
              filter: filter ?? `blur(${TURRELL_SOFTNESS_PERCENT}cqmin)`,
            }}
          >
            <div
              data-testid="turrell-layer"
              className={styles.layerClipped}
              style={{
                backgroundColor: layer.hex,
                width,
                height,
                left: originX,
                top: originY,
                clipPath: clip,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
