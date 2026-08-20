import { useEffect, useRef, useState, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { useAppStore } from '../store/useAppStore'
import {
  buildGradientCss,
  angleForTypeChange,
  nextRotationAngle,
  nextFanRotation,
  SELECTABLE_GEOMETRY,
  type GradientType,
} from '../lib/gradient'
import {
  toEditableStops,
  equalizeEditableStops,
  removeStopAt,
  addStop,
  moveStop,
  toGradientCoverageStops,
  generateGradientCoverage,
  coverageToHex,
  isEvenlyDistributed,
  type DrumEditableStop,
} from '../lib/riso'
import type { EditableStop } from '../lib/stopOrdering'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'
import { checkGradientCoverage } from '../lib/drumPreflight'
import { downloadDrumPlatesZip, renderDrumPlatePreviews, renderCompositePreview, type DrumPlatePreview } from '../lib/plateExport'
import { PAPER_STOCKS, DEFAULT_PAPER_STOCK, findPaperStock } from '../lib/paperStock'
import { PaperTexture } from './PaperTexture'
import { DrumPicker, MIN_DRUM_SLOTS, MAX_DRUM_SLOTS, STANDARD_DRUM_INKS } from './DrumPicker'
import { DrumStopList } from './DrumStopList'
import { DrumPreflight } from './DrumPreflight'
import { ScrollTicker } from './ScrollTicker'
import { GeometryTabs } from './GeometryTabs'
import { FlowEditor } from './FlowEditor'
import { BoardShare } from './BoardShare'
import { NoiseOverlay } from './NoiseOverlay'
import { TurrellSquare } from './TurrellSquare'
import { LikeButton } from './LikeButton'
import { PaletteTitle } from './PaletteTitle'
import { namePalette } from '../lib/naming'
import { launchSaveFlight, saveFlightOrigin } from '../lib/saveFlight'
import { tickHaptic } from '../lib/haptics'
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
  onImport?: (jsonText: string) => void
}

/**
 * The Drum counterpart to EditMode — a screen, not just a component, wiring
 * DrumPicker (ink selection) and DrumStopList (coverage editing) to the
 * store.
 */
export function DrumEditMode({ gradient, onExit, onImport = () => {} }: DrumEditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saved = useAppStore((s) => s.saved)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const noiseEnabled = useAppStore((s) => s.noiseEnabled)
  const toggleNoise = useAppStore((s) => s.toggleNoise)
  const isGradientSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const renameCurrentGradient = useAppStore((s) => s.renameCurrentGradient)
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
  // Preview-only — see plateExport.ts's renderDrumPlatePreviews/
  // renderCompositePreview `background` param. The export itself never sees
  // this; it's always a flattened white-base raster.
  const [paperStockId, setPaperStockId] = useState(DEFAULT_PAPER_STOCK.id)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)
  const [previewTab, setPreviewTab] = useState<'plates' | 'composite'>('plates')
  // Tapping a plate expands it to a single large view and collapses the
  // rest, tapping again (or switching stock/tab) returns to the grid.
  const [expandedPlateInk, setExpandedPlateInk] = useState<string | null>(null)

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

  // The standalone horizontal scrub bar (FlowEditor) — same strip-with-dots
  // control the palette side has. Lives in the sheet, not on the preview.
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>

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
  const editableStopsRef = useRef(editableStops)
  editableStopsRef.current = editableStops
  const gradientRef = useRef(gradient)
  gradientRef.current = gradient
  const lockedCoverageRef = useRef(lockedCoverage)
  lockedCoverageRef.current = lockedCoverage
  const lockedDrumPositionsRef = useRef(lockedDrumPositions)
  lockedDrumPositionsRef.current = lockedDrumPositions

  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  // Same shortcut set EditMode offers, scoped to what Drum has: no per-stop
  // hue sort (coverage is multi-dimensional, there's no single sort axis) and
  // no toggle-save (Drum's save fires on plate export, not a togglable pin).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number'])
      const isTextInput = target?.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((target as HTMLInputElement).type)
      const inTextField = isTextInput || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if (e.key === 'Escape' && !inTextField) {
        e.preventDefault()
        onExitRef.current()
        return
      }

      if (
        inTextField ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (target instanceof Element && target.closest('[role="slider"]'))
      ) {
        return
      }

      const onButton = target?.tagName === 'BUTTON'
      if (e.key === 'PageDown' || e.key === 'ArrowDown') {
        e.preventDefault()
        goToVariant(scrollIndexRef.current + 1)
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (scrollIndexRef.current > 0) goToVariant(scrollIndexRef.current - 1)
      } else if (e.key === 's' || e.key === 'S' || (e.key === ' ' && !onButton)) {
        e.preventDefault()
        const state = useAppStore.getState()
        if (state.current) {
          if (!state.isGradientSaved(state.current)) {
            launchSaveFlight(state.current, saveFlightOrigin())
          }
          state.toggleSaveGradient(state.current)
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const currentGrad = gradientRef.current
        const currentIndex = Math.max(0, SELECTABLE_GEOMETRY.indexOf(currentGrad.type))
        const len = SELECTABLE_GEOMETRY.length
        const nextIndex = e.key === 'ArrowRight' ? (currentIndex + 1) % len : (currentIndex - 1 + len) % len
        const nextType = SELECTABLE_GEOMETRY[nextIndex]
        const angle = angleForTypeChange(currentGrad.type, nextType, currentGrad.angle)
        const { stops, coverage } = toGradientCoverageStops(
          editableStopsRef.current,
          inkNamesRef.current.map((name) => findInk(name)?.hex ?? '#000000')
        )
        setCurrentGradient({ ...currentGrad, type: nextType, angle, stops, riso: { inks: inkNamesRef.current, coverage } })
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        const reversedPositions = editableStopsRef.current.map((s) => ({ ...s, position: 100 - s.position }))
        commit(reversedPositions)
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        const currentGrad = gradientRef.current
        const angle = nextRotationAngle(currentGrad.type, currentGrad.angle)
        const { stops, coverage } = toGradientCoverageStops(
          editableStopsRef.current,
          inkNamesRef.current.map((name) => findInk(name)?.hex ?? '#000000')
        )
        setCurrentGradient({ ...currentGrad, angle, stops, riso: { inks: inkNamesRef.current, coverage } })
      }
    }

    // Capture, not bubble — same reasoning as EditMode: Base UI's Drawer.Popup
    // stops propagation of arrow/Home/End keydowns it assumes belong to a
    // composite widget inside it, which would otherwise swallow these the
    // moment focus is inside the mobile sheet.
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  /** FlowEditor's own "+": lands the new stop exactly where the track was
   * tapped, unlike handleAdd's widest-gap placement. */
  function handleAddStopAt(position: number) {
    if (editableStops.length >= MAX_STOPS) return
    const seedCoverage = inkNames.map(() => 30)
    const newStop: DrumEditableStop = { id: crypto.randomUUID(), coverage: seedCoverage, position }
    commit([...editableStops, newStop])
    setActiveStopId(newStop.id)
  }

  /** Shape/effect edits (type, angle, reversed, repeat, hard stops) never
   * touch coverage or ink loadout — same split as EditMode's
   * commitPreservingPositions, just re-deriving stops/coverage from the
   * current editableStops instead of a plain hex list. */
  function commitGeometry(
    overrides: Partial<
      Pick<Gradient, 'type' | 'reversed' | 'repeatEnabled' | 'hardStops' | 'smoothEnabled' | 'prismEnabled' | 'rainbowEnabled' | 'ringEnabled' | 'fanAnchor' | 'angle'>
    >
  ) {
    const { stops, coverage } = toGradientCoverageStops(editableStops, inkHexes)
    setCurrentGradient({ ...gradient, ...overrides, stops, riso: { inks: inkNames, coverage } })
  }

  function handleSelectType(type: GradientType) {
    const angle = angleForTypeChange(gradient.type, type, gradient.angle)
    commitGeometry({ type, angle })
  }

  function handleToggleReversed() {
    const reversedPositions = editableStops.map((s) => ({ ...s, position: 100 - s.position }))
    commit(reversedPositions)
  }

  function handleToggleRepeat() {
    commitGeometry({ repeatEnabled: !gradient.repeatEnabled })
  }

  // This editor has no chips for Rainbow/Ring (no UI here can turn them on),
  // but a gradient can still arrive with one set from EditMode — so every
  // blend-mode toggle here clears them too, to keep the "at most one blend
  // mode" invariant EditMode enforces rather than silently leaving two set.
  function handleToggleHardStops() {
    commitGeometry({ hardStops: !gradient.hardStops, smoothEnabled: false, prismEnabled: false, rainbowEnabled: false, ringEnabled: false })
  }

  function handleToggleSmooth() {
    commitGeometry({ smoothEnabled: !gradient.smoothEnabled, hardStops: false, prismEnabled: false, rainbowEnabled: false, ringEnabled: false })
  }

  function handleTogglePrism() {
    commitGeometry({ prismEnabled: !gradient.prismEnabled, hardStops: false, smoothEnabled: false, rainbowEnabled: false, ringEnabled: false })
  }

  function handleRotateAngle() {
    commitGeometry({ angle: nextRotationAngle(gradient.type, gradient.angle) })
  }

  function handleRotateFan() {
    const { angle, fanAnchor } = nextFanRotation(gradient.angle)
    commitGeometry({ angle, fanAnchor })
  }

  /** Loads the standard 4-color set back in, replacing whatever's currently
   * loaded — the escape hatch back to the loadout most people never need to
   * leave. Coverage carries over slot-for-slot where a slot survives, and
   * starts at 0% for any newly (re)introduced ink, same as Add drum. */
  function handleResetDrums() {
    const nextStops = editableStops.map((s) => ({
      ...s,
      coverage: STANDARD_DRUM_INKS.map((_, i) => s.coverage[i] ?? 0),
    }))
    setInkNames(STANDARD_DRUM_INKS)
    commit(nextStops, STANDARD_DRUM_INKS)
    scrollHistoryRef.current = [nextStops]
    scrollIndexRef.current = 0
    setScrollIndex(0)
    tickHaptic()
  }

  function handleResetSpacing() {
    commit(equalizeEditableStops(editableStops, lockedDrumPositions))
    tickHaptic()
  }

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
    tickHaptic()
  }

  /** Re-rasterizes both the per-ink plates and the composite against
   * whichever stock is currently selected — called on open and again on
   * every stock change, since the tint is baked into the raster rather than
   * layered on top (see plateExport.ts). */
  function refreshPlatePreviews(stockId: string) {
    const stock = findPaperStock(stockId)
    setPlatePreviews(renderDrumPlatePreviews(gradient, stock.color))
    setCompositePreview(renderCompositePreview(gradient, stock.color))
  }

  function handleOpenExportPreview() {
    refreshPlatePreviews(paperStockId)
  }

  function handleChangePaperStock(stockId: string) {
    setPaperStockId(stockId)
    if (platePreviews) refreshPlatePreviews(stockId)
  }

  function handleClosePlatePreview() {
    setPlatePreviews(null)
    setCompositePreview(null)
    setPreviewTab('plates')
    setExpandedPlateInk(null)
  }

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      // `gradient` is the store's `current`, kept in step with `inkNames` and
      // `editableStops` by every `commit()` call above — this is always the
      // latest riso block, not a stale snapshot from mount.
      await downloadDrumPlatesZip(gradient)
      saveGradient(gradient)
      handleClosePlatePreview()
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

  // FlowEditor works over EditableStop (id/hex/position) rather than
  // DrumEditableStop (id/coverage/position) — hex here is only for the dot's
  // display color, derived the same way the preview itself resolves a stop's
  // composite.
  const canvasStops: EditableStop[] = editableStops.map((s) => ({
    id: s.id,
    hex: coverageToHex(s.coverage, inkHexes),
    position: s.position,
  }))

  /** Clears the active stop when the sheet's own background (not a child
   * control) is pressed — same handler EditMode uses on its sheet. */
  function handleSheetPointerDown(e: React.PointerEvent) {
    if (e.target === e.currentTarget) setActiveStopId(null)
  }

  const panelBody = (
    <>
      <div className={styles.panelScroll}>
        <GeometryTabs
          gradient={gradient}
          stops={gradient.stops}
          onSelectType={handleSelectType}
          onToggleReversed={handleToggleReversed}
          onToggleRepeat={handleToggleRepeat}
          onToggleHardStops={handleToggleHardStops}
          onToggleSmooth={handleToggleSmooth}
          onTogglePrism={handleTogglePrism}
          onRotateFan={handleRotateFan}
          onRotate={handleRotateAngle}
          noiseEnabled={noiseEnabled}
          onToggleNoise={toggleNoise}
        />
        <DrumPicker
          selectedNames={inkNames}
          onChangeSlot={handleChangeSlot}
          onAddSlot={handleAddDrum}
          onRemoveSlot={handleRemoveDrum}
          open={drumSheetOpen}
          onOpenChange={setDrumSheetOpen}
          onResetDrums={handleResetDrums}
        />
        {/* The standalone scrub bar — a strip of the gradient with circle
            handles, same control the palette side's EditMode uses (FlowEditor).
            Repositioning here funnels through handleReposition/commit. */}
        <div className={styles.blockArea}>
          <FlowEditor
            stops={canvasStops}
            onMove={handleReposition}
            onTapStop={setActiveStopId}
            onRemoveStop={handleRemove}
            onAddStopAt={handleAddStopAt}
            containerRef={blockContainerRef}
            activeStopId={activeStopId}
          />
        </div>
        <div className={styles.stopActions}>
          <span className={styles.stopHint}>Tap a blank spot to add · drag down to remove</span>
          {/* Only when the spacing has actually drifted off the even ladder,
              matching EditMode's discoverable reset button. */}
          {!isEvenlyDistributed(editableStops) && (
            <button
              type="button"
              data-testid="drum-reset-spacing"
              className={`lds-chip ${styles.resetButton}`}
              onClick={handleResetSpacing}
            >
              Reset spacing
            </button>
          )}
        </div>
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
      {/* Anchored footer, outside the scrolling area above, so Export stays
          reachable at a fixed spot regardless of how long the stop list
          grows — not trailing off the bottom of a scroll the user has to
          hunt for. */}
      <div className={styles.panelFooter}>
        {platePreviews ? (
          <div data-testid="drum-plate-preview" className={styles.platePreview}>
            {/* Ideal stocks for riso ink adhesion are vellum/toothy finishes,
                not smooth coated ones — the four offered are all in that
                family (see paperStock.ts). Tint is baked into the raster
                itself, so switching stock re-renders both previews. */}
            <div className={styles.stockRow} role="radiogroup" aria-label="Paper stock">
              {PAPER_STOCKS.map((stock) => (
                <button
                  key={stock.id}
                  type="button"
                  data-testid="drum-plate-stock"
                  role="radio"
                  aria-checked={stock.id === paperStockId}
                  className={[styles.stockPill, stock.id === paperStockId && styles.stockPillOn].filter(Boolean).join(' ')}
                  style={{ '--stock-color': stock.color } as React.CSSProperties}
                  onClick={() => handleChangePaperStock(stock.id)}
                >
                  <span className={styles.stockSwatch} aria-hidden="true" />
                  {stock.name}
                </button>
              ))}
            </div>

            <div className={styles.plateTabs} role="tablist">
              <button
                type="button"
                data-testid="drum-plate-tab-plates"
                role="tab"
                aria-selected={previewTab === 'plates'}
                className={[styles.plateTab, previewTab === 'plates' && styles.plateTabOn].filter(Boolean).join(' ')}
                onClick={() => setPreviewTab('plates')}
              >
                Plates
              </button>
              <button
                type="button"
                data-testid="drum-plate-tab-composite"
                role="tab"
                aria-selected={previewTab === 'composite'}
                className={[styles.plateTab, previewTab === 'composite' && styles.plateTabOn].filter(Boolean).join(' ')}
                onClick={() => setPreviewTab('composite')}
              >
                Composite
              </button>
            </div>

            {previewTab === 'composite' ? (
              <div className={styles.compositeWrap}>
                <div data-testid="drum-plate-composite" className={styles.compositeFrame}>
                  {compositePreview && <img src={compositePreview} alt="Composite overprint preview" className={styles.compositeImg} />}
                  <PaperTexture stock={findPaperStock(paperStockId)} />
                </div>
                {/* Same "viewing only" discipline PRD §10's Inkling review
                    borrowed the pattern from — a composite is never what gets
                    exported, only individual separations are. */}
                <span className={styles.compositeNote}>Viewing only — export always prints separations</span>
              </div>
            ) : (
              <div className={[styles.plateGrid, expandedPlateInk && styles.plateGridExpanded].filter(Boolean).join(' ')}>
                {platePreviews.map((plate) => {
                  const expanded = expandedPlateInk === plate.ink
                  if (expandedPlateInk && !expanded) return null
                  return (
                    <button
                      key={plate.ink}
                      type="button"
                      data-testid="drum-plate-thumb"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${plate.ink} plate preview`}
                      className={[styles.plateThumb, expanded && styles.plateThumbExpanded].filter(Boolean).join(' ')}
                      onClick={() => setExpandedPlateInk(expanded ? null : plate.ink)}
                    >
                      <span className={styles.plateImgFrame}>
                        <img src={plate.dataUrl} alt={`${plate.ink} plate preview`} className={styles.plateImg} />
                        <PaperTexture stock={findPaperStock(paperStockId)} />
                      </span>
                      <span className={styles.plateLabelRow}>
                        <span
                          className={styles.plateSwatch}
                          aria-hidden="true"
                          style={{ backgroundColor: findInk(plate.ink)?.hex ?? '#000000' }}
                        />
                        <span className={styles.plateLabel}>{plate.ink}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className={styles.plateActions}>
              <button
                type="button"
                data-testid="drum-plate-preview-cancel"
                className={styles.plateCancelButton}
                onClick={handleClosePlatePreview}
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
        ) : (
          <button
            type="button"
            data-testid="drum-export-plates"
            className={styles.exportButton}
            disabled={exporting}
            onClick={handleOpenExportPreview}
          >
            Export plates
          </button>
        )}
      </div>
    </>
  )

  return (
    <div data-testid="drum-edit-mode" className={styles.container}>
      <button
        type="button"
        data-testid="drum-edit-back"
        aria-label="Back"
        className={[styles.backButton, MEDIA_ICON].filter(Boolean).join(' ')}
        onClick={onExit}
      >
        <Icon name="chevron-left" size="md" />
      </button>
      <BoardShare saved={saved} current={gradient} onImport={onImport} chromeVisible position="editor" />
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
                  smooth: gradient.smoothEnabled,
                  prism: gradient.prismEnabled,
                  rainbow: gradient.rainbowEnabled,
                  ring: gradient.ringEnabled,
                }),
        }}
        onPointerDown={handlePreviewPointerDown}
        onPointerMove={handlePreviewPointerMove}
        onPointerUp={handlePreviewPointerUp}
        onWheel={handlePreviewWheel}
      >
        <ScrollTicker index={scrollIndex} />
        {/* Turrell reads "Hard" as crisp: no blur between the nested squares. */}
        {gradient.type === 'square' && (
          <TurrellSquare
            stops={gradient.stops}
            reversed={gradient.reversed}
            repeatEnabled={gradient.repeatEnabled}
            blurPx={gradient.hardStops ? 0 : undefined}
            angle={gradient.angle}
          />
        )}
        <NoiseOverlay visible={noiseEnabled} />
        <PaletteTitle
          name={gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))}
          onRename={renameCurrentGradient}
        />
        {/* The persistent save toggle EditMode keeps on the gradient itself —
            separate from (and safe alongside) the save that also fires when
            plates are exported: saveGradient dedupes by signature. */}
        <LikeButton
          liked={isGradientSaved}
          onToggle={() => toggleSaveGradient(gradient)}
          gradient={gradient}
        />
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
