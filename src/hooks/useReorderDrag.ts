import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Long-press-then-drag reordering, on pointer events.
 *
 * This replaces HTML5 drag-and-drop, which never worked here: `draggable` and
 * the drag* events are mouse-only, so on a phone the tray could not be
 * reordered at all and the ‹ › nudge buttons existed only to paper over it.
 * Pointer events are one code path for mouse, touch and pen.
 *
 * The hold before the lift is what makes this safe inside a scrollable grid.
 * A touch that moves before the hold completes is a scroll and is handed back
 * to the browser; only a touch that stays put long enough becomes a drag. That
 * is the same bargain iOS makes on the home screen, so the gesture is already
 * known to anyone holding a phone.
 *
 * Targets are found with `elementFromPoint` rather than pointer-enter events,
 * because the pointer is captured for the duration of a drag and a captured
 * pointer fires no enter/leave on anything else.
 */

/** Items opt in by carrying this attribute; `getItemProps` sets it. */
export const REORDER_ATTR = 'data-reorder-id'

/** Descendants marked with this swallow the gesture — a remove button inside a
 * tile should delete, not start a drag. */
export const NO_DRAG_ATTR = 'data-no-drag'

const HOLD_MS = 320

/** How far a pointer may drift during the hold and still count as a press.
 * Roughly a fingertip's wobble; beyond it the user is scrolling. */
const MOVE_TOLERANCE = 10

export interface ReorderDragOptions {
  onReorder: (fromId: string, toId: string) => void
  /** Fired for a press that never became a drag — a plain tap. */
  onTap?: (id: string) => void
  holdMs?: number
}

export interface ReorderDragApi {
  /** The item currently lifted, or null. */
  activeId: string | null
  /** The item the lifted one is hovering over, or null. */
  overId: string | null
  getItemProps: (id: string) => {
    [REORDER_ATTR]: string
    onPointerDown: (e: React.PointerEvent) => void
    style: React.CSSProperties
  }
}

export function useReorderDrag({
  onReorder,
  onTap,
  holdMs = HOLD_MS,
}: ReorderDragOptions): ReorderDragApi {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Everything the gesture needs mid-flight lives in a ref: the window
  // listeners are bound once and must not be torn down and rebound on every
  // state change during a drag.
  const state = useRef({
    pointerId: -1,
    startId: null as string | null,
    startX: 0,
    startY: 0,
    lifted: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  const reset = useCallback(() => {
    const s = state.current
    if (s.timer) clearTimeout(s.timer)
    s.timer = null
    s.pointerId = -1
    s.startId = null
    s.lifted = false
    setActiveId(null)
    setOverId(null)
  }, [])

  // Latest callbacks, so the once-bound listeners never call a stale closure.
  const handlers = useRef({ onReorder, onTap })
  handlers.current = { onReorder, onTap }

  useEffect(() => {
    function idAt(x: number, y: number): string | null {
      // Not every environment has it (jsdom notably does not), and a missing
      // hit test should mean "no drop target", not a thrown TypeError that
      // strands the gesture mid-drag.
      if (typeof document.elementFromPoint !== 'function') return null
      const el = document.elementFromPoint(x, y)
      const host = el?.closest?.(`[${REORDER_ATTR}]`)
      return host?.getAttribute(REORDER_ATTR) ?? null
    }

    function handleMove(e: PointerEvent) {
      const s = state.current
      if (s.pointerId !== e.pointerId) return

      if (!s.lifted) {
        const dx = e.clientX - s.startX
        const dy = e.clientY - s.startY
        // Moved before the hold landed: the user is scrolling the page, so
        // abandon the gesture entirely rather than fighting them for it.
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) reset()
        return
      }

      // Lifted: this pointer belongs to us, so stop the page scrolling under it.
      if (e.cancelable) e.preventDefault()
      const over = idAt(e.clientX, e.clientY)
      setOverId(over && over !== s.startId ? over : null)
    }

    function handleUp(e: PointerEvent) {
      const s = state.current
      if (s.pointerId !== e.pointerId) return
      const { startId, lifted } = s
      const target = lifted ? idAt(e.clientX, e.clientY) : null
      reset()
      if (!startId) return
      if (lifted) {
        if (target && target !== startId) handlers.current.onReorder(startId, target)
      } else {
        handlers.current.onTap?.(startId)
      }
    }

    function handleCancel(e: PointerEvent) {
      if (state.current.pointerId === e.pointerId) reset()
    }

    // Non-passive so preventDefault during a lift actually blocks scrolling.
    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
    }
  }, [reset])

  const getItemProps = useCallback(
    (id: string) => ({
      [REORDER_ATTR]: id,
      style: {
        // Claim vertical panning only once lifted; before that the grid has to
        // stay scrollable or the hold gesture would cost the user their scroll.
        touchAction: activeId === id ? ('none' as const) : ('pan-y' as const),
      },
      onPointerDown: (e: React.PointerEvent) => {
        // Only the primary button; a right-click is a context menu.
        if (e.button !== 0) return
        // A nested control owns this press.
        if ((e.target as Element).closest?.(`[${NO_DRAG_ATTR}]`)) return

        const s = state.current
        if (s.pointerId !== -1) return
        s.pointerId = e.pointerId
        s.startId = id
        s.startX = e.clientX
        s.startY = e.clientY
        s.lifted = false
        s.timer = setTimeout(() => {
          s.lifted = true
          s.timer = null
          setActiveId(id)
        }, holdMs)
      },
    }),
    [activeId, holdMs]
  )

  return { activeId, overId, getItemProps }
}
