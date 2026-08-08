import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideViewer } from './SlideViewer'
import { buildCarousel } from '../lib/carouselTemplates'
import { captionParts } from '../lib/carouselCaption'
import type { Gradient } from '../store/types'

function gradient(id: string): Gradient {
  return {
    id,
    name: `G${id}`,
    type: 'linear',
    angle: 90,
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
  } as Gradient
}

const GRADIENTS = [gradient('a'), gradient('b'), gradient('c')]
const SLIDES = buildCarousel(3, { cover: 'stack', summary: true })

function setup(index = 1, overrides = {}) {
  const props = {
    slides: SLIDES,
    index,
    gradients: GRADIENTS,
    parts: captionParts(GRADIENTS),
    ratio: 'portrait' as const,
    framed: false,
    onIndexChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SlideViewer {...props} />)
  return props
}

describe('SlideViewer', () => {
  it('says where you are in the carousel', () => {
    setup(1)
    expect(screen.getByTestId('slide-viewer-counter')).toHaveTextContent('2 / 5')
  })

  it('names a bookend, so a full-screen cover is not mistaken for a slide', () => {
    setup(0)
    expect(screen.getByTestId('slide-viewer-counter')).toHaveTextContent('Cover')
  })

  it('pages through the run rather than making you close and reopen', () => {
    // What you are judging is the sequence — whether slide 4 sits well after
    // slide 3 — so paging has to be possible without leaving.
    const { onIndexChange } = setup(1)
    fireEvent.click(screen.getByTestId('slide-viewer-next'))
    expect(onIndexChange).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByTestId('slide-viewer-prev'))
    expect(onIndexChange).toHaveBeenCalledWith(0)
  })

  it('disables prev on the first slide', () => {
    setup(0)
    expect(screen.getByTestId('slide-viewer-prev')).toBeDisabled()
  })

  it('disables next on the final slide', () => {
    setup(SLIDES.length - 1)
    expect(screen.getByTestId('slide-viewer-next')).toBeDisabled()
  })

  it('pages with the arrow keys and closes on Escape', () => {
    const { onIndexChange, onClose } = setup(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onIndexChange).toHaveBeenCalledWith(2)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onIndexChange).toHaveBeenCalledWith(0)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not page past the ends from the keyboard', () => {
    const { onIndexChange } = setup(0)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onIndexChange).not.toHaveBeenCalled()
  })

  it('closes when the surround is tapped, the way a lightbox does', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByLabelText('Close slide preview', { selector: 'button[tabindex="-1"]' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing for an index past the end rather than crashing', () => {
    setup(99)
    expect(screen.queryByTestId('slide-viewer')).not.toBeInTheDocument()
  })
})
