import { useEffect, useRef, useState } from 'react'
import { Drawer } from '@base-ui/react/drawer'
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
import { downloadDrumPlatesZip } from '../lib/plateExport'
import { DrumPicker, MIN_DRUM_SLOTS, MAX_DRUM_SLOTS } from './DrumPicker'
import { DrumStopList } from './DrumStopList'
import { DrumPreflight } from './DrumPreflight'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { MEDIA_ICON } from '../lib/mediaChrome'
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
  const [exporting, setExporting] = useState(false)

  const isDesktop = useIsDesktop()
  // Mobile: the sheet covers the bottom of the gradient, so tapping the
  // preview ducks it out of the way instead of leaving edit mode outright —
  // the same tap brings it back. Desktop's side panel never covers the
  // gradient, so there's nothing to reveal — see handlePreviewPointerUp.
  const [sheetHidden, setSheetHidden] = useState(false)
  const previewPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const PREVIEW_TAP_THRESHOLD_PX = 10

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

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      // `gradient` is the store's `current`, kept in step with `inkNames` and
      // `editableStops` by every `commit()` call above — this is always the
      // latest riso block, not a stale snapshot from mount.
      await downloadDrumPlatesZip(gradient)
    } finally {
      setExporting(false)
    }
  }

  /** Matches EditMode's own preview tap: a genuine tap (not a scroll/drag)
   * toggles the sheet on mobile, or exits straight out on desktop, where the
   * side panel never covers the gradient so there's nothing to reveal. */
  function handlePreviewPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    previewPointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  function handlePreviewPointerUp(e: React.PointerEvent) {
    const start = previewPointerStartRef.current
    previewPointerStartRef.current = null
    if ((e.target as HTMLElement).closest('button')) return
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) > PREVIEW_TAP_THRESHOLD_PX) return
    }
    if (!isDesktop) {
      setSheetHidden((prevHidden) => !prevHidden)
      return
    }
    onExit()
  }

  /** Clears the active stop when the sheet's own background (not a child
   * control) is pressed — same handler EditMode uses on its sheet. */
  function handleSheetPointerDown(e: React.PointerEvent) {
    if (e.target === e.currentTarget) setActiveStopId(null)
  }

  const panelBody = (
    <>
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
      <button
        type="button"
        data-testid="drum-export-plates"
        className={styles.exportButton}
        disabled={exporting}
        onClick={handleExport}
      >
        {exporting ? 'Exporting…' : 'Export plates'}
      </button>
    </>
  )

  return (
    <div data-testid="drum-edit-mode" className={styles.container}>
      <button
        type="button"
        data-testid="drum-edit-back"
        aria-label="Back"
        className={[styles.backButton, MEDIA_ICON].join(' ')}
        onClick={onExit}
      >
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
        onPointerDown={handlePreviewPointerDown}
        onPointerUp={handlePreviewPointerUp}
      />
      {isDesktop ? (
        <div data-testid="drum-edit-sheet" className={styles.sheet} onPointerDown={handleSheetPointerDown}>
          <div className={styles.panel}>{panelBody}</div>
        </div>
      ) : (
        // modal={false} + disablePointerDismissal: same reasoning as
        // EditMode's own sheet — the preview beneath has to stay tappable
        // while the sheet is open, and the preview's own reopen tap is
        // itself a press outside the popup that Base UI would otherwise
        // treat as a dismiss.
        <Drawer.Root modal={false} disablePointerDismissal open={!sheetHidden} onOpenChange={(open) => setSheetHidden(!open)}>
          <Drawer.Portal>
            <Drawer.Viewport className={styles.sheetViewport}>
              <Drawer.Popup data-testid="drum-edit-sheet" className={styles.sheet} onPointerDown={handleSheetPointerDown}>
                <div data-testid="sheet-handle" aria-hidden="true" className={styles.sheetHandle} />
                <Drawer.Content className={styles.panel}>{panelBody}</Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </div>
  )
}
