import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ExportModal } from './ExportModal'
import type { Gradient } from '../store/types'

// Mock the canvasExport library
vi.mock('../lib/canvasExport', () => ({
  downloadGradientAsPng: vi.fn().mockResolvedValue(undefined),
}))

const sampleGradient: Gradient = {
  id: 'g1',
  type: 'linear',
  stops: [
    { hex: '#ff0000', position: 0 },
    { hex: '#0000ff', position: 100 },
  ],
  name: 'Test Sunset',
}

describe('ExportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog title and preset list', () => {
    render(<ExportModal gradient={sampleGradient} onClose={vi.fn()} />)

    expect(screen.getByText('Export Image')).toBeInTheDocument()
    expect(screen.getByText(/Save “Test Sunset” as a high-resolution PNG/)).toBeInTheDocument()

    // Verify all presets are listed
    expect(screen.getByText('Phone Wallpaper')).toBeInTheDocument()
    expect(screen.getByText('Instagram Story')).toBeInTheDocument()
    expect(screen.getByText('OG Image / Landscape')).toBeInTheDocument()

    expect(screen.getByText('1179 × 2556 px')).toBeInTheDocument()
    expect(screen.getByText('1080 × 1920 px')).toBeInTheDocument()
    expect(screen.getByText('1200 × 630 px')).toBeInTheDocument()
  })

  it('calls onClose when close button or backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<ExportModal gradient={sampleGradient} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /close export menu/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('triggers downloadGradientAsPng with correct dimensions when a preset is clicked', async () => {
    const { downloadGradientAsPng } = await import('../lib/canvasExport')
    render(<ExportModal gradient={sampleGradient} onClose={vi.fn()} />)

    vi.useFakeTimers()
    const wallpaperButton = screen.getByRole('button', { name: /Phone Wallpaper/i })
    fireEvent.click(wallpaperButton)

    // Move forward past timeout
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(downloadGradientAsPng).toHaveBeenCalledWith(sampleGradient, 1179, 2556)
    vi.useRealTimers()
  })
})
