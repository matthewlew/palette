import { useState } from 'react'
import { buildGradientCss } from '../lib/gradient'
import { gradientMetric, type SortKey } from '../lib/sortColors'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './Drawer.module.css'

interface DrawerProps {
  saved: Gradient[]
  onSelect: (gradient: Gradient) => void
}

type SortOption = 'newest' | SortKey

function sortedForDisplay(saved: Gradient[], option: SortOption): Gradient[] {
  if (option === 'newest') return saved
  return [...saved].sort(
    (a, b) =>
      gradientMetric(a.stops.map((s) => s.hex), option) -
      gradientMetric(b.stops.map((s) => s.hex), option)
  )
}

export function Drawer({ saved, onSelect }: DrawerProps) {
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const displayed = sortedForDisplay(saved, sortOption)

  return (
    <div className={styles.drawer}>
      <label className={styles.sortLabel}>
        Sort saved palettes
        <select
          aria-label="Sort saved palettes"
          className={styles.sortSelect}
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
        >
          <option value="newest">Newest</option>
          <option value="lightness">Lightness</option>
          <option value="hue">Hue</option>
          <option value="chroma">Chroma</option>
        </select>
      </label>
      {displayed.map((gradient) => (
        <button
          key={gradient.id}
          type="button"
          data-testid="drawer-thumbnail"
          aria-label={`Saved ${gradient.type} gradient`}
          className={styles.thumbnail}
          style={{
            backgroundImage:
              gradient.type === 'square' ? undefined : buildGradientCss(gradient.type, gradient.stops, gradient.reversed),
          }}
          onClick={() => onSelect(gradient)}
        >
          {gradient.type === 'square' && <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} blurPx={4} />}
        </button>
      ))}
    </div>
  )
}
