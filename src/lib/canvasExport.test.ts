import { describe, it, expect, vi } from 'vitest'
import { renderGradientToCanvas } from './canvasExport'
import type { Gradient } from '../store/types'

describe('canvasExport rendering', () => {
  const gradient: Gradient = {
    id: 'g1',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
  }

  it('sets canvas width and height correctly', () => {
    const mockAddColorStop = vi.fn()
    const mockContext = {
      fillRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: mockAddColorStop,
      }),
      fillStyle: '',
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement

    renderGradientToCanvas(canvas, gradient, 1200, 800)

    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(800)
    expect(mockContext.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 800)
    expect(mockAddColorStop).toHaveBeenCalledTimes(2)
  })

  it('renders radial gradients correctly', () => {
    const mockAddColorStop = vi.fn()
    const mockContext = {
      fillRect: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: mockAddColorStop,
      }),
      fillStyle: '',
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement

    const radialGradient: Gradient = { ...gradient, type: 'radial' }
    renderGradientToCanvas(canvas, radialGradient, 1000, 1000)

    expect(mockContext.createRadialGradient).toHaveBeenCalledWith(
      500, 500, 0,
      500, 500, Math.hypot(500, 500)
    )
    expect(mockAddColorStop).toHaveBeenCalledTimes(2)
  })
})
