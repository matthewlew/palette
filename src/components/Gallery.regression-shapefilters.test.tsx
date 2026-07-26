// Regression: ISSUE-003 — the gallery shape filters omitted 'mirror', so mirror
// gradients were reachable only by scrolling, never by filtering, and the
// 'square' chip rendered as "Square" while the rest of the UI calls it "Turrell".
// Found by /qa on 2026-07-26
// Report: .gstack/qa-reports/qa-report-matthewlew-github-io-palette-2026-07-26.md
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Gallery } from './Gallery'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

const stops = [
  { hex: '#ff0000', position: 0 },
  { hex: '#0000ff', position: 100 },
]

const savedGradients: Gradient[] = [
  { id: 'm1', type: 'mirror', stops, name: 'Mirrored One' },
  { id: 'm2', type: 'mirror', stops, name: 'Mirrored Two' },
  { id: 's1', type: 'square', stops, name: 'Turrell One' },
  { id: 'l1', type: 'linear', stops, name: 'Linear One' },
]

describe('Gallery shape filters', () => {
  beforeEach(() => {
    useAppStore.setState({ saved: savedGradients, mode: 'gallery' })
  })

  it('offers a Mirror chip that filters down to only mirror gradients', () => {
    render(<Gallery onRiff={vi.fn()} />)

    const mirrorChip = screen.getByRole('button', { name: /^Mirror 2$/ })
    fireEvent.click(mirrorChip)

    expect(screen.getByRole('button', { name: /Mirrored One,/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mirrored Two,/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Linear One,/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Turrell One,/ })).not.toBeInTheDocument()
  })

  it('labels the square type "Turrell", matching EditMode and onboarding', () => {
    render(<Gallery onRiff={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^Turrell 1$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Square 1$/ })).not.toBeInTheDocument()
  })

  it('covers every saved gradient across its shape chips', () => {
    render(<Gallery onRiff={vi.fn()} />)

    // The per-chip counts should account for every saved gradient — the bug was
    // that they summed to less than "All" because mirror had no chip at all.
    const perChip = ['Linear', 'Radial', 'Angular', 'Turrell', 'Mirror', 'Fan'].map((label) => {
      const chip = screen.queryByRole('button', { name: new RegExp(`^${label} \\d+$`) })
      return chip ? Number(chip.textContent!.match(/(\d+)$/)![1]) : 0
    })

    expect(perChip.reduce((a, b) => a + b, 0)).toBe(savedGradients.length)
  })
})
