/**
 * One size scale, four steps.
 *
 * Before Open Icons landed, the app drew icons at 10, 14, 15, 16, 18 and 20 px
 * with stroke widths of 1.9, 2, 2.2, 2.4 and 2.5 — six sizes and five weights
 * across twenty icons, which is what made a row of them look unrelated. The
 * glyphs now carry a single stroke, so size is the only dial left, and it moves
 * in steps of four.
 */
export const ICON_SIZES = {
  xs: 12, // inline with text, or riding on a swatch
  sm: 16, // dense controls: list rows, segmented toggles
  md: 20, // the default, and what LDS's --icon-size resolves to here
  lg: 24,
} as const

export type IconSize = keyof typeof ICON_SIZES
