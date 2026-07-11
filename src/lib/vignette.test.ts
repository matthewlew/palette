import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderVignetteToCanvas, VIGNETTE_PAPER, VIGNETTE_SHAPES } from './vignette'
import type { Gradient } from '../store/types'

const gradient: Gradient = {
  id: 'g1',
  name: 'Test Palette',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
}

function mockContext() {
  return {
    fillRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  }
}

function mockCanvas(ctx: ReturnType<typeof mockContext>) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(ctx),
  } as unknown as HTMLCanvasElement
}

beforeEach(() => {
  // The offscreen full-bleed gradient canvas created inside the renderer
  vi.spyOn(document, 'createElement').mockImplementation(
    () => mockCanvas(mockContext()) as unknown as HTMLElement
  )
})

describe('renderVignetteToCanvas', () => {
  it('exposes the five shapes with full first', () => {
    expect(VIGNETTE_SHAPES.map((s) => s.id)).toEqual(['full', 'circle', 'oval', 'diamond', 'poster'])
  })

  it('full shape renders the plain gradient (no paper fill or clipping)', () => {
    const ctx = mockContext()
    const canvas = mockCanvas(ctx)
    renderVignetteToCanvas(canvas, gradient, 400, 800, 'full')
    expect(ctx.createLinearGradient).toHaveBeenCalled()
    expect(ctx.clip).not.toHaveBeenCalled()
  })

  it('circle clips an arc and composites the gradient over paper', () => {
    const ctx = mockContext()
    const canvas = mockCanvas(ctx)
    const fillStyles: string[] = []
    Object.defineProperty(ctx, 'fillStyle', {
      set: (v: string) => fillStyles.push(v),
      get: () => fillStyles[fillStyles.length - 1],
    })
    renderVignetteToCanvas(canvas, gradient, 400, 800, 'circle')
    expect(fillStyles[0]).toBe(VIGNETTE_PAPER)
    expect(ctx.arc).toHaveBeenCalledWith(200, 400, 200 * 0.78, 0, Math.PI * 2)
    expect(ctx.clip).toHaveBeenCalled()
    expect(ctx.drawImage).toHaveBeenCalled()
  })

  it('oval clips an ellipse scaled to both axes', () => {
    const ctx = mockContext()
    const canvas = mockCanvas(ctx)
    renderVignetteToCanvas(canvas, gradient, 400, 800, 'oval')
    expect(ctx.ellipse).toHaveBeenCalledWith(200, 400, 200 * 0.78, 400 * 0.78, 0, 0, Math.PI * 2)
  })

  it('diamond clips a four-point polygon', () => {
    const ctx = mockContext()
    const canvas = mockCanvas(ctx)
    renderVignetteToCanvas(canvas, gradient, 400, 800, 'diamond')
    expect(ctx.moveTo).toHaveBeenCalledTimes(1)
    expect(ctx.lineTo).toHaveBeenCalledTimes(3)
    expect(ctx.closePath).toHaveBeenCalled()
    expect(ctx.clip).toHaveBeenCalled()
  })

  it('poster inset-draws the gradient and titles it with name and meta', () => {
    const ctx = mockContext()
    const canvas = mockCanvas(ctx)
    renderVignetteToCanvas(canvas, gradient, 400, 800, 'poster')
    expect(ctx.clip).not.toHaveBeenCalled()
    expect(ctx.drawImage).toHaveBeenCalled()
    const texts = ctx.fillText.mock.calls.map((c) => c[0])
    expect(texts).toContain('Test Palette')
    expect(texts.some((t: string) => t.includes('LINEAR GRADIENT'))).toBe(true)
  })

  it('poster falls back to Untitled when the gradient has no name', () => {
    const ctx = mockContext()
    const canvas = mockCanvas(ctx)
    renderVignetteToCanvas(canvas, { ...gradient, name: undefined }, 400, 800, 'poster')
    const texts = ctx.fillText.mock.calls.map((c) => c[0])
    expect(texts).toContain('Untitled')
  })
})
