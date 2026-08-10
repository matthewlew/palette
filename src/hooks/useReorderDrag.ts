import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drag-to-reorder on pointer events, with the lifted item following the
 * pointer.
 *
 * This replaces HTML5 drag-and-drop, which never worked here: `draggable` and
 * the drag* events are mouse-only, so on a phone a list could not be reordered
 * at all. Pointer events are one code path for mouse, touch and pen.
 *
 * The hold-before-lift applies to TOUCH ONLY. A hold is a tax, and it buys
 * exactly one thing: the chance to tell "I am dragging this" apart from "I am
 * scrolling the page", which is a distinction only touch has to make. Charging
 * a mouse for it made dragging feel broken — you press, nothing happens, and
 * any drift past the tolerance during the wait silently cancels the gesture, so
 * a trackpad's own jitter was enough to lose it.
 *
 * A press that never moves is a tap, and is reported through `onTap` for both
 * input types.
 *
 * Targets are found with `elementFromPoint` rather than pointer-enter events,
 * because a captured pointer fires no enter/leave on anything else.
 */

/** Items opt in by carrying this attribute; `getItemProps` sets it. */
export const REORDER_ATTR = 'data-reorder-id'

/** Descendants marked with this swallow the gesture — a remove button inside a
 * tile should delete, not start a drag. */
export const NO_DRAG_ATTR = 'data-no-drag'

const HOLD_MS = 260

/** How far a touch may drift during the hold and still count as a press.
 * Beyond it the user is scrolling. */
const MOVE_TOLERANCE = 10

/** How far the pointer must travel after lifting before this counts as a drag
 * rather than a tap. Below it, a click with a shaky hand would reorder. */
const DRAG_THRESHOLD = 5

export interface ReorderDragOptions {
  onReorder: (fromId: string, toId: string) => void
  /** Fired for a press that never became a drag. */
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
  /** Pointer travel since the lift, so the lifted item can follow the finger.
   * Without this the card only scaled in place and the gesture read as
   * "nothing is happening", which is why a working drag still felt broken. */
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)

  // Everything the gesture needs mid-flight lives in a ref: the window
  // listeners are bound once and must not be torn down and rebound on every
  // state change during a drag.
  const state = useRef({
    pointerId: -1,
    startId: null as string | null,
    startX: 0,
    startY: 0,
    lifted: false,
    dragged: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  const reset = useCallback(() => {
    const s = state.current
    if (s.timer) clearTimeout(s.timer)
    s.timer = null
    s.pointerId = -1
    s.startId = null
    s.lifted = false
    s.dragged = false
    setActiveId(null)
    setOverId(null)
    setOffset(null)
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

      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY

      if (!s.lifted) {
        // Waiting out a touch hold. Movement here is a scroll, so abandon the
        // gesture rather than fighting the user for their pointer.
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) reset()
        return
      }

      if (!s.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      s.dragged = true

      // Lifted and moving: this pointer is ours, so stop the page scrolling.
      if (e.cancelable) e.preventDefault()
      setOffset({ x: dx, y: dy })
      const over = idAt(e.clientX, e.clientY)
      setOverId(over && over !== s.startId ? over : null)
    }

    function handleUp(e: PointerEvent) {
      const s = state.current
      if (s.pointerId !== e.pointerId) return
      const { startId, lifted, dragged } = s
      const target = lifted && dragged ? idAt(e.clientX, e.clientY) : null
      reset()
      if (!startId) return
      if (dragged) {
        if (target && target !== startId) handlers.current.onReorder(startId, target)
      } else {
        // Never travelled: a tap, whether or not a touch hold had elapsed.
        handlers.current.onTap?.(startId)
      }
    }

    function handleCancel(e: PointerEvent) {
      if (state.current.pointerId === e.pointerId) reset()
    }

    // Non-passive so preventDefault during a drag actually blocks scrolling.
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
    (id: string) => {
      const isActive = activeId === id
      const style: React.CSSProperties = {
        // Claim the pointer only once lifted; before that a touch has to be
        // able to scroll the page or the hold would cost the user their scroll.
        touchAction: isActive ? 'none' : 'pan-y',
      }
      if (isActive && offset) {
        style.transform = `translate(${offset.x}px, ${offset.y}px)`
        // Following the pointer means no transition — an eased transform lags
        // behind the finger and reads as lag, not as smoothing.
        style.transition = 'none'
        // The lifted item now sits directly under the pointer, so the hit test
        // would find IT rather than the item being dropped onto, and every
        // drop would resolve to "onto itself" — a no-op. Move and up are bound
        // to the window, so the gesture loses nothing by going transparent.
        style.pointerEvents = 'none'
      }

      return {
        [REORDER_ATTR]: id,
        style,
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
          s.dragged = false

          if (e.pointerType === 'touch') {
            // Only touch has to be told apart from a scroll.
            s.lifted = false
            s.timer = setTimeout(() => {
              s.lifted = true
              s.timer = null
              setActiveId(id)
            }, holdMs)
          } else {
            s.lifted = true
            setActiveId(id)
          }
        },
      }
    },
    [activeId, offset, holdMs]
  )

  return { activeId, overId, getItemProps }
}
