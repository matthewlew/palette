import { useState } from 'react'
import type { Collection, Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import styles from './CollectionsRow.module.css'

interface CollectionsRowProps {
  collections: Collection[]
  /** Lookup so a cover can render the collection's newest member. */
  gradientsById: Record<string, Gradient>
  onOpen: (id: string) => void
  /** Content-first creation: a gallery tile dropped on the "new board" target
   * seeds a fresh collection with that gradient. There is no empty-shell
   * button — a board is always born from a palette. */
  onCreateFromDrop: (gradientId: string) => void
  /** When present, covers accept a dragged gallery tile (its gradient id). */
  onDropGradient?: (collectionId: string, gradientId: string) => void
}

function readGradientId(e: React.DragEvent): string {
  return e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('')
}

const COVER_CELLS = 4 // 2x2 mosaic snapshot of the board

/** The newest members (up to 4), newest first — the 2x2 cover mosaic. */
function coverGradients(collection: Collection, byId: Record<string, Gradient>): Gradient[] {
  return [...collection.gradientIds]
    .reverse()
    .slice(0, COVER_CELLS)
    .map((id) => byId[id])
    .filter(Boolean) as Gradient[]
}

function cellBackground(g: Gradient): string {
  return buildGradientCss(g.type, g.stops, g.reversed, {
    repeat: g.repeatEnabled,
    hard: g.hardStops,
    fanAnchor: g.fanAnchor,
  })
}

export function CollectionsRow({
  collections,
  gradientsById,
  onOpen,
  onCreateFromDrop,
  onDropGradient,
}: CollectionsRowProps) {
  const [armed, setArmed] = useState(false)
  return (
    <div className={styles.row} data-testid="collections-row">
      {collections.map((c) => {
        const covers = coverGradients(c, gradientsById)
        return (
          <button
            key={c.id}
            type="button"
            data-testid={`collection-cover-${c.id}`}
            className={styles.cover}
            onClick={() => onOpen(c.id)}
            onDragOver={(e) => {
              if (onDropGradient) e.preventDefault()
            }}
            onDrop={(e) => {
              if (!onDropGradient) return
              e.preventDefault()
              const gradientId = readGradientId(e)
              if (gradientId) onDropGradient(c.id, gradientId)
            }}
          >
            {/* 2x2 mosaic snapshot of the board's newest members. Empty slots
                fill the grid when a board has fewer than 4. */}
            <span data-testid={`collection-cover-grid-${c.id}`} className={styles.coverGrid} aria-hidden="true">
              {Array.from({ length: COVER_CELLS }).map((_, i) => (
                <span
                  key={i}
                  className={styles.coverCell}
                  style={covers[i] ? { backgroundImage: cellBackground(covers[i]) } : undefined}
                />
              ))}
            </span>
            <span data-testid={`collection-count-${c.id}`} className={styles.count}>
              {c.gradientIds.length}
            </span>
            <span className={styles.name}>{c.name}</span>
          </button>
        )
      })}
      {/* Content-first: a drop target, not a create button. It arms (brightens)
          on drag-over so it reads as an intentional hint rather than an empty
          broken tile, and only reacts to a dropped palette. */}
      <div
        data-testid="collection-new-drop"
        className={[styles.dropNew, armed && styles.dropNewArmed].filter(Boolean).join(' ')}
        onDragOver={(e) => {
          e.preventDefault()
          setArmed(true)
        }}
        onDragLeave={() => setArmed(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArmed(false)
          const gradientId = readGradientId(e)
          if (gradientId) onCreateFromDrop(gradientId)
        }}
      >
        <span className={styles.dropPlus}>+</span>
        <span className={styles.dropLabel}>New board</span>
      </div>
    </div>
  )
}
