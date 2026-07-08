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
import { BlockWheel } from './BlockWheel'
import { SwatchTray } from './SwatchTray'
import { TurrellSquare } from './TurrellSquare'
import type { Gradient } from '../store/types'
import styles from './EditMode.module.css'

const WHEEL_TYPES: GradientType[] = ['square']
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
  const editHint = useHint('edit')

  useEffect(() => {
    setEditableStops(toEditableStops(gradient.stops))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id])

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

  function handleMoveStop(id: string, position: number) {
    const nextStops = moveStop(editableStops, id, position)
    setEditableStops(nextStops)
    setCurrentGradient({
      ...gradient,
      stops: toGradientStops(nextStops),
    })
  }

  const isWheel = WHEEL_TYPES.includes(gradient.type)

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
        onPointerUp={onExit}
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
      <div data-testid="edit-sheet" className={styles.sheet}>
        <GeometryTabs type={gradient.type} onSelectType={handleSelectType} onToggleReversed={handleToggleReversed} />
        <div className={styles.blockArea}>
          {isWheel ? (
            <BlockWheel
              stops={editableStops}
              onReorder={(next) => commit(next)}
              onRemove={handleRemove}
              containerRef={blockContainerRef}
            />
          ) : (
            <FlowEditor stops={editableStops} onMove={handleMoveStop} onTapStop={handleTapStop} containerRef={blockContainerRef} />
          )}
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
