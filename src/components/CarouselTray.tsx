import { useRef, useState } from 'react'
import type { Gradient } from '../store/types'
import { tileBackground } from '../lib/tileBackground'
import { namePalette } from '../lib/naming'
import { TurrellSquare } from './TurrellSquare'
import styles from './CarouselTray.module.css'

interface CarouselTrayProps {
  /** The picked gradients, already resolved and in slide order. */
  gradients: Gradient[]
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  /** Tapping a thumbnail (as opposed to dragging it) previews that gradient. */
  onPreview?: (id: string) => void
}

/**
 * The carousel's running order as a filmstrip of just the picked gradients.
 *
 * This exists because reordering in the Gallery grid doesn't scale: the grid
 * holds everything you own, so slides 1 and 2 can be rows apart with a dozen
 * unpicked gradients between them, and a drag has to cross all of them. Here
 * the picks are adjacent and linear by construction — slide 3 is always
 * immediately after slide 2 — so "move this one earlier" is a short drag or a
 * single arrow press.
 *
 * Adding still happens in the grid above. That split is deliberate: choosing
 * WHAT goes in wants every gradient on screen, and choosing WHAT ORDER wants
 * only the chosen few. One surface can't be good at both.
 */
/** Below this many pixels of pointer movement, a touch drag is still just a
 * tap — used to tell "reorder this" from "tap to preview" apart. */
const TOUCH_DRAG_THRESHOLD_PX = 6

export function CarouselTray({ gradients, onRemove, onReorder, onMove, onPreview }: CarouselTrayProps) {
  const dragId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const last = gradients.length - 1

  // Native HTML5 drag-and-drop (above) never fires on iOS/Android touch, so
  // reordering was mouse-only in practice. This tracks a touch/pen drag by
  // hand: find the item under the pointer on every move and reorder toward
  // it, the same way the native onDragEnter/onDrop pair does for a mouse.
  const touchDragId = useRef<string | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const touchMoved = useRef(false)
  const [touchDraggingId, setTouchDraggingId] = useState<string | null>(null)

  function clearDrag() {
    dragId.current = null
    setDragOverId(null)
  }

  function clearTouchDrag() {
    touchDragId.current = null
    touchStart.current = null
    touchMoved.current = false
    setTouchDraggingId(null)
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    if (e.pointerType === 'mouse') return
    touchDragId.current = id
    touchStart.current = { x: e.clientX, y: e.clientY }
    touchMoved.current = false
  }

  function handlePointerMove(e: React.PointerEvent) {
    const id = touchDragId.current
    const start = touchStart.current
    if (!id || !start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (!touchMoved.current) {
      if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) return
      touchMoved.current = true
      setTouchDraggingId(id)
    }
    e.preventDefault()
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-tray-id]')
    const overId = target?.dataset.trayId
    if (overId && overId !== id) onReorder(id, overId)
  }

  function handlePointerUp(e: React.PointerEvent, id: string) {
    if (e.pointerType === 'mouse') return
    if (!touchMoved.current) onPreview?.(id)
    clearTouchDrag()
  }

  return (
    <ol className={styles.tray} data-testid="carousel-tray" aria-label="Carousel order">
      {gradients.map((gradient, i) => {
        const name = gradient.name ?? namePalette(gradient.stops.map((s) => s.hex))
        const role = i === 0 ? 'Start' : i === last ? 'End' : null
        return (
          <li
            key={gradient.id}
            className={[
              styles.item,
              dragOverId === gradient.id ? styles.itemOver : '',
              touchDraggingId === gradient.id ? styles.itemDragging : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-testid="tray-item"
            data-tray-id={gradient.id}
            draggable
            tabIndex={0}
            // Arrow keys move the slide rather than moving focus between
            // slides: this list exists to be reordered, and a keyboard user
            // otherwise has no way to do the thing it is for.
            aria-label={`Slide ${i + 1}, ${name}. Arrow keys reorder, Delete removes.`}
            aria-keyshortcuts="ArrowLeft ArrowRight Delete"
            onDragStart={() => {
              dragId.current = gradient.id
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => {
              if (dragId.current && dragId.current !== gradient.id) setDragOverId(gradient.id)
            }}
            onDrop={() => {
              if (dragId.current) onReorder(dragId.current, gradient.id)
              clearDrag()
            }}
            onDragEnd={clearDrag}
            onClick={(e) => {
              // Native drag already suppresses the click that would follow a
              // real mouse drag; this only ever fires for a plain click.
              if ((e.target as HTMLElement).closest('button')) return
              onPreview?.(gradient.id)
            }}
            onPointerDown={(e) => handlePointerDown(e, gradient.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, gradient.id)}
            onPointerCancel={clearTouchDrag}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                onMove(gradient.id, -1)
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                onMove(gradient.id, 1)
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault()
                onRemove(gradient.id)
              }
            }}
          >
            <div className={styles.thumb} style={{ backgroundImage: tileBackground(gradient) }}>
              {gradient.type === 'square' && (
                <TurrellSquare
                  stops={gradient.stops}
                  reversed={gradient.reversed}
                  repeatEnabled={gradient.repeatEnabled}
                  blurPx={4}
                  angle={gradient.angle}
                />
              )}
              <span className={styles.number} aria-hidden="true">
                {i + 1}
              </span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => onRemove(gradient.id)}
                aria-label={`Remove ${name} from the carousel`}
              >
                ✕
              </button>
              {/* Nudge handles, revealed on hover or keyboard focus. Drag is
                  the fast path; these are the ones that work on a phone. */}
              <button
                type="button"
                className={styles.nudgeLeft}
                onClick={() => onMove(gradient.id, -1)}
                disabled={i === 0}
                tabIndex={-1}
                aria-hidden="true"
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.nudgeRight}
                onClick={() => onMove(gradient.id, 1)}
                disabled={i === last}
                tabIndex={-1}
                aria-hidden="true"
              >
                ›
              </button>
            </div>
            <span className={styles.caption}>
              {role ? <span className={styles.role}>{role}</span> : <span className={styles.name}>{name}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
