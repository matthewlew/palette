import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrumPicker, MIN_DRUM_SLOTS, MAX_DRUM_SLOTS } from './DrumPicker'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'

const DEFAULT_NAMES = [INK_CATALOGUE[0].name, INK_CATALOGUE[1].name, INK_CATALOGUE[2].name, INK_CATALOGUE[3].name]

async function renderOpen(props: Partial<React.ComponentProps<typeof DrumPicker>> = {}) {
  const merged = { selectedNames: DEFAULT_NAMES, onChangeSlot: vi.fn(), ...props }
  render(<DrumPicker {...merged} />)
  fireEvent.click(screen.getByTestId('drum-stack-trigger'))
  await screen.findAllByTestId('drum-slot')
  return merged
}

/** Base UI's Select popup renders via a portal and picks an item by tapping
 * its option row, not by firing a native change event. Its item handlers
 * need the full pointerdown/up sequence userEvent produces — a bare
 * fireEvent.click doesn't register. */
async function pickInkForSlot(slotIndex: number, inkName: string) {
  const user = userEvent.setup()
  const triggers = screen.getAllByTestId('drum-slot-select')
  await user.click(triggers[slotIndex])
  const option = await screen.findByRole('option', { name: inkName })
  await user.click(option)
}

describe('DrumPicker', () => {
  it('collapses to a single trigger button, not the slot list, until tapped', () => {
    render(<DrumPicker selectedNames={DEFAULT_NAMES} onChangeSlot={vi.fn()} />)
    expect(screen.getByTestId('drum-stack-trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('drum-slot')).not.toBeInTheDocument()
  })

  it('shows one overlapping swatch per drum in the trigger', () => {
    render(<DrumPicker selectedNames={DEFAULT_NAMES} onChangeSlot={vi.fn()} />)
    const trigger = screen.getByTestId('drum-stack-trigger')
    expect(trigger.querySelectorAll('span[style*="background-color"]')).toHaveLength(DEFAULT_NAMES.length)
  })

  it('opens the picker sheet with one slot per loaded drum on tap', async () => {
    await renderOpen()
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(DEFAULT_NAMES.length)
  })

  it("shows the assigned ink as each slot's value, with a color preview", async () => {
    await renderOpen({ selectedNames: [INK_CATALOGUE[2].name, INK_CATALOGUE[5].name] })
    const triggers = screen.getAllByTestId('drum-slot-select')
    expect(within(triggers[0]).getByText(INK_CATALOGUE[2].name)).toBeInTheDocument()
    expect(within(triggers[1]).getByText(INK_CATALOGUE[5].name)).toBeInTheDocument()
    const preview = triggers[0].querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(preview.style.backgroundColor).toBeTruthy()
    expect(findInk(INK_CATALOGUE[2].name)?.hex).toBeTruthy()
  })

  it('offers a swatch preview for every catalogue ink in the option list', async () => {
    await renderOpen()
    fireEvent.click(screen.getAllByTestId('drum-slot-select')[0])
    const options = await screen.findAllByTestId('drum-ink-option')
    expect(options).toHaveLength(INK_CATALOGUE.length)
    const swatch = options[0].querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(swatch.style.backgroundColor).toBeTruthy()
  })

  it('calls onChangeSlot with the slot index and the newly picked ink name', async () => {
    const onChangeSlot = vi.fn()
    await renderOpen({ onChangeSlot })
    await pickInkForSlot(1, INK_CATALOGUE[3].name)
    expect(onChangeSlot).toHaveBeenCalledWith(1, INK_CATALOGUE[3].name)
  })

  it('supports fewer than the max drum count', async () => {
    await renderOpen({ selectedNames: DEFAULT_NAMES.slice(0, MIN_DRUM_SLOTS) })
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(MIN_DRUM_SLOTS)
  })

  describe('add/remove', () => {
    it('offers an Add button up to the max, and calls onAddSlot', async () => {
      const onAddSlot = vi.fn()
      await renderOpen({ selectedNames: DEFAULT_NAMES.slice(0, MAX_DRUM_SLOTS - 1), onAddSlot })
      const addBtn = screen.getByTestId('drum-slot-add')
      expect(addBtn).toBeEnabled()
      fireEvent.click(addBtn)
      expect(onAddSlot).toHaveBeenCalled()
    })

    it('disables Add at the max drum count', async () => {
      await renderOpen({ selectedNames: DEFAULT_NAMES, onAddSlot: vi.fn() })
      expect(screen.getByTestId('drum-slot-add')).toBeDisabled()
    })

    it('offers a remove control per slot above the minimum, and calls onRemoveSlot', async () => {
      const onRemoveSlot = vi.fn()
      await renderOpen({ onRemoveSlot })
      const removeButtons = screen.getAllByTestId('drum-slot-remove')
      expect(removeButtons).toHaveLength(DEFAULT_NAMES.length)
      fireEvent.click(removeButtons[2])
      expect(onRemoveSlot).toHaveBeenCalledWith(2)
    })

    it('disables remove at the minimum drum count', async () => {
      await renderOpen({ selectedNames: DEFAULT_NAMES.slice(0, MIN_DRUM_SLOTS), onRemoveSlot: vi.fn() })
      for (const btn of screen.getAllByTestId('drum-slot-remove')) {
        expect(btn).toBeDisabled()
      }
    })

    it('hides add/remove controls entirely when their handlers are omitted', async () => {
      await renderOpen()
      expect(screen.queryByTestId('drum-slot-add')).not.toBeInTheDocument()
      expect(screen.queryByTestId('drum-slot-remove')).not.toBeInTheDocument()
    })
  })
})
