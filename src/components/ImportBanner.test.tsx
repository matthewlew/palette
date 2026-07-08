import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportBanner } from './ImportBanner'

describe('ImportBanner', () => {
  it('renders the count of pending gradients', () => {
    render(<ImportBanner count={3} onConfirm={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/import 3 gradients/i)).toBeInTheDocument()
  })

  it('uses singular phrasing for a count of 1', () => {
    render(<ImportBanner count={1} onConfirm={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/import 1 gradient\b/i)).toBeInTheDocument()
  })

  it('calls onConfirm when "Add to board" is clicked', () => {
    const onConfirm = vi.fn()
    render(<ImportBanner count={1} onConfirm={onConfirm} onDismiss={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add to board/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onDismiss when "Dismiss" is clicked', () => {
    const onDismiss = vi.fn()
    render(<ImportBanner count={1} onConfirm={() => {}} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
