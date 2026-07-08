import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, type GradientType } from '../lib/gradient'
import {
  toEditableStops,
  equalizePositions,
  removeStopAt,
  addStop,
  removeLastByHex,
  moveStop,
  toGradientStops,
  type EditableStop,
} from '../lib/stopOrdering'
import { sortByOklch, type SortKey } from '../lib/sortColors'
import { useHint } from '../hooks/useHint'
import { Hint } from './Hint'
import { LikeButton } from './LikeButton'
import { GeometryTabs } from './GeometryTabs'
import { FlowEditor } from './FlowEditor'
import { SwatchTray } from './SwatchTray'
import { TurrellSquare } from './TurrellSquare'
import type { Gradient } from '../store/types'
import styles from './EditMode.module.css'

const SORT_KEYS: SortKey[] = ['lightness', 'chroma', 'hue']
const SORT_LABELS: Record<SortKey, string> = { lightness: 'Lightness', chroma: 'Chroma', hue: 'Hue' }

interface EditModeProps {
  gradient: Gradient
  onExit: () => void
}

export function EditMode({ gradient, onExit }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const isGradientSaved = useAppStore((s) => s.isGradientSaved(gradient))
  const toggleSaveGradient = useAppStore((s) => s.toggleSaveGradient)
  const [editableStops, setEditableStops] = useState<EditableStop[]>(() => toEditableStops(gradient.stops))
  const [sortKeyIndex, setSortKeyIndex] = useState(0)
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const previewPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const editHint = useHint('edit')

  useEffect(() => {
    setEditableStops(toEditableStops(gradient.stops))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id])

  // Dragging the sheet downward shrinks its real height so the flexed
  // preview grows live (a true move/resize, not a dissolve); releasing past
  // 30% of the sheet's height exits edit mode. Bound as non-passive DOM
  // listeners so preventDefault() reliably stops the page itself scrolling.
  // Drags that start on the flow-editor stop handles are exempt — those own
  // their own vertical (drag-to-delete) gesture.
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    let startY = 0
    let baseHeight = 0
    let dragY = 0
    let dragging = false

    function handleTouchStart(e: TouchEvent) {
      if ((e.target as HTMLElement).closest('[data-testid="flow-handle"]')) return
      startY = e.touches[0]?.clientY ?? 0
      baseHeight = el!.offsetHeight
      dragY = 0
      dragging = true
    }

    function handleTouchMove(e: TouchEvent) {
      if (!dragging) return
      const y = e.touches[0]?.clientY
      if (y == null) return
      dragY = Math.max(0, y - startY)
      if (dragY > 0) {
        e.preventDefault()
        el!.style.height = `${Math.max(0, baseHeight - dragY)}px`
        el!.style.overflow = 'hidden'
      }
    }

    function handleTouchEnd() {
      if (!dragging) return
      dragging = false
      el!.style.height = ''
      el!.style.overflow = ''
      if (dragY > baseHeight * 0.3) {
        onExitRef.current()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => editHint.dismiss(), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit(nextStops: EditableStop[], overrides?: Partial<Pick<Gradient, 'type' | 'reversed'>>) {
    const equalized = equalizePositions(nextStops)
    setEditableStops(nextStops.map((stop, i) => ({ ...stop, position: equalized[i].position })))
    setCurrentGradient({
      ...gradient,
      ...overrides,
      stops: equalized,
    })
  }

  function handleRemove(id: string) {
    if (editableStops.length <= 2) return
    commit(removeStopAt(editableStops, id))
  }

  function handleSelectType(type: GradientType) {
    commit(editableStops, { type })
  }

  function handleToggleReversed() {
    commit(editableStops, { reversed: !gradient.reversed })
  }

  function isPointOverElement(point: { x: number; y: number }, el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  }

  function handleDragAddFromTray(hex: string, point: { x: number; y: number }) {
    const el = blockContainerRef.current
    if (!el) return
    if (!isPointOverElement(point, el)) return
    commit(addStop(editableStops, hex))
  }

  function handleTapAdd(hex: string) {
    commit(addStop(editableStops, hex))
  }

  function handleTapRemove(hex: string) {
    if (editableStops.length <= 2) return
    commit(removeLastByHex(editableStops, hex))
  }

  function handleSortCycle() {
    const key = SORT_KEYS[sortKeyIndex]
    commit(sortByOklch(editableStops, (s) => s.hex, key))
    setSortKeyIndex((sortKeyIndex + 1) % SORT_KEYS.length)
  }

  function handleTapStop(_id: string) {
    // Placeholder hook for a future "tap to change color" UI. No such UI
    // exists yet in this codebase (BlockStack never wired one either), so
    // this intentionally does nothing until that flow is built.
  }

  // Exit-on-tap for the preview, with two guards: taps on child buttons
  // (like, sort, grain) never exit — target check, since stopPropagation is
  // unreliable across iOS pointer/touch synthesis — and pointer sequences
  // that moved more than a tap threshold (scrolls/drags) never exit either.
  const PREVIEW_TAP_THRESHOLD_PX = 10

  function handlePreviewPointerDown(e: React.PointerEvent) {
    previewPointerStartRef.current = { x: e.clientX, y: e.clientY }
    editHint.dismiss()
  }

  function handlePreviewPointerUp(e: React.PointerEvent) {
    const start = previewPointerStartRef.current
    previewPointerStartRef.current = null
    if ((e.target as HTMLElement).closest('button')) return
    if (start) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.sqrt(dx * dx + dy * dy) > PREVIEW_TAP_THRESHOLD_PX) return
    }
    onExit()
  }

  function handleMoveStop(id: string, position: number) {
    const nextStops = moveStop(editableStops, id, position)
    setEditableStops(nextStops)
    setCurrentGradient({
      ...gradient,
      stops: toGradientStops(nextStops),
    })
  }

  return (
    <div data-testid="edit-mode" className={styles.container} onPointerDown={() => editHint.dismiss()}>
      <button type="button" data-testid="edit-mode-back" aria-label="Back" className={styles.backButton} onClick={onExit}>
        ‹
      </button>
      <div
        data-testid="edit-mode-preview"
        className={styles.preview}
        style={{
          backgroundImage: gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
        }}
        onPointerDown={handlePreviewPointerDown}
        onPointerUp={handlePreviewPointerUp}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
        <LikeButton liked={isGradientSaved} onToggle={() => toggleSaveGradient(gradient)} />
        <button
          type="button"
          data-testid="sort-fab"
          aria-label={`Sort by ${SORT_KEYS[sortKeyIndex]}`}
          className={styles.sortFab}
          onClick={handleSortCycle}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          Sort by: {SORT_LABELS[SORT_KEYS[sortKeyIndex]]}
        </button>
      </div>
      <div data-testid="edit-sheet" ref={sheetRef} className={styles.sheet}>
        <button
          type="button"
          data-testid="sheet-handle"
          aria-label="Collapse controls"
          className={styles.sheetHandle}
          onClick={onExit}
        />
        <GeometryTabs type={gradient.type} onSelectType={handleSelectType} onToggleReversed={handleToggleReversed} />
        <div className={styles.blockArea}>
          <FlowEditor
            stops={editableStops}
            onMove={handleMoveStop}
            onTapStop={handleTapStop}
            onRemoveStop={handleRemove}
            containerRef={blockContainerRef}
          />
        </div>
        <SwatchTray
          colorSet={activeColorSet}
          stops={editableStops}
          onTapAdd={handleTapAdd}
          onTapRemove={handleTapRemove}
          onDragAdd={handleDragAddFromTray}
        />
      </div>
      {editHint.visible && <Hint text="Tap a swatch to edit" visible={editHint.visible} />}
    </div>
  )
}
