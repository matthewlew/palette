import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrumPicker, DRUM_SLOT_COUNT } from './DrumPicker'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'

describe('DrumPicker', () => {
  it('renders exactly DRUM_SLOT_COUNT drum slots', () => {
    render(<DrumPicker selectedNames={[]} onChangeSlot={vi.fn()} />)
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(DRUM_SLOT_COUNT)
  })

  it('each slot select offers every catalogue ink', () => {
    render(<DrumPicker selectedNames={[]} onChangeSlot={vi.fn()} />)
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    expect(selects[0].options).toHaveLength(INK_CATALOGUE.length)
  })

  it('shows the assigned ink as each slot\'s selected value', () => {
    render(<DrumPicker selectedNames={[INK_CATALOGUE[2].name, INK_CATALOGUE[5].name]} onChangeSlot={vi.fn()} />)
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    expect(selects[0].value).toBe(INK_CATALOGUE[2].name)
    expect(selects[1].value).toBe(INK_CATALOGUE[5].name)
  })

  it('defaults an unassigned slot to the first catalogue ink', () => {
    render(<DrumPicker selectedNames={[INK_CATALOGUE[2].name]} onChangeSlot={vi.fn()} />)
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    expect(selects[1].value).toBe(INK_CATALOGUE[0].name)
  })

  it('previews the assigned ink\'s color per slot', () => {
    render(<DrumPicker selectedNames={[INK_CATALOGUE[2].name]} onChangeSlot={vi.fn()} />)
    const slots = screen.getAllByTestId('drum-slot')
    const preview = slots[0].querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(preview.style.backgroundColor).toBeTruthy()
    expect(findInk(INK_CATALOGUE[2].name)?.hex).toBeTruthy()
  })

  it('calls onChangeSlot with the slot index and the newly picked ink name', () => {
    const onChangeSlot = vi.fn()
    render(<DrumPicker selectedNames={[]} onChangeSlot={onChangeSlot} />)
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    selects[1].value = INK_CATALOGUE[3].name
    selects[1].dispatchEvent(new Event('change', { bubbles: true }))
    expect(onChangeSlot).toHaveBeenCalledWith(1, INK_CATALOGUE[3].name)
  })

  it('supports a custom slot count', () => {
    render(<DrumPicker selectedNames={[]} onChangeSlot={vi.fn()} slotCount={2} />)
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(2)
  })
})
