import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useHint } from './useHint'

function TestTarget({ hintKey }: { hintKey: string }) {
  const { visible, dismiss } = useHint(hintKey)
  return (
    <div>
      <span data-testid="visible">{String(visible)}</span>
      <button type="button" onClick={dismiss}>
        dismiss
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('useHint', () => {
  it('is visible when the storage key is absent', () => {
    render(<TestTarget hintKey="scroll" />)
    expect(screen.getByTestId('visible').textContent).toBe('true')
  })

  it('becomes hidden after dismiss() and persists the key', () => {
    render(<TestTarget hintKey="scroll" />)
    act(() => {
      screen.getByText('dismiss').click()
    })
    expect(screen.getByTestId('visible').textContent).toBe('false')
    expect(localStorage.getItem('palette-hint-scroll')).toBe('1')
  })

  it('stays hidden on remount after a prior dismissal', () => {
    localStorage.setItem('palette-hint-scroll', '1')
    render(<TestTarget hintKey="scroll" />)
    expect(screen.getByTestId('visible').textContent).toBe('false')
  })

  it('does not crash when localStorage throws (private mode)', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    expect(() => render(<TestTarget hintKey="scroll" />)).not.toThrow()
    getItemSpy.mockRestore()
  })
})
