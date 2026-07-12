import { useState } from 'react'
import type { Collection } from '../store/types'
import styles from './SaveDestination.module.css'

interface SaveDestinationProps {
  collections: Collection[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  color?: string
}

/** Chip beside the Save pill naming where a save will land: "Gallery" when no
 * collection is active, or the active collection's name. Tapping opens a menu
 * to switch target, choose Gallery-only, or create a new collection. */
export function SaveDestination({
  collections,
  activeId,
  onSelect,
  onCreate,
  color,
}: SaveDestinationProps) {
  const [open, setOpen] = useState(false)
  const active = collections.find((c) => c.id === activeId) ?? null
  const label = active ? active.name : 'Gallery'
  return (
    <div className={styles.wrap} style={color ? { color } : undefined}>
      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            data-testid="save-destination-gallery"
            className={styles.item}
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
          >
            Gallery only
          </button>
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`save-destination-option-${c.id}`}
              className={styles.item}
              onClick={() => {
                onSelect(c.id)
                setOpen(false)
              }}
            >
              {c.name}
            </button>
          ))}
          <button
            type="button"
            data-testid="save-destination-new"
            className={styles.item}
            onClick={() => {
              onCreate()
              setOpen(false)
            }}
          >
            + New collection
          </button>
        </div>
      )}
      <button
        type="button"
        data-testid="save-destination"
        className={`${styles.chip} ghost-chip ghost-pill`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ◳ {label} ▾
      </button>
    </div>
  )
}
