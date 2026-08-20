import { buildGradientCss, type GradientStop, type GradientType } from '../lib/gradient'
import { TurrellSquare } from './TurrellSquare'

interface GradientPreviewProps {
  shape: GradientType
  stops: GradientStop[]
  smooth?: boolean
}

/**
 * Renders a gradient candidate for voting, matching how Gallery.tsx/
 * Leaderboard.tsx tiles already render 'square' — as TurrellSquare's
 * layered DOM, not a single CSS background.
 *
 * buildGradientCss's 'square' case (buildSquareGradient) is a hard-stop
 * conic-gradient fallback for contexts that need one CSS string (e.g. PNG
 * export) — it reads as pie-chart wedges, not nested squares, and was
 * being used directly for voting's preview panes, which made a 'square'
 * candidate visually indistinguishable from a hard-mode angular one while
 * still labeled "square". Every other shape has an exact single-gradient
 * CSS representation, so it renders via buildGradientCss as before.
 */
export function GradientPreview({ shape, stops, smooth = false }: GradientPreviewProps) {
  if (shape === 'square') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <TurrellSquare stops={stops} />
      </div>
    )
  }
  return <div style={{ position: 'absolute', inset: 0, background: buildGradientCss(shape, stops, false, { smooth }) }} />
}
