import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Feed } from './Feed'
import { useAppStore } from '../store/useAppStore'
import * as paletteLib from '../lib/palette'

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

describe('Feed', () => {
  it('generates an initial gradient on mount if none exists', () => {
    render(<Feed />)
    expect(useAppStore.getState().current).not.toBeNull()
  })

  it('renders a GradientPage for the current gradient', () => {
    render(<Feed />)
    expect(screen.getByTestId('gradient-page')).toBeInTheDocument()
  })

  it('generates a new gradient when scrolled near the bottom boundary', () => {
    render(<Feed />)
    const first = useAppStore.getState().current
    const container = screen.getByTestId('feed-container')

    const generateSpy = vi.spyOn(paletteLib, 'generateGradientStops')

    Object.defineProperty(container, 'scrollTop', { value: 900, writable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(container, 'clientHeight', { value: 800, writable: true })
    container.dispatchEvent(new Event('scroll'))

    expect(generateSpy).toHaveBeenCalled()
    expect(useAppStore.getState().current).not.toEqual(first)
  })
})
