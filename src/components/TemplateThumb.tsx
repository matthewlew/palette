import type { Gradient } from '../store/types'
import { tileBackground } from '../lib/tileBackground'
import type { CarouselSlide } from '../lib/carouselTemplates'
import styles from './TemplateThumb.module.css'

interface TemplateThumbProps {
  /** The template's COVER slide — slide 1, the one the layout is really
   * about. A template that then emits one slide per gradient is described by
   * `extraSlides`, not by drawing all of them. */
  slide: CarouselSlide
  gradients: Gradient[]
  extraSlides?: number
}

/**
 * A live miniature of what a template will produce, drawn from the same slice
 * rects the exporter uses.
 *
 * Built from the real arrangement and the real picked gradients rather than a
 * hand-drawn icon, so it cannot fall out of step with the export: change the
 * layout maths and every preview follows. It is also why the picker no longer
 * has to gate which counts a template will accept — you can see a ragged grid
 * or a lopsided paste-up and judge it yourself.
 *
 * DOM rather than canvas: at this size there are a handful of rects, and a div
 * per slice costs nothing next to a canvas context per card.
 */
export function TemplateThumb({ slide, gradients, extraSlides = 0 }: TemplateThumbProps) {
  return (
    <div
      className={styles.thumb}
      aria-hidden="true"
      data-testid="template-thumb"
    >
      <div className={styles.stage}>
        {slide.slices.map((slice, i) => {
          const gradient = gradients[slice.index]
          if (!gradient) return null
          return (
            <div
              key={i}
              className={slide.overlap ? styles.pastedSlice : styles.slice}
              style={{
                left: `${slice.x * 100}%`,
                top: `${slice.y * 100}%`,
                width: `${slice.w * 100}%`,
                height: `${slice.h * 100}%`,
                transform: slice.rotate ? `rotate(${slice.rotate}deg)` : undefined,
                // A Turrell square has no CSS gradient form (see
                // tileBackground); at 46px its innermost colour is a fair
                // stand-in, and the slide preview below shows the real thing.
                backgroundImage: tileBackground(gradient),
                backgroundColor: gradient.stops[gradient.stops.length - 1]?.hex,
              }}
            />
          )
        })}
      </div>
      {extraSlides > 0 && <span className={styles.more}>+{extraSlides}</span>}
    </div>
  )
}
