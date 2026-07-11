import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ExportModal } from './ExportModal'
import type { Gradient } from '../store/types'

// Mock the vignette export library (keep the real shape list)
vi.mock('../lib/vignette', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/vignette')>()),
  downloadVignettePng: vi.fn().mockResolvedValue(undefined),
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

  it('triggers a full-bleed export by default when a preset is clicked', async () => {
    const { downloadVignettePng } = await import('../lib/vignette')
    render(<ExportModal gradient={sampleGradient} onClose={vi.fn()} />)

    vi.useFakeTimers()
    const wallpaperButton = screen.getByRole('button', { name: /Phone Wallpaper/i })
    fireEvent.click(wallpaperButton)

    // Move forward past timeout
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(downloadVignettePng).toHaveBeenCalledWith(sampleGradient, 1179, 2556, 'full')
    vi.useRealTimers()
  })

  it('lists all five vignette shapes with Full selected by default', () => {
    render(<ExportModal gradient={sampleGradient} onClose={vi.fn()} />)
    const group = screen.getByRole('radiogroup', { name: /vignette shape/i })
    expect(group).toBeInTheDocument()
    for (const label of ['Full', 'Circle', 'Oval', 'Diamond', 'Poster']) {
      expect(screen.getByRole('radio', { name: `${label} vignette` })).toBeInTheDocument()
    }
    expect(screen.getByRole('radio', { name: 'Full vignette' })).toHaveAttribute('aria-checked', 'true')
  })

  it('exports with the selected vignette shape', async () => {
    const { downloadVignettePng } = await import('../lib/vignette')
    render(<ExportModal gradient={sampleGradient} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Poster vignette' }))
    expect(screen.getByRole('radio', { name: 'Poster vignette' })).toHaveAttribute('aria-checked', 'true')
    // Poster preview shows the title caption
    expect(screen.getByText(/linear gradient · 2 colors/i)).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /Instagram Story/i }))
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(downloadVignettePng).toHaveBeenCalledWith(sampleGradient, 1080, 1920, 'poster')
    vi.useRealTimers()
  })
})
