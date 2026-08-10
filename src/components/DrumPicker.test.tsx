import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrumPicker, DRUM_SLOT_COUNT } from './DrumPicker'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'

async function renderOpen(props: Partial<React.ComponentProps<typeof DrumPicker>> = {}) {
  const merged = { selectedNames: [], onChangeSlot: vi.fn(), ...props }
  render(<DrumPicker {...merged} />)
  fireEvent.click(screen.getByTestId('drum-stack-trigger'))
  await screen.findAllByTestId('drum-slot')
  return merged
}

describe('DrumPicker', () => {
  it('collapses to a single trigger button, not the slot list, until tapped', () => {
    render(<DrumPicker selectedNames={[]} onChangeSlot={vi.fn()} />)
    expect(screen.getByTestId('drum-stack-trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('drum-slot')).not.toBeInTheDocument()
  })

  it('shows one overlapping swatch per drum in the trigger', () => {
    render(<DrumPicker selectedNames={[]} onChangeSlot={vi.fn()} />)
    const trigger = screen.getByTestId('drum-stack-trigger')
    expect(trigger.querySelectorAll('span[style*="background-color"]')).toHaveLength(DRUM_SLOT_COUNT)
  })

  it('opens the picker sheet with one slot per drum on tap', async () => {
    await renderOpen()
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(DRUM_SLOT_COUNT)
  })

  it('each slot select offers every catalogue ink', async () => {
    await renderOpen()
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    expect(selects[0].options).toHaveLength(INK_CATALOGUE.length)
  })

  it("shows the assigned ink as each slot's selected value", async () => {
    await renderOpen({ selectedNames: [INK_CATALOGUE[2].name, INK_CATALOGUE[5].name] })
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    expect(selects[0].value).toBe(INK_CATALOGUE[2].name)
    expect(selects[1].value).toBe(INK_CATALOGUE[5].name)
  })

  it('defaults an unassigned slot to the first catalogue ink', async () => {
    await renderOpen({ selectedNames: [INK_CATALOGUE[2].name] })
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    expect(selects[1].value).toBe(INK_CATALOGUE[0].name)
  })

  it("previews the assigned ink's color per slot", async () => {
    await renderOpen({ selectedNames: [INK_CATALOGUE[2].name] })
    const slots = screen.getAllByTestId('drum-slot')
    const preview = slots[0].querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(preview.style.backgroundColor).toBeTruthy()
    expect(findInk(INK_CATALOGUE[2].name)?.hex).toBeTruthy()
  })

  it('calls onChangeSlot with the slot index and the newly picked ink name', async () => {
    const onChangeSlot = vi.fn()
    await renderOpen({ onChangeSlot })
    const selects = screen.getAllByTestId('drum-slot-select') as HTMLSelectElement[]
    fireEvent.change(selects[1], { target: { value: INK_CATALOGUE[3].name } })
    expect(onChangeSlot).toHaveBeenCalledWith(1, INK_CATALOGUE[3].name)
  })

  it('supports a custom slot count', async () => {
    await renderOpen({ slotCount: 2 })
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(2)
  })
})
