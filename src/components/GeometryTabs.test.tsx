import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GeometryTabs } from './GeometryTabs'

describe('GeometryTabs', () => {
const dummyStops = [{ id: '1', loc: 0, color: '#ffffff', hex: '#ffffff', position: 0 }, { id: '2', loc: 100, color: '#000000', hex: '#000000', position: 100 }]
const dummyGradient = (type: any) => ({ id: 'g1', type, stops: dummyStops, reversed: false, hardStops: false, repeatEnabled: false, fanAnchor: 'bottom' as any })

  it('renders all 5 geometry tabs', () => {
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    for (const label of ['Linear', 'Radial', 'Angular', 'Turrell', 'Mirror']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders Repeat x2 and Hard filter chips instead of a Repeat tab', () => {
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.queryByText('Repeat')).not.toBeInTheDocument()
    expect(screen.getByTestId('filter-repeat')).toBeInTheDocument()
    expect(screen.getByTestId('filter-hard')).toBeInTheDocument()
  })

  it('toggles the repeat and hard filters independently of geometry type', () => {
    const onToggleRepeat = vi.fn()
    const onToggleHardStops = vi.fn()
    render(
      <GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops}
        onSelectType={vi.fn()}
        onToggleReversed={vi.fn()}
        onToggleRepeat={onToggleRepeat}
        onToggleHardStops={onToggleHardStops}
      />
    )
    fireEvent.click(screen.getByTestId('filter-repeat'))
    expect(onToggleRepeat).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('filter-hard'))
    expect(onToggleHardStops).toHaveBeenCalledTimes(1)
  })

  it('keeps Repeat and Hard available on square (Turrell reads Hard as crisp, Repeat works normally)', () => {
    render(<GeometryTabs gradient={dummyGradient('square')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByTestId('filter-repeat')).not.toBeDisabled()
    expect(screen.getByTestId('filter-hard')).not.toBeDisabled()
  })

  it('disables both filter chips for mirror (it authors its own sequence)', () => {
    render(<GeometryTabs gradient={dummyGradient('mirror')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByTestId('filter-repeat')).toBeDisabled()
    expect(screen.getByTestId('filter-hard')).toBeDisabled()
  })

  it('calls onSelectType when tapping a different, inactive tab', () => {
    const onSelectType = vi.fn()
    const onToggleReversed = vi.fn()
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={onSelectType} onToggleReversed={onToggleReversed} />)
    fireEvent.click(screen.getByText('Radial'))
    expect(onSelectType).toHaveBeenCalledWith('radial')
    expect(onToggleReversed).not.toHaveBeenCalled()
  })

  it('calls onToggleReversed (not onSelectType) when tapping the already-active tab', () => {
    const onSelectType = vi.fn()
    const onToggleReversed = vi.fn()
    render(<GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops} onSelectType={onSelectType} onToggleReversed={onToggleReversed} />)
    fireEvent.click(screen.getByText('Linear'))
    expect(onToggleReversed).toHaveBeenCalledTimes(1)
    expect(onSelectType).not.toHaveBeenCalled()
  })

  it('renders a Smooth chip and calls onToggleSmooth when clicked', () => {
    const onToggleSmooth = vi.fn()
    render(
      <GeometryTabs gradient={dummyGradient('linear')} stops={dummyStops}
        onSelectType={vi.fn()}
        onToggleReversed={vi.fn()}
        onToggleSmooth={onToggleSmooth}
      />
    )
    const chip = screen.getByTestId('filter-smooth')
    fireEvent.click(chip)
    expect(onToggleSmooth).toHaveBeenCalledTimes(1)
  })

  it('labels the square-type tab as "Turrell"', () => {
    render(<GeometryTabs gradient={dummyGradient('square')} stops={dummyStops} onSelectType={vi.fn()} onToggleReversed={vi.fn()} />)
    expect(screen.getByText('Turrell')).toBeInTheDocument()
    expect(screen.queryByText('Square')).not.toBeInTheDocument()
  })
})

describe('GeometryTabs Shape/Effect sections', () => {
  const stops = [
    { hex: '#ffffff', position: 0 },
    { hex: '#000000', position: 100 },
  ]
  const gradient = {
    id: 'g1', type: 'linear' as const, stops,
    reversed: false, hardStops: false, repeatEnabled: false,
  }
  const render_ = (extra = {}) =>
    render(
      <GeometryTabs
        gradient={gradient as never}
        stops={stops}
        onSelectType={vi.fn()}
        onToggleReversed={vi.fn()}
        orderLabel="Original"
        order="original"
        onCycleOrder={vi.fn()}
        {...extra}
      />
    )

  it('starts on Shape, with the Effect panel present but not shown', () => {
    // Both panels stay in the DOM: the desktop media query reveals the
    // inactive one, so hiding it must be a class and not a conditional render.
    render_()
    expect(screen.getByTestId('section-tab-shape')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('section-tab-effect')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('section-panel-effect')).toBeInTheDocument()
    expect(screen.getByTestId('filter-repeat')).toBeInTheDocument()
  })

  it('switches to Effect on tap', () => {
    render_()
    fireEvent.click(screen.getByTestId('section-tab-effect'))
    expect(screen.getByTestId('section-tab-effect')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('section-tab-shape')).toHaveAttribute('aria-selected', 'false')
  })

  it('puts the six shapes in Shape and the modifiers in Effect', () => {
    // The split is the point: the peek shows one section at a time, so a
    // control in the wrong half is a control the user cannot find.
    render_()
    const shape = screen.getByTestId('section-panel-shape')
    const effect = screen.getByTestId('section-panel-effect')
    for (const label of ['Linear', 'Radial', 'Angular', 'Turrell', 'Mirror', 'Fan']) {
      expect(shape).toContainElement(screen.getByText(label))
    }
    for (const id of ['filter-repeat', 'filter-smooth', 'filter-hard', 'filter-grain', 'filter-rotate', 'sort-button']) {
      expect(effect).toContainElement(screen.getByTestId(id))
    }
  })

  it('previews Radial and Turrell centred, at the angle their tap would give', () => {
    // The swatches used to render with the CURRENT gradient's angle. A linear
    // gradient's 0 means "downwards"; handing that same 0 to the Radial and
    // Turrell previews drew them anchored to the top edge, so the two shapes
    // advertised themselves as the off-centre thing a tap no longer produces.
    render_({ gradient: { ...gradient, angle: 0 } })
    const radial = screen.getByRole('button', { name: /Radial/ })
    const box = radial.querySelector('[class*="previewBox"]') as HTMLElement
    // A centred radial names no origin; an anchored one says `at top`.
    expect(box.style.backgroundImage).toContain('radial-gradient')
    expect(box.style.backgroundImage).not.toMatch(/at (top|bottom|left|right)/)
  })

  it('keeps a directional swatch on the current angle', () => {
    render_({ gradient: { ...gradient, angle: 90 } })
    const angular = screen.getByRole('button', { name: /Angular/ })
    const box = angular.querySelector('[class*="previewBox"]') as HTMLElement
    expect(box.style.backgroundImage).toContain('conic-gradient')
    expect(box.style.backgroundImage).toContain('90deg')
  })

  it('toggles grain from the Effect chips', () => {
    const onToggleNoise = vi.fn()
    render_({ noiseEnabled: true, onToggleNoise })
    const chip = screen.getByTestId('filter-grain')
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(onToggleNoise).toHaveBeenCalledTimes(1)
  })

  it('keeps both panels in one layout box so switching tabs cannot resize the sheet', () => {
    // Shape is one row of six squares and Effect two rows of chips, so a
    // display:none swap made the sheet jump ~14px per tap — and the collapsed
    // peek, measured from this content, moved with it. The panels share a
    // parent (a single grid cell in CSS) and the inactive one stays in the
    // layout, so the box is always as tall as the taller panel.
    render_()
    const shape = screen.getByTestId('section-panel-shape')
    const effect = screen.getByTestId('section-panel-effect')
    expect(shape.parentElement).toBe(effect.parentElement)

    // Both are still there after the switch — hidden by class, never unmounted.
    fireEvent.click(screen.getByTestId('section-tab-effect'))
    expect(screen.getByTestId('section-panel-shape')).toBeInTheDocument()
    expect(screen.getByTestId('section-panel-effect')).toBeInTheDocument()
  })

  it('keeps every control operable regardless of which section is showing', () => {
    // Switching sections must not unmount anything — the desktop layout shows
    // both at once, and unmounting would also drop focus and state.
    const onToggleRepeat = vi.fn()
    render_({ onToggleRepeat })
    fireEvent.click(screen.getByTestId('filter-repeat'))
    expect(onToggleRepeat).toHaveBeenCalledTimes(1)
  })

  it('wires the tabs to their panels for assistive tech', () => {
    render_()
    expect(screen.getByTestId('section-tab-shape')).toHaveAttribute('aria-controls', 'section-panel-shape')
    expect(screen.getByTestId('section-panel-shape')).toHaveAttribute('role', 'tabpanel')
    expect(screen.getByTestId('section-panel-shape')).toHaveAttribute('aria-labelledby', 'section-tab-shape')
  })
})
