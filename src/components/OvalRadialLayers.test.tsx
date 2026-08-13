import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OvalRadialLayers } from './OvalRadialLayers'
import { sampleStops, sampleStopsCss, type GradientStop } from '../lib/gradient'

const stops: GradientStop[] = [
  { hex: '#ff4d3d', position: 0 },
  { hex: '#ffd166', position: 50 },
  { hex: '#1b3b8f', position: 100 },
]

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

describe('OvalRadialLayers', () => {
  it('samples its layers the way CSS interpolates, so an oval crop matches a rectangle one', () => {
    render(<OvalRadialLayers stops={stops} layerCount={5} />)
    const layers = screen.getAllByTestId('oval-radial-layer')
    // Rendered outermost-first; factor 0 is dropped (it has no area).
    expect(layers).toHaveLength(4)
    expect(layers[0].style.backgroundColor).toBe(rgb(sampleStopsCss(stops, 1)))
    expect(layers[3].style.backgroundColor).toBe(rgb(sampleStopsCss(stops, 0.25)))
  })

  it('can be switched to the OKLCH sampling that gives the layered look its own colour', () => {
    render(<OvalRadialLayers stops={stops} layerCount={5} sampling={{ space: 'oklch' }} />)
    const layers = screen.getAllByTestId('oval-radial-layer')
    expect(layers[2].style.backgroundColor).toBe(rgb(sampleStops(stops, 0.5)))
  })

  it('reverses with the gradient', () => {
    render(<OvalRadialLayers stops={stops} layerCount={5} reversed />)
    const layers = screen.getAllByTestId('oval-radial-layer')
    expect(layers[0].style.backgroundColor).toBe(rgb('#ff4d3d'))
  })

  it('sizes every layer to a single extent so the isolines stay superellipses', () => {
    render(<OvalRadialLayers stops={stops} layerCount={4} angle={0} />)
    for (const layer of screen.getAllByTestId('oval-radial-layer')) {
      expect(layer.style.width).toBe(layer.style.height)
      expect(layer.style.clipPath.startsWith('polygon(')).toBe(true)
    }
    // A top-centre origin has to reach past the far boundary, not stop at 100%.
    expect(parseFloat(screen.getAllByTestId('oval-radial-layer')[0].style.width)).toBeGreaterThan(180)
  })
})
