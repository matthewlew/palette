import { useEffect, useRef, useState } from 'react'
import type { GradientType } from '../lib/gradient'
import type { EditableStop } from '../lib/stopOrdering'
import { stopAnchor, type StopAnchorOpts } from '../lib/stopAnchor'
import { anchorWithinThreshold, type PixelPoint } from '../lib/canvasReorder'
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
  fanAnchor,
  cursor,
  size,
  onReorder,
  onDraggingChange,
}: CanvasHandlesProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingSpoke, setDraggingSpoke] = useState<StopAnchorOpts['spoke'] | null>(null)
  const [dragPoint, setDragPoint] = useState<PixelPoint | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<{ id: string; spoke: StopAnchorOpts['spoke']; startX: number; startY: number; timer: number } | null>(null)

  useEffect(() => {
    onDraggingChange?.(draggingId !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId])

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timer)
    }
  }, [])

  const positions = stops.map((s) => s.position)
  const isFourSpoke = type === 'radial' || type === 'square'
  const activeSpokes: readonly StopAnchorOpts['spoke'][] = isFourSpoke
    ? ['up', 'down', 'left', 'right']
    : [spoke ?? 'up']

  interface HandleItem {
    key: string
    stopId: string
    stopIndex: number
    spoke: StopAnchorOpts['spoke']
    anchor: PixelPoint
  }

  const items: HandleItem[] = []
  stops.forEach((stop, i) => {
    activeSpokes.forEach((sp) => {
      const a = stopAnchor(type, positions, i, { spoke: sp, fanAnchor })
      items.push({
        key: isFourSpoke ? `${stop.id}-${sp}` : stop.id,
        stopId: stop.id,
        stopIndex: i,
        spoke: sp,
        anchor: { x: a.x * size.width, y: a.y * size.height },
      })
    })
  })

  const hovering = cursor !== null || draggingId !== null
  const nearItemIndex =
    cursor && !draggingId ? anchorWithinThreshold(items.map((it) => it.anchor), cursor, EMPHASIS_THRESHOLD_PX) : null
  const nearStopIndex = nearItemIndex !== null ? items[nearItemIndex].stopIndex : null

  function toCanvasPoint(e: React.PointerEvent): PixelPoint {
    const rect = overlayRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  function handlePointerDown(e: React.PointerEvent, id: string, sp: StopAnchorOpts['spoke']) {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {}
    const p = toCanvasPoint(e)
    const timer = window.setTimeout(() => {
      if (!pendingRef.current || pendingRef.current.id !== id || pendingRef.current.spoke !== sp) return
      pendingRef.current = null
      setDraggingId(id)
      setDraggingSpoke(sp)
      setDragPoint(p)
    }, DRAG_ARM_DELAY_MS)
    pendingRef.current = { id, spoke: sp, startX: p.x, startY: p.y, timer }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const p = toCanvasPoint(e)
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

    let bestDist = Infinity
    let targetIndex = currentIndex
    items.forEach((it) => {
      const d = Math.hypot(it.anchor.x - p.x, it.anchor.y - p.y)
      if (d < bestDist) {
        bestDist = d
        targetIndex = it.stopIndex
      }
    })

    if (targetIndex !== currentIndex) {
      let currentDist = Infinity
      items.forEach((it) => {
        if (it.stopIndex === currentIndex) {
          const d = Math.hypot(it.anchor.x - p.x, it.anchor.y - p.y)
          if (d < currentDist) currentDist = d
        }
      })
      const HYSTERESIS_PX = 8
      if (bestDist < currentDist - HYSTERESIS_PX) {
        onReorder(moveItem(stops, currentIndex, targetIndex))
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.stopPropagation()
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer)
      pendingRef.current = null
    }
    setDraggingId(null)
    setDraggingSpoke(null)
    setDragPoint(null)
  }

  function projectToTrack(
    item: { spoke: StopAnchorOpts['spoke']; anchor: PixelPoint },
    pt: PixelPoint
  ): PixelPoint {
    const cx = size.width * 0.5
    const cy = size.height * 0.5
    if (type === 'radial' || type === 'square') {
      if (item.spoke === 'up' || item.spoke === 'down') {
        return { x: cx, y: pt.y }
      } else {
        return { x: pt.x, y: cy }
      }
    }
    if (type === 'linear' || type === 'mirror') {
      const LINEAR_X = 0.16
      return { x: LINEAR_X * size.width, y: pt.y }
    }
    if (type === 'angular') {
      const ANGULAR_RADIUS = 0.32
      const dx = pt.x - cx
      const dy = pt.y - cy
      const dist = Math.hypot(dx, dy)
      if (dist < 0.001) return item.anchor
      return {
        x: cx + ANGULAR_RADIUS * size.width * (dx / dist),
        y: cy + ANGULAR_RADIUS * size.height * (dy / dist),
      }
    }
    if (type === 'fan') {
      const FAN_RADIUS = 0.36
      let pivotX = cx, pivotY = size.height
      if (fanAnchor === 'top') { pivotX = cx; pivotY = 0 }
      else if (fanAnchor === 'left') { pivotX = 0; pivotY = cy }
      else if (fanAnchor === 'right') { pivotX = size.width; pivotY = cy }
      const dx = pt.x - pivotX
      const dy = pt.y - pivotY
      const dist = Math.hypot(dx, dy)
      if (dist < 0.001) return item.anchor
      return {
        x: pivotX + FAN_RADIUS * size.width * (dx / dist),
        y: pivotY + FAN_RADIUS * size.height * (dy / dist),
      }
    }
    return pt
  }

  return (
    <div ref={overlayRef} className={styles.overlay} data-testid="canvas-handles">
      {hovering && size.width > 0 && (
        <>
          {isFourSpoke && (
            <>
              <div className={styles.trackGuideVertical} style={{ left: `${size.width * 0.5}px` }} />
              <div className={styles.trackGuideHorizontal} style={{ top: `${size.height * 0.5}px` }} />
            </>
          )}
          {(type === 'linear' || type === 'mirror') && (
            <div className={styles.trackGuideVertical} style={{ left: `${size.width * 0.16}px` }} />
          )}
          {type === 'angular' && (
            <div
              className={styles.trackGuideCircle}
              style={{
                left: `${size.width * (0.5 - 0.32)}px`,
                top: `${size.height * 0.5 - size.width * 0.32}px`,
                width: `${size.width * 0.64}px`,
                height: `${size.width * 0.64}px`,
              }}
            />
          )}
        </>
      )}
      {items.map((item) => {
        const stop = stops[item.stopIndex]
        const isDragging = draggingId === stop.id && (!isFourSpoke || draggingSpoke === item.spoke)
        const isDraggingStop = draggingId === stop.id
        const revealed = hovering || isDraggingStop
        const near = isDraggingStop || nearStopIndex === item.stopIndex
        const light = isLightColor(stop.hex)
        const at = isDragging && dragPoint ? projectToTrack(item, dragPoint) : item.anchor
        return (
          <button
            key={item.key}
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
            onPointerDown={(e) => handlePointerDown(e, stop.id, item.spoke)}
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
