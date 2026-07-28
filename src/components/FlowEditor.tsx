import { useEffect, useRef, useState, type RefObject } from 'react'
import { toGradientStops, type EditableStop } from '../lib/stopOrdering'
import styles from './FlowEditor.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 6
const REMOVE_DISTANCE_PX = 56

interface FlowEditorProps {
  stops: EditableStop[]
  onMove: (id: string, position: number) => void
  onTapStop: (id: string) => void
  onRemoveStop?: (id: string) => void
  onAddStopAt?: (position: number) => void
  containerRef?: RefObject<HTMLDivElement>
  activeStopId?: string | null
}

export function FlowEditor({ stops, onMove, onTapStop, onRemoveStop, onAddStopAt, containerRef, activeStopId }: FlowEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const trackRef = containerRef ?? (internalRef as RefObject<HTMLDivElement>)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [removeCandidateId, setRemoveCandidateId] = useState<string | null>(null)

  // Horizontal strip: left-to-right mirrors the stop positions 0-100.
  const gradientCss = `linear-gradient(90deg, ${toGradientStops(stops)
    .map((s) => `${s.hex} ${s.position}%`)
    .join(', ')})`

  function positionFromClientX(clientX: number): number {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const raw = ((clientX - rect.left) / rect.width) * 100
    return Math.min(100, Math.max(0, raw))
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    draggingIdRef.current = id
    setDraggingId(id)
    const target = e.target as Element
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId)
    }
  }

  function handleTrackPointerDown(e: React.PointerEvent) {
    if (e.target === trackRef.current && onAddStopAt) {
      onAddStopAt(positionFromClientX(e.clientX))
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const id = draggingIdRef.current
    if (!id) return
    const start = pointerStartRef.current
    const dy = start ? Math.abs(e.clientY - start.y) : 0
    setRemoveCandidateId(dy > REMOVE_DISTANCE_PX ? id : null)
    onMove(id, positionFromClientX(e.clientX))
  }

  function handlePointerUp(e: React.PointerEvent, id: string) {
    const start = pointerStartRef.current
    draggingIdRef.current = null
    setDraggingId(null)
    pointerStartRef.current = null
    setRemoveCandidateId(null)
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (Math.abs(dy) > REMOVE_DISTANCE_PX) {
      onRemoveStop?.(id)
      return
    }
    if (distance < TAP_MOVEMENT_THRESHOLD_PX) {
      onTapStop(id)
    }
  }

  // `touch-action: none` stops the PAGE scrolling under a stop drag, but it
  // does not stop the browser's own edge-swipe back navigation — that is
  // chrome-level, and on a stop parked near 0% it hijacked the drag entirely.
  // Cancelling touchstart/touchmove is what suppresses it, and that has to be
  // a non-passive native listener: React routes touch events through the root
  // as passive, so preventDefault() from a JSX handler is ignored.
  //
  // Pointer events are unaffected by a cancelled touch sequence, so the drag
  // below keeps working exactly as it did — only the compatibility mouse
  // events and the browser gesture are suppressed.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    function onTouch(e: TouchEvent) {
      if (!e.cancelable) return
      const startedOnHandle = (e.target as Element | null)?.closest?.('[data-testid="flow-handle"]')
      if (startedOnHandle || draggingIdRef.current) {
        e.preventDefault()
      }
    }

    el.addEventListener('touchstart', onTouch, { passive: false })
    el.addEventListener('touchmove', onTouch, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouch)
      el.removeEventListener('touchmove', onTouch)
    }
  }, [trackRef])

  function handleKeyDown(e: React.KeyboardEvent, stop: EditableStop) {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft') {
      onMove(stop.id, stop.position - step)
    } else if (e.key === 'ArrowRight') {
      onMove(stop.id, stop.position + step)
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      onRemoveStop?.(stop.id)
    }
  }

  return (
    <div
      ref={trackRef}
      data-testid="flow-editor"
      className={styles.track}
      style={{ backgroundImage: gradientCss }}
      onPointerDown={handleTrackPointerDown}
      onPointerMove={handlePointerMove}
    >
      {stops.map((stop) => (
        <div
          key={stop.id}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stop.position}
          aria-orientation="horizontal"
          aria-label={`Stop ${stop.hex}`}
          data-testid="flow-handle"
          className={stop.id === activeStopId ? `${styles.handle} ${styles.handleActive}` : styles.handle}
          style={{
            left: `${stop.position}%`,
            transition: draggingId === stop.id ? 'none' : 'left 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s, background-color 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
            backgroundColor: stop.hex,
            opacity: removeCandidateId === stop.id ? 0.35 : 1,
            transform: removeCandidateId === stop.id
              ? 'translate(-50%, -50%) scale(0.8)'
              : stop.id === activeStopId
              ? 'translate(-50%, -50%) scale(1.15)'
              : undefined,
          }}
          onPointerDown={(e) => handlePointerDown(e, stop.id)}
          onPointerUp={(e) => handlePointerUp(e, stop.id)}
          onKeyDown={(e) => handleKeyDown(e, stop)}
        />
      ))}
    </div>
  )
}
