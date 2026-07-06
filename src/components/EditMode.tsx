import { useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildGradientCss, type GradientType } from '../lib/gradient'
import { toEditableStops, equalizePositions, removeStopAt, addStop, type EditableStop } from '../lib/stopOrdering'
import { SEED_PALETTES } from '../lib/seedPalettes'
import { GeometryTabs } from './GeometryTabs'
import { BlockStack } from './BlockStack'
import { BlockWheel } from './BlockWheel'
import { SwatchCarousel } from './SwatchCarousel'
import type { Gradient } from '../store/types'
import styles from './EditMode.module.css'

const WHEEL_TYPES: GradientType[] = ['angular', 'square']

interface EditModeProps {
  gradient: Gradient
  onExit: () => void
}

export function EditMode({ gradient, onExit }: EditModeProps) {
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const [editableStops, setEditableStops] = useState<EditableStop[]>(() => toEditableStops(gradient.stops))
  const blockContainerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>

  // Re-derives editableStops only when the gradient identity changes, not on
  // every stops mutation — safe only because nothing else calls
  // setCurrentGradient while EditMode is mounted (Feed, the only other
  // caller, is unmounted whenever mode === 'edit'). If a future change adds
  // another setCurrentGradient caller reachable in edit mode, this would
  // silently drift from the store.
  useEffect(() => {
    setEditableStops(toEditableStops(gradient.stops))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradient.id])

  function commit(nextStops: EditableStop[], overrides?: Partial<Pick<Gradient, 'type' | 'reversed'>>) {
    setEditableStops(nextStops)
    setCurrentGradient({
      ...gradient,
      ...overrides,
      stops: equalizePositions(nextStops),
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

  function handleDragAddFromCarousel(hex: string, point: { x: number; y: number }) {
    const el = blockContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const isOverStack =
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    if (isOverStack) {
      commit(addStop(editableStops, hex))
    }
  }

  const isWheel = WHEEL_TYPES.includes(gradient.type)
  const seedName = gradient.seedName ?? SEED_PALETTES[0].name

  return (
    <div data-testid="edit-mode" className={styles.container}>
      <div
        data-testid="edit-mode-preview"
        className={styles.preview}
        style={{ backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed) }}
      />
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
          <BlockStack
            stops={editableStops}
            onReorder={(next) => commit(next)}
            onRemove={handleRemove}
            containerRef={blockContainerRef}
          />
        )}
      </div>
      <SwatchCarousel seedName={seedName} onDragAdd={handleDragAddFromCarousel} />
      <button type="button" data-testid="edit-mode-exit" className={styles.exitButton} onClick={onExit}>
        Done
      </button>
    </div>
  )
}
