import { Icon, type IconName, type IconProps } from './Icon'

export type IconSwapProps = {
  /** Icon shown when `active` is false. */
  a: IconName
  /** Icon shown when `active` is true. */
  b: IconName
  active: boolean
  size?: IconProps['size']
  label?: string
  className?: string
}

/**
 * Two-icon toggle that crossfades via the `.t-icon-swap` transition (see
 * index.css) instead of snapping between glyphs. Swap in for any
 * `<Icon name={cond ? 'x' : 'y'} />` toggle.
 */
export function IconSwap({ a, b, active, size = 'sm', label, className }: IconSwapProps) {
  return (
    <span className={`t-icon-swap${className ? ` ${className}` : ''}`} data-state={active ? 'b' : 'a'}>
      <span className="t-icon" data-icon="a">
        <Icon name={a} size={size} label={active ? undefined : label} />
      </span>
      <span className="t-icon" data-icon="b">
        <Icon name={b} size={size} label={active ? label : undefined} />
      </span>
    </span>
  )
}
