import { describe, it, expect, vi } from 'vitest'
import { renderGradientToCanvas } from './canvasExport'
import type { Gradient } from '../store/types'
import { turrellExtent } from './gradient'

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

  /** Render a fan and report the wedge-fan centre + start angle the canvas
   * got. Fans (and angular gradients) are now painted as many thin wedges —
   * see fillConicWedges — rather than via ctx.createConicGradient, whose
   * Canvas2D rasterizers band visibly in low-chroma regions. The first
   * wedge's moveTo/arc calls carry the same centre + start-angle geometry
   * createConicGradient used to be asserted with. */
  function renderFan(overrides: Partial<Gradient>) {
    const moveTo = vi.fn()
    const arc = vi.fn()
    const mockContext = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      moveTo,
      arc,
      fillStyle: '',
    }
    const canvas = { width: 0, height: 0, getContext: vi.fn().mockReturnValue(mockContext) } as unknown as HTMLCanvasElement
    renderGradientToCanvas(canvas, { ...gradient, type: 'fan', ...overrides }, 1000, 1000)
    const [cx, cy] = moveTo.mock.calls[0]
    const [, , , startAngle] = arc.mock.calls[0]
    return { centre: [cx, cy], startAngle, wedgeCount: arc.mock.calls.length }
  }

  it('leaves an un-rotated fan at the bottom', () => {
    // Fan has no centre position (its wrap point would be exposed); an
    // un-rotated fan stays where it always was.
    const { centre, startAngle, wedgeCount } = renderFan({})
    expect(centre).toEqual([500, 1000])
    expect(startAngle).toBeCloseTo(Math.PI)
    expect(wedgeCount).toBeGreaterThan(360) // many wedges, not a handful of facets
  })

  it('puts top at 0 and bottom at 180, matching getRadialConfig', () => {
    const top = renderFan({ angle: 0 })
    expect(top.centre).toEqual([500, 0])
    expect(top.startAngle).toBeCloseTo(0)

    const bottom = renderFan({ angle: 180 })
    expect(bottom.centre).toEqual([500, 1000])
    expect(bottom.startAngle).toBeCloseTo(Math.PI)
  })

  it('renders a legacy anchored fan exactly as it always did', () => {
    // Fans saved before the compass was re-based carry fanAnchor and no angle.
    // bottom-center (500, 1000), CSS from 270deg -> canvas start pi.
    const bottom = renderFan({ fanAnchor: 'bottom' })
    expect(bottom.centre).toEqual([500, 1000])
    expect(bottom.startAngle).toBeCloseTo(Math.PI)

    // ...and each legacy anchor equals its new angle.
    const top = renderFan({ fanAnchor: 'top' })
    expect(top.centre).toEqual([500, 0])
    expect(top.startAngle).toBeCloseTo(0)

    const left = renderFan({ fanAnchor: 'left' })
    expect(left.centre).toEqual([0, 500])
    expect(left.startAngle).toBeCloseTo(-Math.PI / 2)

    const right = renderFan({ fanAnchor: 'right' })
    expect(right.centre).toEqual([1000, 500])
    expect(right.startAngle).toBeCloseTo(Math.PI / 2)
  })

  it('lets an explicit angle override the legacy anchor', () => {
    const { centre, startAngle } = renderFan({ fanAnchor: 'bottom', angle: 0 })
    expect(centre).toEqual([500, 0])
    expect(startAngle).toBeCloseTo(0)
  })

  it('adds more color stops for a smoothed linear gradient', () => {
    const mockAddColorStop = vi.fn()
    const mockContext = {
      fillRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: mockAddColorStop }),
      fillStyle: '',
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as HTMLCanvasElement

    renderGradientToCanvas(canvas, { ...gradient, smoothEnabled: true }, 1200, 800)

    expect(mockAddColorStop.mock.calls.length).toBeGreaterThan(2)
  })
})

describe('square (Turrell) export honours the origin', () => {
  const round4 = (a: number[]) => a.map((n) => Math.round(n * 1e4) / 1e4)

  /** Capture every fillRect, undoing the offscreen shadow trick's x-offset so
   *  the rects are in real canvas coordinates. */
  function renderSquare(angle: number | undefined, width = 400, height = 400) {
    const calls: number[][] = []
    const ctx = {
      fillRect: (x: number, y: number, w: number, h: number) => calls.push([x, y, w, h]),
      save: vi.fn(), restore: vi.fn(),
      fillStyle: '', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    }
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
    const gradient: Gradient = {
      id: 's', type: 'square', angle,
      stops: [
        { hex: '#111111', position: 0 },
        { hex: '#222222', position: 50 },
        { hex: '#333333', position: 100 },
      ],
    }
    renderGradientToCanvas(canvas, gradient, width, height)
    // The first two fillRects are backgrounds (the black clear, then the
    // outermost colour). Filtering by size would wrongly drop the outermost
    // LAYER too, which at a centred origin is exactly canvas-sized.
    // Rounded: the two paths reach the same numbers by slightly different
    // arithmetic, so 80 vs 79.99999999999999 is noise, not a discrepancy.
    return calls.slice(2).map(([x, y, w, h]) => round4([x + width * 2, y, w, h]))
  }

  /** TurrellSquare's own maths. The extent now comes from the shared
   * turrellExtent rather than being restated here — restating it is exactly how
   * the export drifted from the component in the first place. */
  function expected(angle: number | undefined, width = 400, height = 400) {
    const cfg = angle == null
      ? { px: 0.5, py: 0.5 }
      : { 0: { px: 0.5, py: 0 }, 90: { px: 1, py: 0.5 }, 315: { px: 0, py: 0 } }[angle]!
    const reachX = Math.max(cfg.px, 1 - cfg.px)
    const reachY = Math.max(cfg.py, 1 - cfg.py)
    return [100, 50, 0].map((position) => {
      const factor = turrellExtent(position, 3)
      const sizeX = 2 * reachX * factor * width
      const sizeY = 2 * reachY * factor * height
      return round4([cfg.px * width - sizeX / 2, cfg.py * height - sizeY / 2, sizeX, sizeY])
    })
  }

  it('centres the nest when there is no origin', () => {
    expect(renderSquare(undefined)).toEqual(expected(undefined))
  })

  it('anchors the nest to each edge and corner', () => {
    for (const angle of [0, 90, 315]) {
      expect(renderSquare(angle), `angle ${angle}`).toEqual(expected(angle))
    }
  })

  it('actually produces a DIFFERENT nest per origin', () => {
    const centred = JSON.stringify(renderSquare(undefined))
    const top = JSON.stringify(renderSquare(0))
    const right = JSON.stringify(renderSquare(90))
    expect(new Set([centred, top, right]).size).toBe(3)
  })

  it('draws largest layer first so inner layers are not painted over', () => {
    const sizes = renderSquare(undefined).map(([, , w]) => w)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })
})
