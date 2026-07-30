import { useId } from 'react'
import { GLYPHS, type IconName } from './glyphs'
import { ICON_SIZES, type IconSize } from './sizes'

export type { IconName }

export type IconProps = {
  name: IconName
  /**
   * A step on the scale, or an exact pixel value where a container demands one.
   * Pass `null` to emit no width/height at all and let CSS size the element —
   * for icons positioned by a stylesheet rather than by their box.
   */
  size?: IconSize | number | null
  className?: string
  /**
   * Leave unset for decoration: the icon is then aria-hidden, on the assumption
   * that its control is already labelled. Set it only when the icon is the sole
   * carrier of the meaning.
   */
  label?: string
  style?: React.CSSProperties
  'data-testid'?: string
}

/**
 * Open Icons, rendered from generated path data.
 *
 * The markup goes in through dangerouslySetInnerHTML because 54 of the icons in
 * the set use a mask to hold a clearance — the moat where a mark crosses a wall
 * — and a mask needs an id. The ids are per-instance, so two copies of the same
 * icon on one page do not fight over one mask. The content is generated from
 * the icon library at build time; nothing user-supplied reaches it.
 *
 * Do NOT put LDS's `.lds-icon` class on one of these. That class sets
 * `stroke-width` from `--icon-weight`, which is right for the LDS sprite, where
 * every stroke is the same. Here the mask strokes run 5–6 units wide precisely
 * because that is what cuts the moat; forcing them to 2 fills the moats back in
 * and the crossing marks disappear into the walls they cross.
 */
export function Icon({
  name,
  size = 'md',
  className,
  label,
  style,
  'data-testid': testId,
}: IconProps) {
  // useId's output carries delimiters (":r3:") that have no business in an
  // attribute selector, so keep the word characters and drop the rest.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const glyph = GLYPHS[name]

  const px = size === null ? undefined : typeof size === 'number' ? size : ICON_SIZES[size]

  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      className={className}
      style={style}
      data-testid={testId}
      data-icon={name}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: glyph.replace(/\$\{u\}/g, uid) }}
    />
  )
}
