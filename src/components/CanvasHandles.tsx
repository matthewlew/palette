import { useEffect, useRef, useState } from 'react'
import type { GradientType } from '../lib/gradient'
import type { EditableStop } from '../lib/stopOrdering'
import { stopAnchor, type StopAnchorOpts } from '../lib/stopAnchor'
import { anchorWithinThreshold, nearestAnchorIndex, type PixelPoint } from '../lib/canvasReorder'
import { moveItem } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import styles from './CanvasHandles.module.css'

const EMPHASIS_THRESHOLD_PX = 24
// Hold briefly before a drag engages, so a quick swipe reads as scrolling,
// not an accidental reorder (same feel as useDragReorder's start delay).
const DRAG_ARM_DELAY_MS = 150
// Moving farther than this before the hold elapses cancels the pending drag —
// the gesture was a swipe/scroll, not a deliberate pick-up.
const SWIPE_CANCEL_PX = 8

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
  /** Fired when a handle drag engages/releases, so the parent can duck
   * chrome (FABs) out of the way of a drag near the edges. */
  onDraggingChange?: (dragging: boolean) => void
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
  onDraggingChange,
}: CanvasHandlesProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Canvas-relative pointer position during an active drag; the dragged dot
  // follows it directly while the displaced dots glide to their new anchors.
  const [dragPoint, setDragPoint] = useState<PixelPoint | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  // Pending (not yet armed) drag: waiting out the hold delay.
  const pendingRef = useRef<{ id: string; startX: number; startY: number; timer: number } | null>(null)

  useEffect(() => {
    onDraggingChange?.(draggingId !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId])

  // Clear any pending arm timer on unmount.
  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer)
    }
  }, [])

  const positions = stops.map((s) => s.position)
  const pixelAnchors: PixelPoint[] = stops.map((_, i) => {
    const a = stopAnchor(type, positions, i, { spoke, corner, fanAnchor })
    return { x: a.x * size.width, y: a.y * size.height }
  })

  // Hovering anywhere over the canvas reveals every handle (so the number of
  // movable colors is obvious); the one nearest the cursor is emphasized.
  const hovering = cursor !== null || draggingId !== null
  const nearIndex =
    cursor && !draggingId ? anchorWithinThreshold(pixelAnchors, cursor, EMPHASIS_THRESHOLD_PX) : null

  /** Pointer position relative to the canvas. jsdom rects are 0-sized, so in
   * tests this passes clientX/Y through unchanged. */
  function toCanvasPoint(e: React.PointerEvent): PixelPoint {
    const rect = overlayRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // The pointer may already be gone (fast tap release / synthetic
      // events); capture is a nicety, not a requirement, so never let it
      // abort arming the drag.
    }
    const p = toCanvasPoint(e)
    const timer = window.setTimeout(() => {
      if (!pendingRef.current || pendingRef.current.id !== id) return
      pendingRef.current = null
      setDraggingId(id)
      setDragPoint(p)
    }, DRAG_ARM_DELAY_MS)
    pendingRef.current = { id, startX: p.x, startY: p.y, timer }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const p = toCanvasPoint(e)
    // Swipe before the hold elapsed: this is a scroll, not a drag — cancel.
    if (pendingRef.current) {
      const moved = Math.hypot(p.x - pendingRef.current.startX, p.y - pendingRef.current.startY)
      if (moved > SWIPE_CANCEL_PX) {
        clearTimeout(pendingRef.current.timer)
        pendingRef.current = null
      }
      return
    }
    if (!draggingId) return
    e.stopPropagation()
    setDragPoint(p)
    const currentIndex = stops.findIndex((s) => s.id === draggingId)
    if (currentIndex === -1) return
    const targetIndex = nearestAnchorIndex(pixelAnchors, p)
    if (targetIndex !== currentIndex) {
      onReorder(moveItem(stops, currentIndex, targetIndex))
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.stopPropagation()
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer)
      pendingRef.current = null
    }
    setDraggingId(null)
    setDragPoint(null)
  }

  return (
    <div ref={overlayRef} className={styles.overlay} data-testid="canvas-handles">
      {stops.map((stop, i) => {
        const isDragging = draggingId === stop.id
        const revealed = hovering || isDragging
        const near = isDragging || nearIndex === i
        const light = isLightColor(stop.hex)
        // The picked-up dot tracks the pointer directly (no transition); the
        // displaced dots glide to their new anchors so a swap reads as motion,
        // not a hard jump.
        const at = isDragging && dragPoint ? dragPoint : pixelAnchors[i]
        return (
          <button
            key={stop.id}
            type="button"
            aria-label={`Reorder ${stop.hex}`}
            data-testid={`canvas-handle-${stop.id}`}
            data-stop-id={stop.id}
            className={[
              styles.dot,
              revealed && styles.dotVisible,
              near && styles.dotNear,
              isDragging && styles.dotDragging,
              light ? styles.dotOnLight : styles.dotOnDark,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${at.x}px`, top: `${at.y}px` }}
            onPointerDown={(e) => handlePointerDown(e, stop.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {revealed && (
              <span
                data-testid={near ? 'canvas-handle-near' : 'canvas-handle-visible'}
                data-stop-id={stop.id}
                className={styles.dotInner}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
