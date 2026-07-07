import { useRef, type RefObject } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { toGradientStops, type EditableStop } from '../lib/stopOrdering'
import styles from './FlowEditor.module.css'

const TAP_MOVEMENT_THRESHOLD_PX = 6

interface FlowEditorProps {
  stops: EditableStop[]
  onMove: (id: string, position: number) => void
  onTapStop: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
}

export function FlowEditor({ stops, onMove, onTapStop, containerRef }: FlowEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const trackRef = containerRef ?? (internalRef as RefObject<HTMLDivElement>)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const draggingIdRef = useRef<string | null>(null)

  const gradientCss = buildGradientCss('linear', toGradientStops(stops))

  function positionFromClientY(clientY: number): number {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const raw = ((clientY - rect.top) / rect.height) * 100
    return Math.min(100, Math.max(0, raw))
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    draggingIdRef.current = id
    const target = e.target as Element
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId)
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const id = draggingIdRef.current
    if (!id) return
    onMove(id, positionFromClientY(e.clientY))
  }

  function handlePointerUp(e: React.PointerEvent, id: string) {
    const start = pointerStartRef.current
    draggingIdRef.current = null
    pointerStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < TAP_MOVEMENT_THRESHOLD_PX) {
      onTapStop(id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, stop: EditableStop) {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp') {
      onMove(stop.id, stop.position - step)
    } else if (e.key === 'ArrowDown') {
      onMove(stop.id, stop.position + step)
    }
  }

  return (
    <div
      ref={trackRef}
      data-testid="flow-editor"
      className={styles.track}
      style={{ backgroundImage: gradientCss }}
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
          aria-label={`Stop ${stop.hex}`}
          data-testid="flow-handle"
          className={styles.handle}
          style={{ top: `${stop.position}%`, backgroundColor: stop.hex }}
          onPointerDown={(e) => handlePointerDown(e, stop.id)}
          onPointerUp={(e) => handlePointerUp(e, stop.id)}
          onKeyDown={(e) => handleKeyDown(e, stop)}
        />
      ))}
    </div>
  )
}
