import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss } from '../lib/gradient'
import {
  toEditableStops,
  equalizeEditableStops,
  removeStopAt,
  addStop,
  moveStop,
  toGradientCoverageStops,
  type DrumEditableStop,
} from '../lib/riso'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'
import { checkGradientCoverage } from '../lib/drumPreflight'
import { DrumPicker, MIN_DRUM_SLOTS, MAX_DRUM_SLOTS } from './DrumPicker'
import { DrumStopList } from './DrumStopList'
import { DrumPreflight } from './DrumPreflight'
import { Icon } from '../icons'
import type { Gradient } from '../store/types'
import styles from './DrumEditMode.module.css'

const MAX_STOPS = 8

/** Clamps a persisted ink-name list into [MIN_DRUM_SLOTS, MAX_DRUM_SLOTS] —
 * needed for gradients saved before add/remove existed (or hand-crafted
 * share links) with a name count outside that range. Otherwise the count is
 * left exactly as the user set it — it's no longer a fixed slot count. */
function clampInkNames(names: string[]): string[] {
  const result = names.slice(0, MAX_DRUM_SLOTS)
  while (result.length < MIN_DRUM_SLOTS) {
    result.push(INK_CATALOGUE[result.length % INK_CATALOGUE.length].name)
  }
  return result
}

/** Same clamp for a coverage row, matched to however many names survived
 * clampInkNames — a 0% drum reads as "not contributing," the correct
 * default for a slot that didn't exist in the persisted data. */
function clampCoverageRow(row: number[], slotCount: number): number[] {
  const result = row.slice(0, slotCount)
  while (result.length < slotCount) result.push(0)
  return result
}

/** The next ink not already loaded, so "Add drum" doesn't offer a duplicate
 * of what's already in a slot. */
function nextUnusedInk(names: string[]): string {
  const used = new Set(names)
  return INK_CATALOGUE.find((ink) => !used.has(ink.name))?.name ?? INK_CATALOGUE[0].name
}

interface DrumEditModeProps {
  gradient: Gradient
  onExit: () => void
}

/**
 * The Drum counterpart to EditMode — a screen, not just a component, wiring
 * DrumPicker (ink selection) and DrumStopList (coverage editing) to the
 * store. Deliberately smaller than EditMode: no flow editor, no canvas
 * handles, no gesture navigation — those are EditMode's answers to problems
 * (drag-to-reorder stops spatially, swipe between rolodex candidates) that
 * PRD §6/§7 leave open for Drum's own design pass. This is the minimum that
 * makes DrumPicker/DrumStopList reachable and store-backed.
 */
export function DrumEditMode({ gradient, onExit }: DrumEditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const lockedCoverage = useAppStore((s) => s.lockedCoverage)
  const toggleCoverageLock = useAppStore((s) => s.toggleCoverageLock)
  const syncCoverageLock = useAppStore((s) => s.syncCoverageLock)
  const releaseCoverageLockAt = useAppStore((s) => s.releaseCoverageLockAt)
  const lockedDrumPositions = useAppStore((s) => s.lockedDrumPositions)
  const toggleDrumPositionLock = useAppStore((s) => s.toggleDrumPositionLock)
  const syncDrumPositionLock = useAppStore((s) => s.syncDrumPositionLock)
  const releaseDrumPositionLockAt = useAppStore((s) => s.releaseDrumPositionLockAt)

  const [inkNames, setInkNames] = useState<string[]>(() => clampInkNames(gradient.riso?.inks ?? []))
  const [editableStops, setEditableStops] = useState<DrumEditableStop[]>(() => {
    const names = clampInkNames(gradient.riso?.inks ?? [])
    return toEditableStops(
      gradient.stops,
      (gradient.riso?.coverage ?? gradient.stops.map(() => [])).map((row) => clampCoverageRow(row, names.length))
    )
  })
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const [drumSheetOpen, setDrumSheetOpen] = useState(false)

  useEffect(() => {
    const names = clampInkNames(gradient.riso?.inks ?? [])
    setInkNames(names)
    setEditableStops(
      toEditableStops(
        gradient.stops,
        (gradient.riso?.coverage ?? gradient.stops.map(() => [])).map((row) => clampCoverageRow(row, names.length))
      )
    )
    setActiveStopId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id])

  const inkHexes = inkNames.map((name) => findInk(name)?.hex ?? '#000000')

  function commit(nextStops: DrumEditableStop[], nextInkNames: string[] = inkNames) {
    setEditableStops(nextStops)
    const nextHexes = nextInkNames.map((name) => findInk(name)?.hex ?? '#000000')
    const { stops, coverage } = toGradientCoverageStops(nextStops, nextHexes)
    setCurrentGradient({ ...gradient, stops, riso: { inks: nextInkNames, coverage } })
  }

  /** Swapping a drum's ink never changes the slot count, so every stop's
   * coverage array keeps its length — only the hex that slot's percentage
   * resolves to changes. */
  function handleChangeSlot(slotIndex: number, name: string) {
    const nextNames = inkNames.map((n, i) => (i === slotIndex ? name : n))
    setInkNames(nextNames)
    commit(editableStops, nextNames)
  }

  /** Loading a new drum adds a slot to every stop's coverage array too — a
   * fresh drum starts at 0%, so nothing already on the sheet is disturbed. */
  function handleAddDrum() {
    if (inkNames.length >= MAX_DRUM_SLOTS) return
    const nextNames = [...inkNames, nextUnusedInk(inkNames)]
    setInkNames(nextNames)
    const nextStops = editableStops.map((s) => ({ ...s, coverage: [...s.coverage, 0] }))
    commit(nextStops, nextNames)
  }

  /** Swapping a drum out for good removes its coverage column from every
   * stop's coverage vector. */
  function handleRemoveDrum(slotIndex: number) {
    if (inkNames.length <= MIN_DRUM_SLOTS) return
    const nextNames = inkNames.filter((_, i) => i !== slotIndex)
    setInkNames(nextNames)
    const nextStops = editableStops.map((s) => ({
      ...s,
      coverage: s.coverage.filter((_, i) => i !== slotIndex),
    }))
    commit(nextStops, nextNames)
  }

  function handleRecoverage(id: string, inkIndex: number, percent: number) {
    const nextStops = editableStops.map((s) =>
      s.id === id ? { ...s, coverage: s.coverage.map((c, i) => (i === inkIndex ? percent : c)) } : s
    )
    commit(nextStops)
    const index = nextStops.findIndex((s) => s.id === id)
    const stop = nextStops[index]
    if (index !== -1 && lockedCoverage[index] !== undefined) syncCoverageLock(index, stop.coverage)
  }

  function handleReposition(id: string, position: number) {
    const nextStops = moveStop(editableStops, id, position)
    commit(nextStops)
    const index = nextStops.findIndex((s) => s.id === id)
    if (index !== -1) syncDrumPositionLock(index, Math.round(nextStops[index].position))
  }

  function handleRemove(id: string) {
    if (editableStops.length <= 2) return
    if (activeStopId === id) setActiveStopId(null)
    const index = editableStops.findIndex((s) => s.id === id)
    if (index !== -1) {
      releaseCoverageLockAt(index)
      releaseDrumPositionLockAt(index)
    }
    commit(removeStopAt(editableStops, id))
  }

  function handleAdd() {
    if (editableStops.length >= MAX_STOPS) return
    const seedCoverage = inkNames.map(() => 30)
    const nextStops = addStop(editableStops, seedCoverage)
    const equalized = equalizeEditableStops(nextStops, lockedDrumPositions)
    commit(equalized)
    setActiveStopId(nextStops[nextStops.length - 1].id)
  }

  const hex = gradient.stops[0]?.hex ?? '#ffffff'
  const preflightIssues = checkGradientCoverage(editableStops, inkNames)
  const stopNumbers = Object.fromEntries(editableStops.map((s, i) => [s.id, i + 1]))

  return (
    <div data-testid="drum-edit-mode" className={styles.container}>
      <button type="button" data-testid="drum-edit-back" aria-label="Back" className={styles.backButton} onClick={onExit}>
        <Icon name="chevron-left" size="md" />
      </button>
      <div
        data-testid="drum-edit-preview"
        className={styles.preview}
        style={{
          backgroundImage:
            gradient.type === 'square'
              ? undefined
              : buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
                  repeat: gradient.repeatEnabled,
                  hard: gradient.hardStops,
                  fanAnchor: gradient.fanAnchor,
                  angle: gradient.angle,
                }),
          backgroundColor: gradient.type === 'square' ? hex : undefined,
        }}
      />
      <div className={styles.panel}>
        <DrumPicker
          selectedNames={inkNames}
          onChangeSlot={handleChangeSlot}
          onAddSlot={handleAddDrum}
          onRemoveSlot={handleRemoveDrum}
          open={drumSheetOpen}
          onOpenChange={setDrumSheetOpen}
        />
        <DrumPreflight issues={preflightIssues} stopNumbers={stopNumbers} />
        <DrumStopList
          stops={editableStops}
          inkNames={inkNames}
          inkHexes={inkHexes}
          lockedCoverage={lockedCoverage}
          lockedPositions={lockedDrumPositions}
          onRecoverage={handleRecoverage}
          onReposition={handleReposition}
          onToggleCoverageLock={toggleCoverageLock}
          onTogglePositionLock={toggleDrumPositionLock}
          onRemove={handleRemove}
          onAdd={handleAdd}
          activeStopId={activeStopId}
          onSelect={setActiveStopId}
        />
      </div>
    </div>
  )
}
