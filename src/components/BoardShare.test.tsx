import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BoardShare } from './BoardShare'
import type { Gradient } from '../store/types'

const board: Gradient[] = [
  {
    id: 'g1',
    type: 'linear',
    stops: [
      { hex: '#ff0000', position: 0 },
      { hex: '#0000ff', position: 100 },
    ],
    name: 'Test Gradient',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    share: undefined,
  })
})

describe('BoardShare Component', () => {
  it('renders the share trigger button', () => {
    render(<BoardShare saved={[]} onImport={vi.fn()} />)
    expect(screen.getByRole('button', { name: /share options/i })).toBeInTheDocument()
  })

  it('opens the dropdown on click', () => {
    render(<BoardShare saved={[]} onImport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /share options/i })
    
    expect(screen.queryByTestId('share-dropdown')).not.toBeInTheDocument()
    
    fireEvent.click(trigger)
    expect(screen.getByTestId('share-dropdown')).toBeInTheDocument()
  })

  it('disables share and copy actions when there are no saved gradients', () => {
    render(<BoardShare saved={[]} onImport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /share options/i })
    fireEvent.click(trigger)

    expect(screen.getByRole('button', { name: /share board link/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /copy board json/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /import board json/i })).not.toBeDisabled()
  })

  it('copies share link when "Share Board Link" is clicked', async () => {
    render(<BoardShare saved={board} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    fireEvent.click(screen.getByRole('button', { name: /share board link/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(`${window.location.origin}${window.location.pathname}#d=`)
    )
  })

  it('copies board JSON when "Copy Board JSON" is clicked', async () => {
    render(<BoardShare saved={board} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy board json/i }))

    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(JSON.parse(copiedText)).toMatchObject({ kind: 'board' })
  })

  it('prompts and calls onImport when "Import Board JSON" is clicked', () => {
    const onImport = vi.fn()
    const promptMock = vi.spyOn(window, 'prompt').mockReturnValue('{"kind":"board","gradients":[]}')
    
    render(<BoardShare saved={[]} onImport={onImport} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    fireEvent.click(screen.getByRole('button', { name: /import board json/i }))

    expect(promptMock).toHaveBeenCalled()
    expect(onImport).toHaveBeenCalledWith('{"kind":"board","gradients":[]}')
    
    promptMock.mockRestore()
  })

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <BoardShare saved={[]} onImport={vi.fn()} />
      </div>
    )
    
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByTestId('share-dropdown')).not.toBeInTheDocument()
  })
})
