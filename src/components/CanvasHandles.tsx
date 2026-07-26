import { useEffect, useRef, useState } from 'react'
import type { GradientType } from '../lib/gradient'
import { resolveFanConfig, getRadialConfig } from '../lib/gradient'
import type { EditableStop } from '../lib/stopOrdering'
import { stopAnchor, type StopAnchorOpts } from '../lib/stopAnchor'
import { anchorWithinThreshold, type PixelPoint } from '../lib/canvasReorder'
import { moveItem } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import styles from './CanvasHandles.module.css'

const EMPHASIS_THRESHOLD_PX = 24
// Angular/fan radii, as a fraction of the canvas's shorter side (so their
// handle rings stay circular on non-square canvases instead of stretching into
// ellipses). Must match stopAnchor's ANGULAR_RADIUS / FAN_RADIUS.
const ANGULAR_RADIUS = 0.32
const FAN_RADIUS = 0.35
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
  /** Repeat ×2 is on, so handles map into the first (half-size) cycle. */
  repeat?: boolean
  /** Cursor position in pixels relative to the canvas, or null when the
   * pointer is outside/absent. Measured by the parent. */
  cursor: PixelPoint | null
  /** Canvas pixel size, for converting normalized anchors to pixel space. */
  size: { width: number; height: number }
  onReorder: (next: EditableStop[]) => void
  /** Fired when a handle drag engages/releases, so the parent can duck
   * chrome (FABs) out of the way of a drag near the edges. */
  onDraggingChange?: (dragging: boolean) => void
  /** If true, instantly hide the handles without transitioning opacity out. */
  hidden?: boolean
  angle?: number
}

export function CanvasHandles({
  stops,
  type,
  spoke,
  fanAnchor,
  repeat,
  cursor,
  size,
  onReorder,
  onDraggingChange,
  hidden = false,
  angle,
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

  // Safety net: end any drag on a pointerup/cancel anywhere, or when the window
  // loses focus or is hidden. Pointer capture can be lost (release outside the
  // window, tab switch) without the element ever seeing pointerup, which would
  // otherwise leave the handle stuck in its dragging state.
  useEffect(() => {
    const end = () => endDrag()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') endDrag()
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const positions = stops.map((s) => s.position)
  const isFourSpoke = (type === 'radial' || type === 'square') && angle === undefined
  const activeSpokes: readonly StopAnchorOpts['spoke'][] = isFourSpoke
    ? ['up', 'down', 'left', 'right']
    : [spoke ?? 'up']

  // Angular and fan are circular geometries. Their normalized anchors trace a
  // circle around a reference point (canvas center for angular; the pivot edge
  // for fan); scaling x by width and y by height independently would squash
  // that circle into an ellipse on a non-square canvas, so the handles would
  // drift off the color they mark. Scale the offset from the reference by the
  // shorter side uniformly to keep it circular.
  const minSide = Math.min(size.width, size.height)
  const fanCfg = resolveFanConfig(fanAnchor, angle)
  function toPixel(a: { x: number; y: number }): PixelPoint {
    if (type === 'angular') {
      return {
        x: size.width / 2 + (a.x - 0.5) * minSide,
        y: size.height / 2 + (a.y - 0.5) * minSide,
      }
    }
    if (type === 'fan') {
      return {
        x: fanCfg.px * size.width + (a.x - fanCfg.px) * minSide,
        y: fanCfg.py * size.height + (a.y - fanCfg.py) * minSide,
      }
    }
    return { x: a.x * size.width, y: a.y * size.height }
  }

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
      const a = stopAnchor(type, positions, i, { spoke: sp, fanAnchor, repeat, angle })
      items.push({
        key: isFourSpoke ? `${stop.id}-${sp}` : stop.id,
        stopId: stop.id,
        stopIndex: i,
        spoke: sp,
        anchor: toPixel(a),
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
    // If the primary button is no longer held (e.g. released outside the window,
    // so we never saw the pointerup), don't stay stuck in a drag — bail out.
    if (e.buttons === 0 && (draggingId || pendingRef.current)) {
      endDrag()
      return
    }
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

  function endDrag() {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer)
      pendingRef.current = null
    }
    setDraggingId(null)
    setDraggingSpoke(null)
    setDragPoint(null)
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.stopPropagation()
    endDrag()
  }

  function projectToTrack(
    item: { spoke: StopAnchorOpts['spoke']; anchor: PixelPoint },
    pt: PixelPoint
  ): PixelPoint {
    const cx = size.width * 0.5
    const cy = size.height * 0.5
    if (type === 'radial' || type === 'square') {
      // Rotated origin: the color sequence runs from the origin edge/corner
      // through the center, not straight up/down. Project the drag onto that
      // axis so the handle rides the gradient's spine instead of snapping to a
      // fixed vertical/horizontal track.
      if (angle !== undefined) {
        const cfg = getRadialConfig(angle)
        let dx = 0.5 - cfg.px
        let dy = 0.5 - cfg.py
        const len = Math.hypot(dx, dy)
        if (len < 1e-6) return { x: cx, y: pt.y }
        dx /= len
        dy /= len
        // Work in normalized space so the projection matches how anchors are
        // placed (a.x·width, a.y·height), then scale back to pixels.
        const nx = pt.x / size.width - cfg.px
        const ny = pt.y / size.height - cfg.py
        let t = nx * dx + ny * dy
        if (t < 0) t = 0
        return { x: (cfg.px + dx * t) * size.width, y: (cfg.py + dy * t) * size.height }
      }
      if (item.spoke === 'up' || item.spoke === 'down') {
        return { x: cx, y: pt.y }
      } else {
        return { x: pt.x, y: cy }
      }
    }
    if (type === 'linear' || type === 'mirror') {
      // Handles live on the center line (matching stopAnchor's x=0.5); a drag
      // slides vertically and stays centered.
      return { x: cx, y: pt.y }
    }
    if (type === 'angular') {
      // Snap to the same true circle (radius scaled by the shorter side) the
      // handles sit on, so a drag rides the ring rather than an ellipse.
      const dx = pt.x - cx
      const dy = pt.y - cy
      const dist = Math.hypot(dx, dy)
      if (dist < 0.001) return item.anchor
      const r = ANGULAR_RADIUS * minSide
      return { x: cx + r * (dx / dist), y: cy + r * (dy / dist) }
    }
    if (type === 'fan') {
      const pivotX = fanCfg.px * size.width
      const pivotY = fanCfg.py * size.height
      const dx = pt.x - pivotX
      const dy = pt.y - pivotY
      const dist = Math.hypot(dx, dy)
      if (dist < 0.001) return item.anchor
      const r = FAN_RADIUS * minSide
      return { x: pivotX + r * (dx / dist), y: pivotY + r * (dy / dist) }
    }
    return pt
  }

  return (
    <div ref={overlayRef} className={[styles.overlay, hidden && styles.hidden].filter(Boolean).join(' ')} data-testid="canvas-handles">
      {hovering && size.width > 0 && (
        <>
          {isFourSpoke && (
            <>
              <div className={styles.trackGuideVertical} style={{ left: `${size.width * 0.5}px` }} />
              <div className={styles.trackGuideHorizontal} style={{ top: `${size.height * 0.5}px` }} />
            </>
          )}
          {type === 'angular' && (
            <div
              className={styles.trackGuideCircle}
              style={{
                left: `${size.width * 0.5 - ANGULAR_RADIUS * minSide}px`,
                top: `${size.height * 0.5 - ANGULAR_RADIUS * minSide}px`,
                width: `${2 * ANGULAR_RADIUS * minSide}px`,
                height: `${2 * ANGULAR_RADIUS * minSide}px`,
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
            {/* Always mounted so opacity dissolves both in and out on hover
                (unmounting would make it pop). The testid is only present when
                revealed, preserving the "hidden until hover" contract. */}
            <span
              data-testid={revealed ? (near ? 'canvas-handle-near' : 'canvas-handle-visible') : undefined}
              data-stop-id={stop.id}
              className={styles.dotInner}
              style={{ backgroundColor: stop.hex }}
            />
          </button>
        )
      })}
    </div>
  )
}
