import styles from './NoiseOverlay.module.css'

// Monochrome grain: fractal noise collapsed to opaque grayscale via
// feColorMatrix (luminance copied into R, G and B; alpha forced to 1).
// Grayscale centered on mid-gray under an overlay blend lightens as often as
// it darkens, so the grain adds texture without shifting overall brightness.
const NOISE_SVG =
  `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>` +
  `<filter id='n'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/>` +
  `<feColorMatrix type='matrix' values='0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 0 1'/>` +
  `</filter>` +
  `<rect width='100%' height='100%' filter='url(%23n)'/>` +
  `</svg>`

const NOISE_URL = `url("data:image/svg+xml,${NOISE_SVG.replace(/#/g, '%23')}")`

interface NoiseOverlayProps {
  visible: boolean
}

export function NoiseOverlay({ visible }: NoiseOverlayProps) {
  if (!visible) return null
  return <div data-testid="noise-overlay" aria-hidden="true" className={styles.noise} style={{ backgroundImage: NOISE_URL }} />
}
