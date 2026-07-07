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
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useHeartFlash } from '../hooks/useHeartFlash'
import { useHint } from '../hooks/useHint'
import { HeartFlash } from './HeartFlash'
import { Hint } from './Hint'
import { GeometryTabs } from './GeometryTabs'
import { FlowEditor } from './FlowEditor'
import { BlockWheel } from './BlockWheel'
import { SwatchTray } from './SwatchTray'
import { TurrellSquare } from './TurrellSquare'
import type { Gradient } from '../store/types'
import styles from './EditMode.module.css'

const WHEEL_TYPES: GradientType[] = ['angular', 'square']

interface EditModeProps {
  gradient: Gradient
  onExit: () => void
}

export function EditMode({ gradient, onExit }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const saveGradient = useAppStore((s) => s.saveGradient)
  const activeColorSet = useAppStore((s) => s.activeColorSet)
  const [editableStops, setEditableStops] = useState<EditableStop[]>(() => toEditableStops(gradient.stops))
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const { visible: heartVisible, flash } = useHeartFlash()
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

  function handleSort(key: SortKey) {
    commit(sortByOklch(editableStops, (s) => s.hex, key))
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

  function handleLike() {
    saveGradient(gradient)
    flash()
  }

  const { onPointerUp: onPreviewPointerUp } = useDoubleTap(handleLike, onExit)

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
        onPointerUp={onPreviewPointerUp}
      >
        {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} />}
        <HeartFlash visible={heartVisible} />
      </div>
      <GeometryTabs type={gradient.type} onSelectType={handleSelectType} onToggleReversed={handleToggleReversed} />
      <div className={styles.sortRow}>
        <button type="button" aria-label="Sort by lightness" className={styles.sortButton} onClick={() => handleSort('lightness')}>
          L
        </button>
        <button type="button" aria-label="Sort by hue" className={styles.sortButton} onClick={() => handleSort('hue')}>
          H
        </button>
        <button type="button" aria-label="Sort by chroma" className={styles.sortButton} onClick={() => handleSort('chroma')}>
          C
        </button>
      </div>
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
      {editHint.visible && <Hint text="Tap a swatch to edit" visible={editHint.visible} />}
    </div>
  )
}
