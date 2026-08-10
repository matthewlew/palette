import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrumEditMode } from './DrumEditMode'
import { generateGradientCoverage } from '../lib/riso'
import { INK_CATALOGUE } from '../lib/inkCatalogue'
import { useAppStore } from '../store/useAppStore'
import type { Gradient } from '../store/types'

afterEach(cleanup)

const STARTER_INKS = [INK_CATALOGUE[0].name, INK_CATALOGUE[1].name, INK_CATALOGUE[2].name, INK_CATALOGUE[3].name]

function makeGradient(): Gradient {
  const inkHexes = STARTER_INKS.map((n) => INK_CATALOGUE.find((i) => i.name === n)!.hex)
  const { stops, coverage } = generateGradientCoverage(inkHexes)
  return {
    id: 'g1',
    type: 'linear',
    stops,
    riso: { inks: STARTER_INKS, coverage },
  } as Gradient
}

describe('DrumEditMode drum count', () => {
  it('adding a drum appends a 0% column to every stop, without disturbing existing coverage', async () => {
    const user = userEvent.setup()
    const gradient = makeGradient()
    // 3 inks (below MAX_DRUM_SLOTS=4) so Add is actually enabled.
    gradient.riso = { inks: STARTER_INKS.slice(0, 3), coverage: gradient.riso!.coverage.map((row) => row.slice(0, 3)) }
    render(<DrumEditMode gradient={gradient} onExit={vi.fn()} />)

    fireEvent.click(screen.getByTestId('drum-stack-trigger'))
    await screen.findAllByTestId('drum-slot')
    expect(screen.getAllByTestId('drum-slot')).toHaveLength(3)

    const beforeCoverage = gradient.riso!.coverage.map((row) => [...row])

    await user.click(screen.getByTestId('drum-slot-add'))

    const after = useAppStore.getState().current
    expect(after!.riso!.inks).toHaveLength(4)
    after!.riso!.coverage.forEach((row, i) => {
      expect(row).toHaveLength(4)
      expect(row.slice(0, 3)).toEqual(beforeCoverage[i])
      expect(row[3]).toBe(0)
    })
  })

  it('removing a drum drops its coverage column from every stop', async () => {
    const user = userEvent.setup()
    const gradient = makeGradient()
    render(<DrumEditMode gradient={gradient} onExit={vi.fn()} />)

    fireEvent.click(screen.getByTestId('drum-stack-trigger'))
    await screen.findAllByTestId('drum-slot')

    const beforeCoverage = gradient.riso!.coverage.map((row) => [row[0], row[2], row[3]])

    await user.click(screen.getAllByTestId('drum-slot-remove')[1])

    const after = useAppStore.getState().current
    expect(after!.riso!.inks).toHaveLength(3)
    expect(after!.riso!.coverage.map((row) => row)).toEqual(beforeCoverage)
  })

  it('disables remove once at the minimum drum count', async () => {
    const user = userEvent.setup()
    const gradient = makeGradient()
    render(<DrumEditMode gradient={gradient} onExit={vi.fn()} />)

    fireEvent.click(screen.getByTestId('drum-stack-trigger'))
    await screen.findAllByTestId('drum-slot')

    await user.click(screen.getAllByTestId('drum-slot-remove')[0])
    await user.click(screen.getAllByTestId('drum-slot-remove')[0])
    // Now at MIN_DRUM_SLOTS (2) — every remove button should be disabled.
    for (const btn of screen.getAllByTestId('drum-slot-remove')) {
      expect(btn).toBeDisabled()
    }
    expect(useAppStore.getState().current!.riso!.inks).toHaveLength(2)
  })
})
