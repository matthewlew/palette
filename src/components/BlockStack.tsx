import type { RefObject } from 'react'
import { useDragReorder } from '../hooks/useDragReorder'
import { isLightColor } from '../lib/oklch'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './BlockStack.module.css'

interface BlockStackProps {
  stops: EditableStop[]
  onReorder: (stops: EditableStop[]) => void
  onRemove: (id: string) => void
  containerRef?: RefObject<HTMLDivElement>
  insertionIndex?: number | null
}

export function BlockStack({ stops, onReorder, onRemove, containerRef, insertionIndex = null }: BlockStackProps) {
  const { draggingIndex, handlePointerDown, handlePointerMove, handlePointerUp } = useDragReorder(stops, onReorder)

  const items: Array<{ kind: 'block'; stop: EditableStop; index: number } | { kind: 'gap' }> = []
  stops.forEach((stop, index) => {
    if (insertionIndex === index) items.push({ kind: 'gap' })
    items.push({ kind: 'block', stop, index })
  })
  if (insertionIndex === stops.length) items.push({ kind: 'gap' })

  return (
    <div
      ref={containerRef}
      data-testid="block-stack"
      className={styles.stack}
      onPointerMove={(e) => handlePointerMove(e.clientY)}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {items.map((item, i) => {
        if (item.kind === 'gap') {
          return <div key={`gap-${i}`} data-testid="insertion-gap" className={styles.gap} />
        }
        const { stop, index } = item
        const light = isLightColor(stop.hex)
        return (
          <div
            key={stop.id}
            data-testid="stack-block"
            className={styles.block}
            style={{
              backgroundColor: stop.hex,
              color: light ? '#000' : '#fff',
              borderTopColor: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
              opacity: draggingIndex === index ? 0.6 : 1,
            }}
            onPointerDown={(e) => handlePointerDown(index, e.clientY)}
          >
            <span className={styles.label}>{stop.hex}</span>
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
  )
}
