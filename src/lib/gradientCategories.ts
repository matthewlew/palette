/**
 * Exploratory aesthetic-category taxonomy for the gradient A/B voting tool
 * (`GradientVote.tsx`). Purely descriptive right now — tags get attached to
 * votes so patterns can be checked later against `paletteScore.ts`'s
 * factors, not wired into scoring or generation.
 */
export interface GradientCategory {
  id: string
  label: string
  /** What this category should read as in existing OKLCH-measurable terms — shown as a hint while tagging. */
  hint: string
}

export const CATEGORIES: GradientCategory[] = [
  { id: 'y2k', label: 'Y2K', hint: 'high saturation, hard hue jumps, metallic duotone, few stops' },
  { id: 'impressionist', label: 'Impressionist', hint: 'close-but-distinct hues, soft/uneven stop spacing' },
  { id: 'caravaggio', label: 'Caravaggio', hint: 'extreme lightness range, near-monochrome hue, high contrast' },
  { id: 'pastel', label: 'Pastel', hint: 'light-skewed narrow lightness range, low saturation spread' },
  { id: 'vaporwave', label: 'Vaporwave', hint: 'wide hue span in cyan/magenta/purple, moderate-high saturation' },
  { id: 'editorial', label: 'Editorial / Muted', hint: 'low saturation spread, intentional near-grays' },
  { id: 'neon', label: 'Neon / Cyber', hint: 'high saturation spread, dark base with sharp bright accents' },
]
