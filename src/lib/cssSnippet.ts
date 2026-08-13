import { buildGradientCss, type GradientStop } from './gradient'
import type { Gradient } from '../store/types'

/**
 * The gradient as a CSS declaration you can paste into a stylesheet.
 *
 * Everything the app renders with `background-image` round-trips exactly. The
 * Turrell square does not: it is a stack of blurred, absolutely-positioned
 * elements (see TurrellSquare), and no single CSS value reproduces it. Rather
 * than hand someone a snippet that quietly doesn't match what they were
 * looking at, that case is labelled as the approximation it is — a radial with
 * the same stops and origin, which is the closest one-declaration equivalent.
 */
export function gradientCssSnippet(gradient: Gradient, stops: GradientStop[]): string {
  const filters = {
    repeat: gradient.repeatEnabled,
    hard: gradient.hardStops,
    smooth: gradient.smoothEnabled,
    prism: gradient.prismEnabled,
    fanAnchor: gradient.fanAnchor,
    angle: gradient.angle,
  }

  if (gradient.type === 'square') {
    const approximation = buildGradientCss('radial', stops, gradient.reversed, filters)
    return [
      '/* Turrell is drawn as layered squares — CSS has no single-value',
      '   equivalent. This radial is the closest one. */',
      `background-image: ${approximation};`,
    ].join('\n')
  }

  return `background-image: ${buildGradientCss(gradient.type, stops, gradient.reversed, filters)};`
}
