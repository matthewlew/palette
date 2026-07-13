import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UndoToast } from './UndoToast'

describe('UndoToast', () => {
  it('renders the message', () => {
    render(<UndoToast message="Added 2 gradients" />)
    expect(screen.getByText('Added 2 gradients')).toBeInTheDocument()
  })

  it('shows an Undo button and calls onUndo when clicked', () => {
    const onUndo = vi.fn()
    render(<UndoToast message="Added 1 gradient" onUndo={onUndo} />)
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('omits the Undo button when onUndo is not provided', () => {
    render(<UndoToast message="Copied gradient" />)
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument()
  })
})
