import { useState } from 'react'
import type { GradientType } from '../lib/gradient'
import type { EditableStop } from '../lib/stopOrdering'
import { stopAnchor, type StopAnchorOpts } from '../lib/stopAnchor'
import { anchorWithinThreshold, nearestAnchorIndex, type PixelPoint } from '../lib/canvasReorder'
import { moveItem } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import styles from './CanvasHandles.module.css'

const REVEAL_THRESHOLD_PX = 24

interface CanvasHandlesProps {
  stops: EditableStop[]
  type: GradientType
  spoke?: StopAnchorOpts['spoke']
  corner?: StopAnchorOpts['corner']
  fanAnchor?: StopAnchorOpts['fanAnchor']
  /** Cursor position in pixels relative to the canvas, or null when the
   * pointer is outside/absent. Measured by the parent. */
  cursor: PixelPoint | null
  /** Canvas pixel size, for converting normalized anchors to pixel space. */
  size: { width: number; height: number }
  onReorder: (next: EditableStop[]) => void
}

export function CanvasHandles({
  stops,
  type,
  spoke,
  corner,
  fanAnchor,
  cursor,
  size,
  onReorder,
}: CanvasHandlesProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const positions = stops.map((s) => s.position)
  const pixelAnchors: PixelPoint[] = stops.map((_, i) => {
    const a = stopAnchor(type, positions, i, { spoke, corner, fanAnchor })
    return { x: a.x * size.width, y: a.y * size.height }
  })

  const hoveredIndex =
    cursor && !draggingId ? anchorWithinThreshold(pixelAnchors, cursor, REVEAL_THRESHOLD_PX) : null

  function handlePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDraggingId(id)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingId) return
    e.stopPropagation()
    const cursorPx = { x: e.clientX, y: e.clientY }
    // clientX/Y are viewport-relative; tests drive this directly with the
    // same coordinate space as `cursor`/`size` (canvas-relative), which is
    // valid because CanvasHandles never reads DOM position itself — the
    // parent is responsible for keeping clientX/Y and `cursor` consistent.
    const currentIndex = stops.findIndex((s) => s.id === draggingId)
    if (currentIndex === -1) return
    const targetIndex = nearestAnchorIndex(pixelAnchors, cursorPx)
    if (targetIndex !== currentIndex) {
      onReorder(moveItem(stops, currentIndex, targetIndex))
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.stopPropagation()
    setDraggingId(null)
  }

  return (
    <div className={styles.overlay} data-testid="canvas-handles">
      {stops.map((stop, i) => {
        const revealed = draggingId === stop.id || hoveredIndex === i
        const light = isLightColor(stop.hex)
        return (
          <button
            key={stop.id}
            type="button"
            aria-label={`Reorder ${stop.hex}`}
            data-testid={`canvas-handle-${stop.id}`}
            data-stop-id={stop.id}
            className={[styles.dot, revealed && styles.dotVisible, light ? styles.dotOnLight : styles.dotOnDark]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${pixelAnchors[i].x}px`, top: `${pixelAnchors[i].y}px` }}
            onPointerDown={(e) => handlePointerDown(e, stop.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {revealed && <span data-testid="canvas-handle-visible" data-stop-id={stop.id} className={styles.dotInner} />}
          </button>
        )
      })}
    </div>
  )
}
