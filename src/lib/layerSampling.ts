/**
 * The two knobs that decide how much this renderer's colour departs from the
 * CSS gradient the rectangle crop paints for the same stops.
 *
 * - `layerCount` is the quantization: the ramp is drawn as N flat bands, so a
 *   low N posterizes it into visible steps (the blur softens the seams but
 *   cannot restore the missing intermediate colours).
 * - `space` is the interpolation path between two adjacent stops. `'css'`
 *   walks the same straight line in gamma-encoded sRGB that a CSS gradient
 *   walks, so the layers land on the CSS colours; `'oklch'` walks the polar
 *   OKLCH arc, which bows the mid-tones away from that line (more chromatic
 *   mid-tones, and a hue that swings around the wheel between distant hues).
 *
 * The defaults are the fidelity setting — an oval crop must read as the same
 * colour as a rectangle one. The other end of each knob is the "sampled flat
 * layers" character; it stays reachable per-instance rather than being
 * hardcoded away.
 */
export interface LayerSamplingConfig {
  layerCount: number
  space: 'css' | 'oklch'
}

export const FIDELITY_SAMPLING: LayerSamplingConfig = { layerCount: 48, space: 'css' }
