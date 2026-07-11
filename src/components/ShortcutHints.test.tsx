import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShortcutHints } from './ShortcutHints'

const items = [
  { keys: ['↑', '↓'], label: 'Browse' },
  { keys: ['S'], label: 'Save' },
]

describe('ShortcutHints', () => {
  it('renders a key pill per key and a label per action', () => {
    render(<ShortcutHints items={items} />)
    expect(screen.getByText('↑')).toBeInTheDocument()
    expect(screen.getByText('↓')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByText('Browse')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('is labelled for assistive tech', () => {
    render(<ShortcutHints items={items} />)
    expect(screen.getByLabelText('Keyboard shortcuts')).toBeInTheDocument()
  })

  it('fades out when not visible but stays in the DOM', () => {
    render(<ShortcutHints items={items} visible={false} />)
    const strip = screen.getByLabelText('Keyboard shortcuts')
    expect(strip.className).toContain('hidden')
  })
})
