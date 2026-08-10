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
  generateGradientCoverage,
  type DrumEditableStop,
} from '../lib/riso'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'
import { checkGradientCoverage } from '../lib/drumPreflight'
import { downloadDrumPlatesZip, renderDrumPlatePreviews, type DrumPlatePreview } from '../lib/plateExport'
import { DrumPicker, MIN_DRUM_SLOTS, MAX_DRUM_SLOTS } from './DrumPicker'
import { DrumStopList } from './DrumStopList'
import { DrumPreflight } from './DrumPreflight'
import { ScrollTicker } from './ScrollTicker'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { MEDIA_ICON } from '../lib/mediaChrome'
import { Icon } from '../icons'
import type { Gradient } from '../store/types'
import styles from './DrumEditMode.module.css'

const SCROLL_STEP_PX = 60

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
  const [platePreviews, setPlatePreviews] = useState<DrumPlatePreview[] | null>(null)

  const isDesktop = useIsDesktop()
  // Mobile: the sheet covers the bottom of the gradient, so tapping the
  // preview ducks it out of the way instead of leaving edit mode outright —
  // the same tap brings it back. Desktop's side panel never covers the
  // gradient, so there's nothing to reveal — see handlePreviewPointerUp.
  const [sheetHidden, setSheetHidden] = useState(false)
  const previewPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const previewLastYRef = useRef<number | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const PREVIEW_TAP_THRESHOLD_PX = 10

  // Scroll-through-variants feed, mirroring the Create feed (Feed.tsx):
  // scrolling the preview steps through a history of coverage variants for
  // the currently loaded drums, generating a fresh one past the end and
  // keeping everything already seen so scrolling back reaches it again.
  // Lives in a ref (not state) so the wheel/pointer listeners — bound once,
  // deliberately minimal deps — always see the latest history without
  // rebinding.
  const scrollHistoryRef = useRef<DrumEditableStop[][]>([editableStops])
  const scrollIndexRef = useRef(0)
  const [scrollIndex, setScrollIndex] = useState(0)
  const scrollAccumRef = useRef(0)
  const inkNamesRef = useRef(inkNames)
  inkNamesRef.current = inkNames
  const lockedCoverageRef = useRef(lockedCoverage)
  lockedCoverageRef.current = lockedCoverage
  const lockedDrumPositionsRef = useRef(lockedDrumPositions)
  lockedDrumPositionsRef.current = lockedDrumPositions

  useEffect(() => {
    const names = clampInkNames(gradient.riso?.inks ?? [])
    const stops = toEditableStops(
      gradient.stops,
      (gradient.riso?.coverage ?? gradient.stops.map(() => [])).map((row) => clampCoverageRow(row, names.length))
    )
    setInkNames(names)
    setEditableStops(stops)
    setActiveStopId(null)
    scrollHistoryRef.current = [stops]
    scrollIndexRef.current = 0
    setScrollIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id])

  const inkHexes = inkNames.map((name) => findInk(name)?.hex ?? '#000000')

  function commit(nextStops: DrumEditableStop[], nextInkNames: string[] = inkNames) {
    setEditableStops(nextStops)
    const nextHexes = nextInkNames.map((name) => findInk(name)?.hex ?? '#000000')
    const { stops, coverage } = toGradientCoverageStops(nextStops, nextHexes)
    setCurrentGradient({ ...gradient, stops, riso: { inks: nextInkNames, coverage } })
    // Keep the scroll-feed's current slot in step with hand edits (a stop
    // drag, a lock, a manual recoverage) so scrolling away and back doesn't
    // discard them in favor of the variant as it was first generated.
    scrollHistoryRef.current[scrollIndexRef.current] = nextStops
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
    // The scroll history's coverage vectors are one shorter than the new
    // slot count — resetting to just this stop avoids a length mismatch the
    // next time a scroll-generated variant tries to zip coverage with inks.
    scrollHistoryRef.current = [nextStops]
    scrollIndexRef.current = 0
    setScrollIndex(0)
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
    scrollHistoryRef.current = [nextStops]
    scrollIndexRef.current = 0
    setScrollIndex(0)
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

  /** Steps the preview through the scroll-feed's variant history — same
   * shape as Feed.tsx's goTo: within history, replays what's already been
   * generated; past the end, generates one more with the currently loaded
   * inks (honoring whatever coverage/position locks are set) and appends it
   * so scrolling back reaches it again. */
  function goToVariant(newIndex: number) {
    if (newIndex < 0 || newIndex === scrollIndexRef.current) return
    const history = scrollHistoryRef.current
    if (newIndex >= history.length) {
      const hexes = inkNamesRef.current.map((name) => findInk(name)?.hex ?? '#000000')
      const { stops, coverage } = generateGradientCoverage(hexes, lockedCoverageRef.current, lockedDrumPositionsRef.current)
      history.push(toEditableStops(stops, coverage))
    }
    scrollIndexRef.current = newIndex
    setScrollIndex(newIndex)
    commit(history[newIndex])
  }

  function handleOpenExportPreview() {
    setPlatePreviews(renderDrumPlatePreviews(gradient))
  }

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      // `gradient` is the store's `current`, kept in step with `inkNames` and
      // `editableStops` by every `commit()` call above — this is always the
      // latest riso block, not a stale snapshot from mount.
      await downloadDrumPlatesZip(gradient)
      setPlatePreviews(null)
    } finally {
      setExporting(false)
    }
  }

  /** Trackpad/mouse-wheel counterpart to the pointer-drag scrub above —
   * same STEP_PX accumulation, just fed by wheel delta instead of drag
   * distance. */
  function handlePreviewWheel(e: React.WheelEvent) {
    scrollAccumRef.current += e.deltaY
    consumeScrollAccum()
  }

  function consumeScrollAccum() {
    while (scrollAccumRef.current >= SCROLL_STEP_PX) {
      scrollAccumRef.current -= SCROLL_STEP_PX
      goToVariant(scrollIndexRef.current + 1)
    }
    while (scrollAccumRef.current <= -SCROLL_STEP_PX) {
      if (scrollIndexRef.current <= 0) {
        scrollAccumRef.current = 0
        break
      }
      scrollAccumRef.current += SCROLL_STEP_PX
      goToVariant(scrollIndexRef.current - 1)
    }
  }

  /** Matches EditMode's own preview tap: a genuine tap (not a scroll/drag)
   * toggles the sheet on mobile, or exits straight out on desktop, where the
   * side panel never covers the gradient so there's nothing to reveal. A
   * drag past the tap threshold instead scrubs through the variant feed —
   * see goToVariant/consumeScrollAccum. */
  function handlePreviewPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    previewPointerStartRef.current = { x: e.clientX, y: e.clientY }
    previewLastYRef.current = e.clientY
    scrollAccumRef.current = 0
  }

  function handlePreviewPointerMove(e: React.PointerEvent) {
    if (previewPointerStartRef.current === null) return
    if ((e.target as HTMLElement).closest('button')) return
    const lastY = previewLastYRef.current
    if (lastY === null) return
    // Dragging up (finger/cursor moves to smaller Y) steps forward, matching
    // the wheel-down convention used everywhere else in the app.
    const delta = lastY - e.clientY
    previewLastYRef.current = e.clientY
    scrollAccumRef.current += delta
    consumeScrollAccum()
  }

  function handlePreviewPointerUp(e: React.PointerEvent) {
    const start = previewPointerStartRef.current
    previewPointerStartRef.current = null
    previewLastYRef.current = null
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
        onClick={handleOpenExportPreview}
      >
        Export plates
      </button>
      {platePreviews && (
        <div data-testid="drum-plate-preview" className={styles.platePreview}>
          <div className={styles.plateGrid}>
            {platePreviews.map((plate) => (
              <div key={plate.ink} className={styles.plateThumb}>
                <img src={plate.dataUrl} alt={`${plate.ink} plate preview`} className={styles.plateImg} />
                <span className={styles.plateLabel}>{plate.ink}</span>
              </div>
            ))}
          </div>
          <div className={styles.plateActions}>
            <button
              type="button"
              data-testid="drum-plate-preview-cancel"
              className={styles.plateCancelButton}
              onClick={() => setPlatePreviews(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="drum-plate-preview-download"
              className={styles.exportButton}
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? 'Exporting…' : 'Download plates'}
            </button>
          </div>
        </div>
      )}
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
        ref={previewRef}
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
        onPointerMove={handlePreviewPointerMove}
        onPointerUp={handlePreviewPointerUp}
        onWheel={handlePreviewWheel}
      >
        <ScrollTicker index={scrollIndex} />
      </div>
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
