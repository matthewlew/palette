import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CarouselTray } from './CarouselTray'
import type { Gradient } from '../store/types'

const gradients: Gradient[] = ['Alpha', 'Beta', 'Gamma'].map((name, i) => ({
  id: `g${i + 1}`,
  name,
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}))

function setup(overrides: Partial<Parameters<typeof CarouselTray>[0]> = {}) {
  const props = {
    gradients,
    onRemove: vi.fn(),
    onReorder: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  }
  render(<CarouselTray {...props} />)
  return props
}

function item(id: string): HTMLElement {
  return screen.getByTestId('carousel-tray').querySelector(`[data-tray-id="${id}"]`) as HTMLElement
}

afterEach(() => {
  cleanup()
})

describe('CarouselTray', () => {
  it('lists only the picked gradients, in slide order', () => {
    setup()
    const ids = screen.getAllByTestId('tray-item').map((el) => el.dataset.trayId)
    // The point of the tray: no unpicked gradients in between to drag across.
    expect(ids).toEqual(['g1', 'g2', 'g3'])
  })

  it('numbers the slides from 1', () => {
    setup()
    expect(item('g1')).toHaveAttribute('aria-label', expect.stringContaining('Slide 1'))
    expect(item('g3')).toHaveAttribute('aria-label', expect.stringContaining('Slide 3'))
  })

  it('labels the first and last slides', () => {
    setup()
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('End')).toBeInTheDocument()
  })

  it('reorders on drop', () => {
    const { onReorder } = setup()
    fireEvent.dragStart(item('g3'))
    fireEvent.drop(item('g1'))
    expect(onReorder).toHaveBeenCalledWith('g3', 'g1')
  })

  it('moves a slide with the arrow keys', () => {
    const { onMove } = setup()
    fireEvent.keyDown(item('g2'), { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledWith('g2', -1)
    fireEvent.keyDown(item('g2'), { key: 'ArrowRight' })
    expect(onMove).toHaveBeenCalledWith('g2', 1)
  })

  it('removes a slide with Delete or Backspace', () => {
    const { onRemove } = setup()
    fireEvent.keyDown(item('g2'), { key: 'Delete' })
    fireEvent.keyDown(item('g3'), { key: 'Backspace' })
    expect(onRemove).toHaveBeenNthCalledWith(1, 'g2')
    expect(onRemove).toHaveBeenNthCalledWith(2, 'g3')
  })

  it('removes a slide from its own button', () => {
    const { onRemove } = setup()
    fireEvent.click(screen.getByLabelText('Remove Beta from the carousel'))
    expect(onRemove).toHaveBeenCalledWith('g2')
  })

  it('keeps every slide reachable from the keyboard', () => {
    setup()
    for (const el of screen.getAllByTestId('tray-item')) {
      expect(el).toHaveAttribute('tabindex', '0')
    }
  })

  it('renders a single pick as both Start and End without breaking', () => {
    setup({ gradients: [gradients[0]] })
    expect(screen.getAllByTestId('tray-item')).toHaveLength(1)
    // Index 0 is also the last index, and Start wins — one label, not two.
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.queryByText('End')).not.toBeInTheDocument()
  })

  it('names an unnamed gradient rather than rendering a blank slide', () => {
    setup({ gradients: [{ ...gradients[0], name: undefined }] })
    expect(screen.getByTestId('tray-item')).toHaveAttribute(
      'aria-label',
      expect.not.stringContaining('undefined')
    )
  })
})
