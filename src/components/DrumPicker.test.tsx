import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrumPicker } from './DrumPicker'
import { INK_CATALOGUE } from '../lib/inkCatalogue'

describe('DrumPicker', () => {
  it('renders one swatch per catalogue ink', () => {
    render(<DrumPicker selectedNames={[]} onToggle={vi.fn()} />)
    expect(screen.getAllByTestId('drum-swatch')).toHaveLength(INK_CATALOGUE.length)
  })

  it('shows a checkmark only for selected names', () => {
    render(<DrumPicker selectedNames={[INK_CATALOGUE[0].name]} onToggle={vi.fn()} />)
    expect(screen.getAllByTestId('drum-swatch-checkmark')).toHaveLength(1)
  })

  it('calls onToggle with the ink name when its swatch is clicked', () => {
    const onToggle = vi.fn()
    render(<DrumPicker selectedNames={[]} onToggle={onToggle} />)
    screen.getByLabelText(INK_CATALOGUE[1].name).click()
    expect(onToggle).toHaveBeenCalledWith(INK_CATALOGUE[1].name)
  })

  it('disables unselected swatches once maxSelected is reached, but leaves selected ones enabled', () => {
    const selected = [INK_CATALOGUE[0].name, INK_CATALOGUE[1].name]
    render(<DrumPicker selectedNames={selected} onToggle={vi.fn()} maxSelected={2} />)
    expect(screen.getByLabelText(INK_CATALOGUE[0].name)).not.toBeDisabled()
    expect(screen.getByLabelText(INK_CATALOGUE[2].name)).toBeDisabled()
  })

  it('does not disable anything when under the limit', () => {
    render(<DrumPicker selectedNames={[INK_CATALOGUE[0].name]} onToggle={vi.fn()} maxSelected={2} />)
    expect(screen.getByLabelText(INK_CATALOGUE[1].name)).not.toBeDisabled()
  })
})
