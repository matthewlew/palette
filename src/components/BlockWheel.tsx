import type { RefObject } from 'react'
import { useDragReorder } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './BlockWheel.module.css'

interface BlockWheelProps {
  stops: EditableStop[]
  onReorder: (stops: EditableStop[]) => void
  onRemove: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
}

export function BlockWheel({ stops, onReorder, onRemove, containerRef }: BlockWheelProps) {
  const { draggingIndex, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(stops, onReorder)
  const wedgeDegrees = Math.round(360 / stops.length)

  return (
    <div
      ref={containerRef}
      data-testid="wheel-container"
      className={styles.wheelContainer}
      onPointerMove={(e) => handlePointerMove(e.clientY)}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className={styles.wedgeList}>
        {stops.map((stop, index) => {
          const light = isLightColor(stop.hex)
          return (
            <div
              key={stop.id}
              data-testid="wheel-wedge"
              data-wedge-degrees={wedgeDegrees}
              className={styles.wedgeRow}
              style={{
                backgroundColor: stop.hex,
                color: light ? '#000' : '#fff',
                opacity: draggingIndex === index ? 0.6 : 1,
              }}
              onPointerDown={(e) => handlePointerDown(index, e.clientY)}
            >
              <span>{stop.hex} · {wedgeDegrees}°</span>
              {stops.length > 2 && (
                <button
                  type="button"
                  data-testid="remove-block"
                  className={styles.removeButton}
                  onClick={() => onRemove(stop.id)}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
