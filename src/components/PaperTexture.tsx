import type { PaperStock } from '../lib/paperStock'
import styles from './PaperTexture.module.css'

/** Same feTurbulence-to-grayscale technique as NoiseOverlay, parameterized
 * per stock instead of one fixed recipe — see NoiseOverlay.tsx for why
 * color-interpolation-filters='sRGB' matters for the overlay math. */
function textureUrl(frequency: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>` +
    `<filter id='n' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='4' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 0 1'/>` +
    `</filter>` +
    `<rect width='100%' height='100%' filter='url(%23n)'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23')}")`
}

interface PaperTextureProps {
  stock: PaperStock
}

/** Tooth only — a stock's base tint is baked into the plate/composite raster
 * itself (see plateExport.ts's `background` param), so this only has to add
 * the tactile grain on top. Positioned OVER the raster, not under it: with
 * mix-blend-mode: multiply, layering it above is what lets the tooth read
 * through the ink as well as the bare paper, not just the parts that would
 * otherwise be a flat, unbroken fill. */
export function PaperTexture({ stock }: PaperTextureProps) {
  return (
    <div
      data-testid="paper-texture"
      aria-hidden="true"
      className={styles.grain}
      style={{ backgroundImage: textureUrl(stock.frequency), opacity: stock.grain }}
    />
  )
}
