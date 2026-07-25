import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BoardShare } from './BoardShare'
import type { Gradient } from '../store/types'

// Copy Link publishes the gradient before building the share URL; stub it so
// the test never touches Supabase and resolves to a known slug.
vi.mock('../lib/publishPalette', () => ({
  publishPalette: vi.fn().mockResolvedValue({ success: true, slug: 'test-gradient', displayName: 'Test Gradient' }),
  generateSlug: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}))

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

/** Reveal the overflow submenu (Export Image / Export Board JSON / Import). */
function openMore() {
  fireEvent.click(screen.getByRole('button', { name: /more options/i }))
}

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

  it('disables image/JSON actions that need a current gradient or saves', () => {
    render(<BoardShare saved={[]} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))

    // No current gradient -> the primary "Share as Image" is disabled.
    expect(screen.getByRole('button', { name: /share as image/i })).toBeDisabled()

    openMore()
    // No saves -> exporting the board JSON is disabled; import always works.
    expect(screen.getByRole('button', { name: /export board json/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /import json/i })).not.toBeDisabled()
  })

  it('shares the per-gradient preview link when "Copy Link" is clicked', async () => {
    render(<BoardShare saved={board} current={board[0]} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/palette/#test-gradient'),
      ),
    )
  })

  it('describes the primary actions with hint text', () => {
    render(<BoardShare saved={board} current={board[0]} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    expect(screen.getByText(/poster with gradient/i)).toBeInTheDocument()
    openMore()
    expect(screen.getByText(/backup your full collection/i)).toBeInTheDocument()
  })

  it('opens a modal with the full board JSON in a large textarea and copies it', () => {
    render(<BoardShare saved={board} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    openMore()
    fireEvent.click(screen.getByRole('button', { name: /export board json/i }))

    const area = screen.getByLabelText('Board JSON') as HTMLTextAreaElement
    expect(area.rows).toBeGreaterThanOrEqual(8)
    expect(JSON.parse(area.value)).toMatchObject({ kind: 'board' })

    fireEvent.click(screen.getByRole('button', { name: /copy json/i }))
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(JSON.parse(copiedText)).toMatchObject({ kind: 'board' })
  })

  it('imports pasted JSON from the modal textarea', () => {
    const onImport = vi.fn()
    render(<BoardShare saved={[]} onImport={onImport} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    openMore()
    fireEvent.click(screen.getByRole('button', { name: /import json/i }))

    const area = screen.getByLabelText('Paste JSON here')
    fireEvent.change(area, { target: { value: '{"kind":"board","gradients":[]}' } })
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))

    expect(onImport).toHaveBeenCalledWith('{"kind":"board","gradients":[]}')
    expect(screen.queryByTestId('json-modal')).not.toBeInTheDocument()
  })

  it('disables the import confirm button while the textarea is empty', () => {
    render(<BoardShare saved={[]} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    openMore()
    fireEvent.click(screen.getByRole('button', { name: /import json/i }))
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled()
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

  it('opens the export presets modal when "Export Image..." is clicked', () => {
    render(<BoardShare saved={board} current={board[0]} onImport={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share options/i }))
    openMore()

    const exportButton = screen.getByRole('button', { name: /export image/i })
    expect(exportButton).toBeInTheDocument()

    fireEvent.click(exportButton)
    expect(screen.getByTestId('export-modal')).toBeInTheDocument()
  })
})
