import type { Collection, Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import styles from './CollectionsRow.module.css'

interface CollectionsRowProps {
  collections: Collection[]
  /** Lookup so a cover can render the collection's newest member. */
  gradientsById: Record<string, Gradient>
  onOpen: (id: string) => void
  onCreate: () => void
  /** When present, covers accept a dragged gallery tile (its gradient id). */
  onDropGradient?: (collectionId: string, gradientId: string) => void
}

function coverStyle(collection: Collection, byId: Record<string, Gradient>) {
  const lastId = collection.gradientIds[collection.gradientIds.length - 1]
  const g = lastId ? byId[lastId] : undefined
  if (!g) return undefined
  return {
    backgroundImage: buildGradientCss(g.type, g.stops, g.reversed, {
      repeat: g.repeatEnabled,
      hard: g.hardStops,
      fanAnchor: g.fanAnchor,
    }),
  }
}

export function CollectionsRow({
  collections,
  gradientsById,
  onOpen,
  onCreate,
  onDropGradient,
}: CollectionsRowProps) {
  return (
    <div className={styles.row} data-testid="collections-row">
      {collections.map((c) => (
        <button
          key={c.id}
          type="button"
          data-testid={`collection-cover-${c.id}`}
          className={styles.cover}
          style={coverStyle(c, gradientsById)}
          onClick={() => onOpen(c.id)}
          onDragOver={(e) => {
            if (onDropGradient) e.preventDefault()
          }}
          onDrop={(e) => {
            if (!onDropGradient) return
            e.preventDefault()
            const gradientId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('')
            if (gradientId) onDropGradient(c.id, gradientId)
          }}
        >
          <span data-testid={`collection-count-${c.id}`} className={styles.count}>
            {c.gradientIds.length}
          </span>
          <span className={styles.name}>{c.name}</span>
        </button>
      ))}
      <button
        type="button"
        data-testid="collection-new"
        className={styles.newTile}
        onClick={onCreate}
      >
        + New
      </button>
    </div>
  )
}
