import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PaletteTitle } from './PaletteTitle'

afterEach(() => {
  cleanup()
})

function openEditor(name = 'Cobalt Solstice', onRename = vi.fn()) {
  render(<PaletteTitle name={name} onRename={onRename} />)
  fireEvent.click(screen.getByTestId('palette-title-button'))
  return { input: screen.getByTestId('palette-title-input') as HTMLInputElement, onRename }
}

describe('PaletteTitle', () => {
  it('swaps the label for an input when tapped, and commits on Enter', () => {
    const { input, onRename } = openEditor()
    fireEvent.change(input, { target: { value: 'Flame Porch' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('Flame Porch')
  })

  it('cancels on Escape without renaming', () => {
    const { input, onRename } = openEditor()
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByTestId('palette-title-button')).toBeInTheDocument()
  })

  it('asks the keyboard for a name field, not a prose field', () => {
    // A palette name is a name: autocorrect rewriting it mid-type, or a
    // spelling squiggle under it, both read as some other app's text box. And
    // Enter here commits and closes, which is what `done` labels the key.
    const { input } = openEditor()
    expect(input).toHaveAttribute('enterkeyhint', 'done')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'words')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })
})
