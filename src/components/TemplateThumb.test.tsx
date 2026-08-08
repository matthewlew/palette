import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TemplateThumb } from './TemplateThumb'
import { buildCarousel } from '../lib/carouselTemplates'
import type { Gradient } from '../store/types'

const gradients: Gradient[] = Array.from({ length: 9 }, (_, i) => ({
  id: `g${i}`,
  name: `G${i}`,
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}))

function thumbFor(templateId: string, n: number, extraSlides = 0) {
  const slides = buildCarousel(templateId, n, { captionTile: false })
  render(<TemplateThumb slide={slides[0]} gradients={gradients} extraSlides={extraSlides} />)
  return screen.getByTestId('template-thumb')
}

afterEach(() => {
  cleanup()
})

describe('TemplateThumb', () => {
  it('draws one element per slice', () => {
    const thumb = thumbFor('bars', 5)
    expect(thumb.querySelectorAll('[style*="left"]')).toHaveLength(5)
  })

  it('positions slices from the arrangement’s own fractions', () => {
    const thumb = thumbFor('bars', 4)
    const first = thumb.querySelector('[style*="left"]') as HTMLElement
    // Quarter-width bars, straight off barRects — the preview reads the same
    // maths the exporter does, which is why it can't drift.
    expect(first.style.left).toBe('0%')
    expect(first.style.width).toBe('25%')
  })

  it('carries rotation through for a pasted layout', () => {
    const thumb = thumbFor('wheatpaste', 5)
    const rotated = [...thumb.querySelectorAll<HTMLElement>('[style*="left"]')].filter((el) =>
      el.style.transform.includes('rotate')
    )
    expect(rotated).toHaveLength(5)
  })

  it('shows how many slides follow the cover', () => {
    const thumb = thumbFor('bars', 4, 4)
    expect(thumb.textContent).toContain('+4')
  })

  it('says nothing when the cover is the only slide', () => {
    expect(thumbFor('bars', 4).textContent).toBe('')
  })

  it('is decorative, so screen readers skip it', () => {
    // The template's label and description carry the meaning; the picture is
    // a second rendering of the same thing.
    expect(thumbFor('grid', 4)).toHaveAttribute('aria-hidden', 'true')
  })

  it('skips a slice whose gradient is missing rather than crashing', () => {
    const slides = buildCarousel('bars', 5, { captionTile: false })
    render(<TemplateThumb slide={slides[0]} gradients={gradients.slice(0, 2)} />)
    expect(screen.getByTestId('template-thumb').querySelectorAll('[style*="left"]')).toHaveLength(2)
  })
})
